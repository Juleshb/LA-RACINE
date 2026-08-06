import prisma from './prisma.js';
import { isPrimaryGrade } from '../config/grades.js';
import { DEFAULT_TERMS } from '../config/bulletinPresets.js';
import { dedupePhones, sendBulkSms } from './sms.js';
import { calculateScaledMark, resolveTestsMarkMax } from './subjectAssessments.js';

const EXCLUDED_ASSESSMENTS = new Set(['EX', 'Final', 'EXAM', 'EXAMEN']);

export const MIDTERM_MANAGER_ROLES = [
  'SCHOOL_MANAGER',
  'SCHOOL_ADMIN',
  'HEAD_OF_STUDIES',
];

export function canManageMidterms(role) {
  return MIDTERM_MANAGER_ROLES.includes(role);
}

export function endOfDay(dateInput) {
  const d = new Date(dateInput);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function markEffectiveDate(mark) {
  return mark.assessedOn || mark.createdAt;
}

export function isContinuousAssessment(assessment) {
  return !EXCLUDED_ASSESSMENTS.has(String(assessment || '').trim());
}

export function defaultMidtermTitle(sequence) {
  return sequence === 2 ? '2ème période' : '1ère période';
}

export function shortPeriodLabel(sequence) {
  return sequence === 2 ? 'P2' : 'P1';
}

/**
 * Cumulative window: all continuous marks in the term with effective date <= cutoff.
 * Midterm 2 includes Midterm 1 marks by design.
 */
export function markInMidtermWindow(mark, cutoffDate) {
  if (!isContinuousAssessment(mark.assessment)) return false;
  const effective = markEffectiveDate(mark);
  if (!effective) return false;
  return new Date(effective) <= endOfDay(cutoffDate);
}

/**
 * Average recorded continuous marks and scale to the subject’s fixed tests max.
 * MT1 and MT2 share the same MAXIMA (resolveTestsMarkMax).
 */
export function averageMarksToSubjectMax(subjectMarks, subject) {
  const targetMax = resolveTestsMarkMax(subject);
  const rows = (subjectMarks || [])
    .filter((m) => m.score != null && Number(m.maxScore) > 0)
    .map((m) => ({
      score: Number(m.score),
      max: Number(m.maxScore),
    }));

  const scaled = calculateScaledMark(rows, targetMax);
  return {
    obtained: scaled.score,
    maxScore: scaled.max,
    pct: scaled.max > 0 && scaled.score != null ? (scaled.score / scaled.max) * 100 : 0,
    hasAny: scaled.score != null,
    rawObtained: scaled.rawObtained,
    rawMax: scaled.rawMax,
  };
}

export async function listPrimaryClasses(campusId, academicYearId) {
  const classes = await prisma.class.findMany({
    where: { campusId, academicYearId },
    include: {
      subjects: {
        select: {
          id: true,
          name: true,
          code: true,
          test1Max: true,
          test2Max: true,
          testsMarkMax: true,
          examMax: true,
          totalMax: true,
        },
      },
      _count: { select: { students: true } },
    },
    orderBy: [{ grade: 'asc' }, { section: 'asc' }],
  });
  return classes.filter((c) => isPrimaryGrade(c.grade));
}

/**
 * Build and store MidtermResult + MidtermStanding for a published window.
 * Scores = average of continuous marks up to cutoff, scaled to subject tests max
 * (same MAXIMA for Midterm 1 and Midterm 2).
 */
export async function publishMidtermSnapshot(window, { publishedById }) {
  const primaryClasses = await listPrimaryClasses(window.campusId, window.academicYearId);
  const classIds = primaryClasses.map((c) => c.id);
  if (!classIds.length) {
    return { classes: 0, students: 0, results: 0 };
  }

  const students = await prisma.student.findMany({
    where: {
      campusId: window.campusId,
      academicYearId: window.academicYearId,
      classId: { in: classIds },
      registrationStatus: 'APPROVED',
    },
    select: { id: true, classId: true },
  });

  const subjectIds = primaryClasses.flatMap((c) => c.subjects.map((s) => s.id));
  const marks = subjectIds.length
    ? await prisma.mark.findMany({
      where: {
        term: window.term,
        subjectId: { in: subjectIds },
        studentId: { in: students.map((s) => s.id) },
      },
    })
    : [];

  const cutoff = window.cutoffDate;
  const eligibleMarks = marks.filter((m) => markInMidtermWindow(m, cutoff));

  await prisma.$transaction([
    prisma.midtermResult.deleteMany({ where: { windowId: window.id } }),
    prisma.midtermStanding.deleteMany({ where: { windowId: window.id } }),
  ]);

  const resultRows = [];
  const totalsByStudent = new Map();

  for (const student of students) {
    totalsByStudent.set(student.id, { obtained: 0, max: 0, classId: student.classId, hasAny: false });
  }

  const subjectsByClass = new Map();
  for (const cls of primaryClasses) {
    subjectsByClass.set(cls.id, cls.subjects);
  }

  for (const student of students) {
    const subjects = subjectsByClass.get(student.classId) || [];
    for (const subject of subjects) {
      const subjectMarks = eligibleMarks.filter(
        (m) => m.studentId === student.id && m.subjectId === subject.id,
      );
      const averaged = averageMarksToSubjectMax(subjectMarks, subject);
      if (!averaged.hasAny) continue;

      resultRows.push({
        windowId: window.id,
        studentId: student.id,
        subjectId: subject.id,
        classId: student.classId,
        obtained: averaged.obtained ?? 0,
        maxScore: averaged.maxScore,
        pct: averaged.pct,
      });

      const tot = totalsByStudent.get(student.id);
      tot.obtained += averaged.obtained ?? 0;
      tot.max += averaged.maxScore;
      tot.hasAny = true;
    }
  }

  if (resultRows.length) {
    await prisma.midtermResult.createMany({ data: resultRows });
  }

  const standingRows = [];
  for (const cls of primaryClasses) {
    const classStudents = students.filter((s) => s.classId === cls.id);
    // Same MAXIMA for every student: sum of subject continuous-tests maxima
    const classTestsMax = (cls.subjects || []).reduce((sum, sub) => sum + resolveTestsMarkMax(sub), 0);

    const rankings = classStudents.map((st) => {
      const tot = totalsByStudent.get(st.id);
      const maxScore = classTestsMax > 0 ? classTestsMax : tot.max;
      const obtained = tot.obtained;
      const pct = maxScore > 0 ? (obtained / maxScore) * 100 : 0;
      return {
        studentId: st.id,
        classId: cls.id,
        obtained,
        maxScore,
        pct,
        hasAny: tot.hasAny,
      };
    });
    rankings.sort((a, b) => b.pct - a.pct || b.obtained - a.obtained);
    rankings.forEach((row, index) => {
      standingRows.push({
        windowId: window.id,
        studentId: row.studentId,
        classId: row.classId,
        obtained: row.obtained,
        maxScore: row.maxScore,
        pct: row.pct,
        place: row.hasAny || row.maxScore > 0 ? index + 1 : null,
        totalStudents: classStudents.length,
      });
    });
  }

  if (standingRows.length) {
    await prisma.midtermStanding.createMany({ data: standingRows });
  }

  await prisma.midtermWindow.update({
    where: { id: window.id },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedById: publishedById || null,
    },
  });

  return {
    classes: primaryClasses.length,
    students: students.length,
    results: resultRows.length,
    standings: standingRows.length,
  };
}

export async function ensureMidtermWindows(campusId, academicYearId, term) {
  const existing = await prisma.midtermWindow.findMany({
    where: { campusId, academicYearId, term },
    orderBy: { sequence: 'asc' },
  });

  const toCreate = [];
  for (const sequence of [1, 2]) {
    if (existing.some((w) => w.sequence === sequence)) continue;
    toCreate.push({
      campusId,
      academicYearId,
      term,
      sequence,
      title: defaultMidtermTitle(sequence),
      cutoffDate: new Date(),
      status: 'DRAFT',
    });
  }
  if (toCreate.length) {
    await prisma.midtermWindow.createMany({ data: toCreate });
  }

  // Rename legacy English titles to French périodes
  const windows = await prisma.midtermWindow.findMany({
    where: { campusId, academicYearId, term },
    orderBy: { sequence: 'asc' },
  });
  for (const w of windows) {
    const wanted = defaultMidtermTitle(w.sequence);
    const isLegacy = /^midterm\s*[12]$/i.test(String(w.title || '').trim());
    if (isLegacy && w.title !== wanted) {
      await prisma.midtermWindow.update({ where: { id: w.id }, data: { title: wanted } });
      w.title = wanted;
    }
  }
  return windows;
}

export async function getPublishedMidtermsForTerm({ campusId, academicYearId, term, studentId }) {
  const windows = await prisma.midtermWindow.findMany({
    where: {
      campusId,
      academicYearId,
      term,
      status: 'PUBLISHED',
      sequence: { in: [1, 2] },
    },
    orderBy: { sequence: 'asc' },
  });

  const out = { mt1: null, mt2: null };
  for (const window of windows) {
    const standing = await prisma.midtermStanding.findUnique({
      where: {
        windowId_studentId: { windowId: window.id, studentId },
      },
    });
    const results = await prisma.midtermResult.findMany({
      where: { windowId: window.id, studentId },
      include: { subject: { select: { id: true, name: true, code: true } } },
    });
    const payload = {
      window: {
        id: window.id,
        sequence: window.sequence,
        title: window.title,
        cutoffDate: window.cutoffDate,
        publishedAt: window.publishedAt,
      },
      standing: standing
        ? {
          obtained: standing.obtained,
          maxScore: standing.maxScore,
          pct: standing.pct,
          place: standing.place,
          totalStudents: standing.totalStudents,
        }
        : null,
      subjects: results.map((r) => ({
        subjectId: r.subjectId,
        name: r.subject?.name,
        code: r.subject?.code,
        obtained: r.obtained,
        maxScore: r.maxScore,
        pct: r.pct,
      })),
    };
    if (window.sequence === 1) out.mt1 = payload;
    if (window.sequence === 2) out.mt2 = payload;
  }
  return out;
}

export async function notifyParentsMidtermPublished(window, { campusId, academicYearId }) {
  const primaryClasses = await listPrimaryClasses(campusId, academicYearId);
  const classIds = primaryClasses.map((c) => c.id);
  const students = await prisma.student.findMany({
    where: {
      campusId,
      academicYearId,
      classId: { in: classIds },
      registrationStatus: 'APPROVED',
    },
    select: {
      parentPhone: true,
      fatherPhone: true,
      motherPhone: true,
      parent: { select: { phone: true } },
      parentId: true,
    },
  });

  const parentIds = [...new Set(students.map((s) => s.parentId).filter(Boolean))];
  let userPhones = [];
  if (parentIds.length) {
    const users = await prisma.user.findMany({
      where: { parentId: { in: parentIds }, role: 'PARENT', isActive: true },
      select: { phone: true },
    });
    userPhones = users.map((u) => u.phone);
  }

  const raw = [];
  for (const s of students) {
    if (s.parent?.phone) raw.push(s.parent.phone);
    if (s.parentPhone) raw.push(s.parentPhone);
    if (s.fatherPhone) raw.push(s.fatherPhone);
    if (s.motherPhone) raw.push(s.motherPhone);
  }
  raw.push(...userPhones);

  const phones = dedupePhones(raw);
  const body = `La RACINE: les notes de la ${window.title} (${window.term}) sont disponibles sur le portail parents.`;
  return sendBulkSms({ recipients: phones, body });
}

export { DEFAULT_TERMS };
