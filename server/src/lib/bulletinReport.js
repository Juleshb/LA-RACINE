import { resolveBulletinConfig, getMaxForAssessment, subjectUsesBulletinScale } from '../config/bulletinPresets.js';
import { groupCoursesByCategory } from './curriculum.js';
import { loadPhotoDataUrl } from './studentRegistration.js';
import { createBulletinVerificationToken, buildVerifyUrl } from './bulletinVerification.js';
import {
  buildTestRows,
  buildSubjectMarkSummary,
  ensureSubjectAssessments,
} from './subjectAssessments.js';
import { isPrimaryGrade } from '../config/grades.js';
import { getCurriculum } from '../config/curriculum/index.js';
import { getPublishedMidtermsForTerm } from './midterms.js';
import { resolveDirectorName } from './schoolDirector.js';

function assessmentValue(rows, key) {
  const row = rows.find((r) => r.key === key);
  return {
    score: row?.score ?? null,
    max: row?.max ?? 0,
  };
}

function buildLegacyAssessmentRows(subject, config, markMap) {
  const useBulletin = subjectUsesBulletinScale(subject);
  const assessmentsToUse = useBulletin
    ? config.assessments
    : [{ key: 'SCORE', label: 'Note', maxField: 'totalMax', fallbackMax: 100 }];

  return assessmentsToUse.map((a) => {
    const catNumber = a.key === 'CAT' ? 1 : 0;
    const mark = markMap.get(`${subject.id}:${a.key}:${catNumber}`);
    const max = getMaxForAssessment(subject, a);
    return { key: a.key, label: a.label, score: mark?.score ?? null, max, maxScore: max };
  });
}

function buildFlexibleSubject(subject, assessments, markMap) {
  const summary = buildSubjectMarkSummary(subject, assessments, markMap);

  return {
    id: subject.id,
    name: subject.name,
    code: subject.code,
    flexible: true,
    tests: summary.testRows,
    testsCombined: summary.testsCombined,
    exam: summary.exam,
    assessments: summary.testRows.map((t) => ({
      key: `TEST:${t.sortOrder}`,
      label: t.label,
      score: t.score,
      max: t.max,
      maxScore: t.max,
    })),
    columns: {
      tests: { score: summary.testsCombined.score, max: summary.testsCombined.max },
      test1: summary.testRows[0]
        ? { score: summary.testRows[0].score, max: summary.testRows[0].max }
        : { score: null, max: 0 },
      test2: summary.testRows[1]
        ? { score: summary.testRows[1].score, max: summary.testRows[1].max }
        : { score: null, max: 0 },
      exam: summary.exam,
      total: summary.total,
    },
    testsMarkMax: summary.testsCombined.max,
    obtained: summary.hasAny ? summary.total.score : null,
    max: summary.total.max,
    total: summary.hasAny ? summary.total.score : null,
    totalMax: summary.total.max,
  };
}

function buildLegacySubject(subject, config, markMap) {
  const assessmentRows = buildLegacyAssessmentRows(subject, config, markMap);
  const t1 = assessmentValue(assessmentRows, 'TEST1');
  const t2 = assessmentValue(assessmentRows, 'TEST2');
  const ex = assessmentValue(assessmentRows, 'EX');
  const obtained = assessmentRows.reduce((s, r) => s + (r.score ?? 0), 0);
  const max = assessmentRows.reduce((s, r) => s + r.max, 0);
  const hasAny = assessmentRows.some((r) => r.score != null);

  return {
    id: subject.id,
    name: subject.name,
    code: subject.code,
    flexible: false,
    assessments: assessmentRows,
    columns: {
      test1: t1,
      test2: t2,
      exam: ex,
      total: { score: hasAny ? obtained : null, max },
    },
    test1Max: t1.max,
    test2Max: t2.max,
    testsMarkMax: (t1.max || 0) + (t2.max || 0),
    obtained: hasAny ? obtained : null,
    max,
    total: hasAny ? obtained : null,
    totalMax: max,
  };
}

function subjectContribution(subjectEntry) {
  if (subjectEntry.flexible) {
    return {
      obtained: subjectEntry.total ?? subjectEntry.columns?.total?.score ?? 0,
      max: subjectEntry.max ?? subjectEntry.columns?.total?.max ?? 0,
      hasAny: subjectEntry.obtained != null,
    };
  }
  const hasAny = subjectEntry.assessments?.some((r) => r.score != null) ?? false;
  const obtained = subjectEntry.assessments?.reduce((s, r) => s + (r.score ?? 0), 0) ?? 0;
  const max = subjectEntry.assessments?.reduce((s, r) => s + r.max, 0) ?? 0;
  return { obtained, max, hasAny };
}

function grandTotalFromSubjects(subjectEntries) {
  let obtained = 0;
  let max = 0;
  let hasAny = false;

  for (const subject of subjectEntries) {
    const { obtained: subObtained, max: subMax, hasAny: subHasAny } = subjectContribution(subject);
    if (subHasAny) {
      obtained += subObtained;
      max += subMax;
      hasAny = true;
    } else if (subMax > 0) {
      max += subMax;
    }
  }

  return { obtained: hasAny ? obtained : 0, max, hasAny };
}

async function computeClassRank(db, { classId, studentId, term, subjects, config, assessmentsBySubject }) {
  const students = await db.student.findMany({
    where: { classId },
    select: { id: true },
  });
  if (!students.length) return { place: null, totalStudents: 0 };

  const subjectIds = subjects.map((s) => s.id);
  const allMarks = await db.mark.findMany({
    where: {
      term,
      subjectId: { in: subjectIds },
      studentId: { in: students.map((s) => s.id) },
    },
  });

  const marksByStudent = new Map();
  for (const m of allMarks) {
    if (!marksByStudent.has(m.studentId)) marksByStudent.set(m.studentId, []);
    marksByStudent.get(m.studentId).push(m);
  }

  const rankings = students.map((st) => {
    const markMap = new Map();
    for (const m of marksByStudent.get(st.id) || []) {
      markMap.set(`${m.subjectId}:${m.assessment}:${m.catNumber}`, m);
    }

    const subjectEntries = subjects.map((subject) => {
      const assessments = assessmentsBySubject.get(subject.id) || [];
      if (assessments.length) {
        return buildFlexibleSubject(subject, assessments, markMap);
      }
      return buildLegacySubject(subject, config, markMap);
    });

    const { obtained, max, hasAny } = grandTotalFromSubjects(subjectEntries);
    const pct = max > 0 ? (obtained / max) * 100 : 0;
    return { studentId: st.id, obtained, max, pct, hasAny };
  });

  rankings.sort((a, b) => b.pct - a.pct || b.obtained - a.obtained);
  const idx = rankings.findIndex((r) => r.studentId === studentId);
  return {
    place: idx >= 0 ? idx + 1 : null,
    totalStudents: students.length,
  };
}

function buildDomainColumns(subjects) {
  const flexible = subjects.some((s) => s.flexible);
  if (flexible) {
    const tests = subjects.reduce((acc, subject) => {
      if (subject.flexible) {
        acc.max += subject.columns?.tests?.max ?? 0;
        acc.score += subject.columns?.tests?.score ?? 0;
      } else {
        const legacyTests = (subject.columns?.test1?.max ?? 0) + (subject.columns?.test2?.max ?? 0);
        const legacyTestScore = (subject.columns?.test1?.score ?? 0) + (subject.columns?.test2?.score ?? 0);
        acc.max += legacyTests;
        acc.score += legacyTestScore;
      }
      return acc;
    }, { score: 0, max: 0 });

    const exam = subjects.reduce((acc, subject) => {
      if (subject.flexible) {
        acc.max += subject.columns?.exam?.max ?? 0;
        acc.score += subject.columns?.exam?.score ?? 0;
      } else {
        acc.max += subject.columns?.exam?.max ?? 0;
        acc.score += subject.columns?.exam?.score ?? 0;
      }
      return acc;
    }, { score: 0, max: 0 });

    const total = {
      score: tests.score + exam.score,
      max: tests.max + exam.max,
    };

    return {
      flexible: true,
      tests,
      exam,
      total,
      test1: {
        score: subjects.reduce((s, sub) => s + (sub.columns?.test1?.score ?? 0), 0),
        max: subjects.reduce((s, sub) => s + (sub.columns?.test1?.max ?? 0), 0),
      },
      test2: {
        score: subjects.reduce((s, sub) => s + (sub.columns?.test2?.score ?? 0), 0),
        max: subjects.reduce((s, sub) => s + (sub.columns?.test2?.max ?? 0), 0),
      },
    };
  }

  const domainScoreT1 = subjects.reduce((s, sub) => s + (sub.columns?.test1?.score ?? 0), 0);
  const domainScoreT2 = subjects.reduce((s, sub) => s + (sub.columns?.test2?.score ?? 0), 0);
  const domainScoreEx = subjects.reduce((s, sub) => s + (sub.columns?.exam?.score ?? 0), 0);
  const domainMaxT1 = subjects.reduce((s, sub) => s + (sub.columns?.test1?.max ?? 0), 0);
  const domainMaxT2 = subjects.reduce((s, sub) => s + (sub.columns?.test2?.max ?? 0), 0);
  const domainMaxEx = subjects.reduce((s, sub) => s + (sub.columns?.exam?.max ?? 0), 0);
  const domainObtained = subjects.reduce((s, sub) => s + (sub.columns?.total?.score ?? 0), 0);
  const domainMax = subjects.reduce((s, sub) => s + (sub.columns?.total?.max ?? 0), 0);

  return {
    flexible: false,
    test1: { score: domainScoreT1, max: domainMaxT1 },
    test2: { score: domainScoreT2, max: domainMaxT2 },
    exam: { score: domainScoreEx, max: domainMaxEx },
    total: { score: domainMax ? domainObtained : null, max: domainMax },
  };
}

function sumDomainColumns(domains, flexible) {
  if (flexible) {
    return {
      flexible: true,
      tests: {
        score: domains.reduce((sum, d) => sum + (d.domainColumns.tests?.score ?? 0), 0),
        max: domains.reduce((sum, d) => sum + (d.domainColumns.tests?.max ?? 0), 0),
      },
      exam: {
        score: domains.reduce((sum, d) => sum + (d.domainColumns.exam?.score ?? 0), 0),
        max: domains.reduce((sum, d) => sum + (d.domainColumns.exam?.max ?? 0), 0),
      },
      total: {
        score: domains.reduce((sum, d) => sum + (d.domainColumns.total?.score ?? 0), 0),
        max: domains.reduce((sum, d) => sum + (d.domainColumns.total?.max ?? 0), 0),
      },
    };
  }
  return {
    flexible: false,
    test1: {
      score: domains.reduce((s, d) => s + (d.domainColumns.test1?.score || 0), 0),
      max: domains.reduce((s, d) => s + (d.domainColumns.test1?.max || 0), 0),
    },
    test2: {
      score: domains.reduce((s, d) => s + (d.domainColumns.test2?.score || 0), 0),
      max: domains.reduce((s, d) => s + (d.domainColumns.test2?.max || 0), 0),
    },
    exam: {
      score: domains.reduce((s, d) => s + (d.domainColumns.exam?.score || 0), 0),
      max: domains.reduce((s, d) => s + (d.domainColumns.exam?.max || 0), 0),
    },
    total: {
      score: domains.reduce((s, d) => s + (d.domainColumns.total?.score || 0), 0),
      max: domains.reduce((s, d) => s + (d.domainColumns.total?.max || 0), 0),
    },
  };
}

function totalsFromColumns(columns) {
  const max = columns.total?.max || 0;
  const obtained = columns.total?.score ?? 0;
  return {
    obtained: max ? obtained : null,
    max,
    percentage: max > 0 ? Math.round((obtained / max) * 1000) / 10 : null,
  };
}

export const PRIMARY_YEAR_TERMS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];

export function isAnnualBulletinTerm(term) {
  return /^(annuel|annual|ann[eé]e)$/i.test(String(term || '').trim());
}

function emptyCell() {
  return { score: null, max: 0 };
}

function addScoreCells(a, b) {
  const max = (a?.max || 0) + (b?.max || 0);
  const hasScore = a?.score != null || b?.score != null;
  const score = hasScore ? (a?.score || 0) + (b?.score || 0) : null;
  return { score: max ? score : null, max };
}

function midtermMaps(midterms) {
  const map = { mt1: new Map(), mt2: new Map() };
  (midterms?.mt1?.subjects || []).forEach((s) => map.mt1.set(s.subjectId, s));
  (midterms?.mt2?.subjects || []).forEach((s) => map.mt2.set(s.subjectId, s));
  return map;
}

function subjectPeriodCells(sub, midterms, courseMarkOnly) {
  if (midterms?.mt1 || midterms?.mt2) {
    const maps = midtermMaps(midterms);
    const m1 = maps.mt1.get(sub.id);
    const m2 = maps.mt2.get(sub.id);
    const exam = sub.columns?.exam || emptyCell();
    const fixedMax = Math.max(
      m1?.maxScore || 0,
      m2?.maxScore || 0,
      Number(sub.testsMarkMax) || 0,
      (Number(sub.test1Max) || 0) + (Number(sub.test2Max) || 0),
    );
    const mt1 = { score: m1?.obtained ?? null, max: fixedMax };
    const mt2 = { score: m2?.obtained ?? null, max: fixedMax };
    const continuous = mt2.score != null ? mt2 : mt1;
    return [mt1, mt2, exam, addScoreCells(continuous, exam)];
  }
  if (courseMarkOnly) {
    return [
      sub.columns?.tests || emptyCell(),
      sub.columns?.exam || emptyCell(),
      sub.columns?.total || emptyCell(),
    ];
  }
  return [
    sub.columns?.test1 || emptyCell(),
    sub.columns?.test2 || emptyCell(),
    sub.columns?.exam || emptyCell(),
    sub.columns?.total || emptyCell(),
  ];
}

function summaryPeriodCells(columns, midterms, courseMarkOnly, subjects) {
  if (midterms?.mt1 || midterms?.mt2) {
    return [0, 1, 2, 3].map((i) => subjects.reduce((acc, sub) => (
      addScoreCells(acc, subjectPeriodCells(sub, midterms, false)[i] || emptyCell())
    ), emptyCell()));
  }
  if (courseMarkOnly) {
    return [columns?.tests, columns?.exam, columns?.total].map((c) => c || emptyCell());
  }
  return [columns?.test1, columns?.test2, columns?.exam, columns?.total].map((c) => c || emptyCell());
}

function annualFromTermCells(termCellSets) {
  const totals = termCellSets.map((cells) => cells[cells.length - 1] || emptyCell());
  const max = totals.reduce((sum, col) => sum + (col.max || 0), 0);
  const hasScore = totals.some((col) => col.score != null);
  const score = hasScore ? totals.reduce((sum, col) => sum + (col.score || 0), 0) : null;
  return { score: max ? score : null, max };
}

async function computeAnnualClassRank(db, {
  classId, studentId, terms, subjects, config, assessmentsBySubject,
}) {
  const students = await db.student.findMany({
    where: { classId },
    select: { id: true },
  });
  if (!students.length) return { place: null, totalStudents: 0 };

  const subjectIds = subjects.map((s) => s.id);
  const allMarks = await db.mark.findMany({
    where: {
      term: { in: terms },
      subjectId: { in: subjectIds },
      studentId: { in: students.map((s) => s.id) },
    },
  });

  const rankings = students.map((st) => {
    let obtained = 0;
    let max = 0;
    let hasAny = false;
    for (const termName of terms) {
      const markMap = new Map();
      for (const m of allMarks) {
        if (m.studentId === st.id && m.term === termName) {
          markMap.set(`${m.subjectId}:${m.assessment}:${m.catNumber}`, m);
        }
      }
      const subjectEntries = subjects.map((subject) => {
        const assessments = assessmentsBySubject.get(subject.id) || [];
        if (assessments.length) return buildFlexibleSubject(subject, assessments, markMap);
        return buildLegacySubject(subject, config, markMap);
      });
      const tot = grandTotalFromSubjects(subjectEntries);
      obtained += tot.obtained;
      max += tot.max;
      hasAny = hasAny || tot.hasAny;
    }
    const pct = max > 0 ? (obtained / max) * 100 : 0;
    return { studentId: st.id, obtained, max, pct, hasAny };
  });

  rankings.sort((a, b) => b.pct - a.pct || b.obtained - a.obtained);
  const idx = rankings.findIndex((r) => r.studentId === studentId);
  return {
    place: idx >= 0 ? idx + 1 : null,
    totalStudents: students.length,
  };
}

async function buildAnnualClassBulletinReport(db, { classId, studentId, campusId, academicYearId }) {
  const slices = [];
  for (const termName of PRIMARY_YEAR_TERMS) {
    slices.push(await buildClassBulletinReport(db, {
      classId,
      studentId,
      term: termName,
      campusId,
      academicYearId,
    }));
  }

  const base = slices[0];
  const domains = base.domains.map((domain, domainIdx) => ({
    ...domain,
    subjects: domain.subjects.map((sub, subIdx) => {
      const termCells = slices.map((slice) => {
        const match = slice.domains[domainIdx]?.subjects[subIdx];
        return subjectPeriodCells(
          match || sub,
          slice.midterms,
          Boolean(slice.config?.courseMarkOnly),
        );
      });
      return {
        ...sub,
        year: {
          maxima: subjectPeriodCells(sub, null, false),
          terms: slices.map((slice, i) => ({
            term: slice.term,
            cells: termCells[i],
          })),
          annual: annualFromTermCells(termCells),
        },
      };
    }),
  }));

  const packSummary = (kind, sliceSubjects) => {
    const termCells = slices.map((slice) => summaryPeriodCells(
      slice.summary?.[kind]?.columns || slice.summary?.columns,
      slice.midterms,
      Boolean(slice.config?.courseMarkOnly),
      sliceSubjects(slice),
    ));
    return {
      maxima: summaryPeriodCells(
        slices[0].summary?.[kind]?.columns || slices[0].summary?.columns,
        null,
        false,
        sliceSubjects(slices[0]),
      ),
      terms: slices.map((slice, i) => ({
        term: slice.term,
        cells: termCells[i],
      })),
      annual: annualFromTermCells(termCells),
    };
  };

  const generalOf = (slice) => slice.domains.filter((d) => !d.excludeFromGeneral).flatMap((d) => d.subjects);
  const otherOf = (slice) => slice.domains.filter((d) => d.excludeFromGeneral).flatMap((d) => d.subjects);
  const allOf = (slice) => slice.domains.flatMap((d) => d.subjects);

  const yearSummary = {
    general: packSummary('general', generalOf),
    otherLanguages: packSummary('otherLanguages', otherOf),
    overall: packSummary('overall', allOf),
  };

  const cls = await db.class.findUnique({
    where: { id: classId },
    include: { subjects: true },
  });
  const config = resolveBulletinConfig(cls.bulletinConfig, cls.grade);
  const assessmentsBySubject = new Map();
  for (const subject of cls.subjects) {
    assessmentsBySubject.set(subject.id, await ensureSubjectAssessments(db, subject));
  }
  const generalSubjectIds = new Set(generalOf(base).map((s) => s.id));
  const generalSubjects = cls.subjects.filter((s) => generalSubjectIds.has(s.id));
  const rank = await computeAnnualClassRank(db, {
    classId,
    studentId,
    terms: PRIMARY_YEAR_TERMS,
    subjects: generalSubjects.length ? generalSubjects : cls.subjects,
    config,
    assessmentsBySubject,
  });
  const overallRank = otherOf(base).length
    ? await computeAnnualClassRank(db, {
      classId,
      studentId,
      terms: PRIMARY_YEAR_TERMS,
      subjects: cls.subjects,
      config,
      assessmentsBySubject,
    })
    : rank;

  const annualPct = yearSummary.general.annual.max
    ? Math.round(((yearSummary.general.annual.score || 0) / yearSummary.general.annual.max) * 1000) / 10
    : null;

  const issuedAt = base.meta?.issuedAt || new Date().toISOString();
  const verificationToken = createBulletinVerificationToken({
    studentId: base.student.id,
    studentCode: base.student.studentId,
    classId: base.class.id,
    term: 'Annuel',
    percentage: annualPct,
    place: rank.place,
    totalStudents: rank.totalStudents,
    academicYear: base.meta?.academicYear || '',
    issuedAt,
  });

  return {
    ...base,
    term: 'Annuel',
    annual: true,
    domains,
    rank,
    overallRank,
    midterms: null,
    year: {
      terms: slices.map((slice) => ({
        term: slice.term,
        rank: slice.rank,
        overallRank: slice.overallRank,
        midterms: slice.midterms,
        courseMarkOnly: Boolean(slice.config?.courseMarkOnly),
      })),
      summary: yearSummary,
    },
    summary: {
      ...base.summary,
      obtained: yearSummary.general.annual.score,
      max: yearSummary.general.annual.max,
      percentage: annualPct,
    },
    verification: {
      token: verificationToken,
      verifyUrl: buildVerifyUrl(verificationToken),
    },
  };
}

export async function buildClassBulletinReport(db, { classId, studentId, term, campusId, academicYearId }) {
  if (isAnnualBulletinTerm(term)) {
    return buildAnnualClassBulletinReport(db, { classId, studentId, campusId, academicYearId });
  }
  const cls = await db.class.findUnique({
    where: { id: classId },
    include: {
      students: {
        where: { id: studentId },
        take: 1,
        include: {
          documents: {
            where: { docType: 'PHOTO' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      subjects: { orderBy: [{ categoryOrder: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }] },
      teacher: { select: { name: true } },
    },
  });
  if (!cls) throw new Error('Class not found');
  const student = cls.students[0];
  if (!student) throw new Error('Student not found in this class');

  const config = resolveBulletinConfig(cls.bulletinConfig, cls.grade);
  const assessmentsBySubject = new Map();
  for (const subject of cls.subjects) {
    const assessments = await ensureSubjectAssessments(db, subject);
    assessmentsBySubject.set(subject.id, assessments);
  }

  const marks = await db.mark.findMany({
    where: {
      studentId,
      term,
      subjectId: { in: cls.subjects.map((s) => s.id) },
    },
  });

  const markMap = new Map();
  for (const m of marks) {
    markMap.set(`${m.subjectId}:${m.assessment}:${m.catNumber}`, m);
  }

  const grouped = groupCoursesByCategory(cls.subjects);
  const curriculum = getCurriculum(cls.grade);
  const domainMetaByName = new Map((curriculum?.domains || []).map((d) => [d.name, d]));
  const domains = [];
  let usesFlexibleTests = false;
  const pairedPeriodes = cls.subjects.every((s) => Number(s.test1Max) > 0 && Number(s.test2Max) > 0);

  for (const group of grouped) {
    const subjects = group.courses.map((subject) => {
      const assessments = assessmentsBySubject.get(subject.id) || [];
      if (assessments.length) {
        usesFlexibleTests = true;
        return buildFlexibleSubject(subject, assessments, markMap);
      }
      return buildLegacySubject(subject, config, markMap);
    });

    const domainColumns = buildDomainColumns(subjects);
    const domainObtained = subjects.reduce((sum, sub) => sum + (sub.obtained ?? 0), 0);
    const domainMax = subjects.reduce((sum, sub) => sum + (sub.max ?? 0), 0);
    const meta = domainMetaByName.get(group.category) || {};
    const excludeFromGeneral = Boolean(meta.excludeFromGeneral)
      || /autres langues/i.test(group.category || '');

    domains.push({
      category: group.category,
      categoryOrder: group.categoryOrder,
      subjects,
      domainObtained: domainMax ? domainObtained : null,
      domainMax,
      domainColumns,
      excludeFromGeneral,
      subtotalGroup: meta.subtotalGroup || null,
      subtotalLabel: meta.subtotalLabel || 'Sous-total',
    });
  }

  const generalDomains = domains.filter((d) => !d.excludeFromGeneral);
  const otherLanguageDomains = domains.filter((d) => d.excludeFromGeneral);
  const layoutFlexible = usesFlexibleTests && !pairedPeriodes;
  const generalColumns = sumDomainColumns(generalDomains, layoutFlexible);
  const otherLanguageColumns = sumDomainColumns(otherLanguageDomains, layoutFlexible);
  const overallColumns = sumDomainColumns(domains, layoutFlexible);
  const generalTotals = totalsFromColumns(generalColumns);
  const overallTotals = totalsFromColumns(overallColumns);

  const generalSubjects = generalDomains.flatMap((d) => d.subjects).map((s) => cls.subjects.find((c) => c.id === s.id)).filter(Boolean);
  const allSubjects = cls.subjects;

  const percentage = generalTotals.percentage;
  const rank = await computeClassRank(db, {
    classId,
    studentId,
    term,
    subjects: generalSubjects.length ? generalSubjects : allSubjects,
    config,
    assessmentsBySubject,
  });
  const overallRank = otherLanguageDomains.length
    ? await computeClassRank(db, {
      classId,
      studentId,
      term,
      subjects: allSubjects,
      config,
      assessmentsBySubject,
    })
    : rank;

  const photoUrl = loadPhotoDataUrl(student.documents || []);
  const issuedAt = new Date().toISOString();

  let meta = null;
  let academicYearName = '';
  if (campusId) {
    const [campus, school, year, directorName] = await Promise.all([
      db.campus.findUnique({ where: { id: campusId } }),
      db.schoolProfile.findFirst(),
      academicYearId ? db.academicYear.findUnique({ where: { id: academicYearId } }) : null,
      resolveDirectorName(db),
    ]);
    academicYearName = year?.name || '';
    meta = {
      schoolName: school?.name || 'École La RACINE',
      campusName: campus?.name || '',
      city: campus?.city || school?.city || '',
      district: campus?.district || school?.district || '',
      province: campus?.province || school?.province || '',
      country: campus?.country || school?.country || 'RWANDA',
      academicYear: academicYearName,
      classTeacher: cls.teacher?.name || '',
      directorName,
      issuedAt,
    };
  }

  const verificationToken = createBulletinVerificationToken({
    studentId: student.id,
    studentCode: student.studentId,
    classId: cls.id,
    term,
    percentage,
    place: rank.place,
    totalStudents: rank.totalStudents,
    academicYear: academicYearName,
    issuedAt,
  });

  const summaryColumns = generalColumns;

  let midterms = null;
  if (isPrimaryGrade(cls.grade) && campusId && academicYearId) {
    midterms = await getPublishedMidtermsForTerm({
      campusId,
      academicYearId,
      term,
      studentId,
    });
  }

  return {
    class: { id: cls.id, name: cls.name, grade: cls.grade, section: cls.section },
    student: {
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      postName: student.postName,
      fatherName: student.fatherName || null,
      motherName: student.motherName || null,
      parentName: student.parentName || null,
    },
    term,
    config: {
      preset: config.preset,
      label: config.label,
      assessments: config.assessments,
      flexibleTests: usesFlexibleTests,
      courseMarkOnly: layoutFlexible,
    },
    domains,
    summary: {
      obtained: generalTotals.obtained,
      max: generalTotals.max,
      percentage,
      columns: summaryColumns,
      general: {
        ...generalTotals,
        columns: generalColumns,
      },
      otherLanguages: {
        ...totalsFromColumns(otherLanguageColumns),
        columns: otherLanguageColumns,
      },
      overall: {
        ...overallTotals,
        columns: overallColumns,
      },
    },
    rank,
    overallRank,
    midterms,
    meta,
    photoUrl,
    verification: {
      token: verificationToken,
      verifyUrl: buildVerifyUrl(verificationToken),
    },
  };
}
