import { resolveBulletinConfig, getMaxForAssessment, subjectUsesBulletinScale } from '../config/bulletinPresets.js';
import { groupCoursesByCategory } from './curriculum.js';
import { loadPhotoDataUrl } from './studentRegistration.js';
import { createBulletinVerificationToken, buildVerifyUrl } from './bulletinVerification.js';
import {
  buildTestRows,
  buildSubjectMarkSummary,
  ensureSubjectAssessments,
} from './subjectAssessments.js';

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
      exam: summary.exam,
      total: summary.total,
    },
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

export async function buildClassBulletinReport(db, { classId, studentId, term, campusId, academicYearId }) {
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
  const domains = [];
  let grandObtained = 0;
  let grandMax = 0;
  let usesFlexibleTests = false;

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

    grandObtained += domainObtained;
    grandMax += domainMax;

    domains.push({
      category: group.category,
      categoryOrder: group.categoryOrder,
      subjects,
      domainObtained: domainMax ? domainObtained : null,
      domainMax,
      domainColumns,
    });
  }

  const percentage = grandMax > 0 ? Math.round((grandObtained / grandMax) * 1000) / 10 : null;
  const rank = await computeClassRank(db, {
    classId,
    studentId,
    term,
    subjects: cls.subjects,
    config,
    assessmentsBySubject,
  });

  const photoUrl = loadPhotoDataUrl(student.documents || []);
  const issuedAt = new Date().toISOString();

  let meta = null;
  let academicYearName = '';
  if (campusId) {
    const [campus, school, year] = await Promise.all([
      db.campus.findUnique({ where: { id: campusId } }),
      db.schoolProfile.findFirst(),
      academicYearId ? db.academicYear.findUnique({ where: { id: academicYearId } }) : null,
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

  const summaryColumns = usesFlexibleTests
    ? {
        flexible: true,
        tests: {
          score: domains.reduce((sum, d) => sum + (d.domainColumns.tests?.score ?? 0), 0),
          max: domains.reduce((sum, d) => sum + (d.domainColumns.tests?.max ?? 0), 0),
        },
        exam: {
          score: domains.reduce((sum, d) => sum + (d.domainColumns.exam?.score ?? 0), 0),
          max: domains.reduce((sum, d) => sum + (d.domainColumns.exam?.max ?? 0), 0),
        },
        total: { score: grandMax ? grandObtained : null, max: grandMax },
      }
    : {
        flexible: false,
        test1: {
          score: domains.reduce((s, d) => s + (d.domainColumns.test1?.score || 0), 0),
          max: domains.reduce((s, d) => s + d.domainColumns.test1?.max, 0),
        },
        test2: {
          score: domains.reduce((s, d) => s + (d.domainColumns.test2?.score || 0), 0),
          max: domains.reduce((s, d) => s + d.domainColumns.test2?.max, 0),
        },
        exam: {
          score: domains.reduce((s, d) => s + (d.domainColumns.exam?.score || 0), 0),
          max: domains.reduce((s, d) => s + d.domainColumns.exam?.max, 0),
        },
        total: { score: grandMax ? grandObtained : null, max: grandMax },
      };

  return {
    class: { id: cls.id, name: cls.name, grade: cls.grade, section: cls.section },
    student: {
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      postName: student.postName,
    },
    term,
    config: {
      preset: config.preset,
      label: config.label,
      assessments: config.assessments,
      flexibleTests: usesFlexibleTests,
      courseMarkOnly: usesFlexibleTests,
    },
    domains,
    summary: {
      obtained: grandMax ? grandObtained : null,
      max: grandMax,
      percentage,
      columns: summaryColumns,
    },
    rank,
    meta,
    photoUrl,
    verification: {
      token: verificationToken,
      verifyUrl: buildVerifyUrl(verificationToken),
    },
  };
}
