const LEGACY_TEST_KEYS = ['TEST1', 'TEST2'];

export function assessmentStepId(assessment, catNumber) {
  if (assessment === 'TEST' && catNumber > 0) return `TEST:${catNumber}`;
  return assessment;
}

export function parseAssessmentStepId(stepId) {
  if (typeof stepId === 'string' && stepId.startsWith('TEST:')) {
    const catNumber = Number(stepId.split(':')[1]);
    return { assessment: 'TEST', catNumber: Number.isInteger(catNumber) && catNumber > 0 ? catNumber : 1 };
  }
  return { assessment: stepId, catNumber: 0 };
}

function isExamAssessment(row) {
  return row.label?.trim().toLowerCase() === 'exam';
}

export function filterTestAssessments(assessments) {
  return (assessments || []).filter((row) => !isExamAssessment(row));
}

export async function ensureSubjectAssessments(db, subject) {
  const existing = await db.subjectAssessment.findMany({
    where: { subjectId: subject.id },
    orderBy: { sortOrder: 'asc' },
  });

  const testsOnly = filterTestAssessments(existing);
  if (testsOnly.length > 0) {
    if (testsOnly.length !== existing.length) {
      await db.subjectAssessment.deleteMany({
        where: { subjectId: subject.id, label: { equals: 'Exam', mode: 'insensitive' } },
      });
    }
    return testsOnly;
  }

  const tests = [];
  if (subject.test1Max != null && subject.test1Max > 0) {
    tests.push({ label: 'Test 1', maxScore: subject.test1Max, sortOrder: 1, date: null });
  }
  if (subject.test2Max != null && subject.test2Max > 0) {
    tests.push({ label: 'Test 2', maxScore: subject.test2Max, sortOrder: 2, date: null });
  }
  if (!tests.length) return [];

  await db.subjectAssessment.createMany({
    data: tests.map((t) => ({ subjectId: subject.id, ...t })),
  });

  return db.subjectAssessment.findMany({
    where: { subjectId: subject.id },
    orderBy: { sortOrder: 'asc' },
  });
}

export function resolveTestsMarkMax(subject) {
  if (subject.testsMarkMax != null && subject.testsMarkMax > 0) return subject.testsMarkMax;
  if (subject.test1Max != null && subject.test2Max != null) {
    return Number(subject.test1Max) + Number(subject.test2Max);
  }
  if (subject.totalMax != null && subject.examMax != null && subject.totalMax > subject.examMax) {
    return subject.totalMax - subject.examMax;
  }
  return 0;
}

export function resolveExamMax(subject) {
  if (subject.examMax != null && subject.examMax > 0) return subject.examMax;
  if (subject.test1Max != null && subject.test2Max != null) {
    return Number(subject.test1Max) + Number(subject.test2Max);
  }
  return 0;
}

export function resolveTotalMax(subject) {
  const testsMax = resolveTestsMarkMax(subject);
  const examMax = resolveExamMax(subject);
  if (testsMax > 0 || examMax > 0) return testsMax + examMax;
  if (subject.totalMax != null && subject.totalMax > 0) return subject.totalMax;
  return 0;
}

export function getMarkForTest(markMap, subjectId, sortOrder) {
  const testMark = markMap.get(`${subjectId}:TEST:${sortOrder}`);
  if (testMark) return testMark;
  const legacyKey = LEGACY_TEST_KEYS[sortOrder - 1];
  if (legacyKey) {
    return markMap.get(`${subjectId}:${legacyKey}:0`) || null;
  }
  return null;
}

export function getExamMark(markMap, subjectId) {
  return markMap.get(`${subjectId}:EX:0`)
    || markMap.get(`${subjectId}:EXAM:0`)
    || null;
}

export function buildTestRows(subject, assessments, markMap) {
  return filterTestAssessments(assessments).map((a) => {
    const mark = getMarkForTest(markMap, subject.id, a.sortOrder);
    return {
      id: a.id,
      sortOrder: a.sortOrder,
      label: a.label,
      maxScore: a.maxScore,
      date: a.date ?? null,
      score: mark?.score ?? null,
      max: a.maxScore,
    };
  });
}

export function calculateScaledMark(rows, targetMax) {
  const max = targetMax > 0 ? targetMax : 0;
  const entered = rows.filter((t) => t.score != null);
  if (!entered.length || max <= 0) {
    return { score: null, max, rawObtained: 0, rawMax: 0 };
  }

  const rawObtained = entered.reduce((sum, t) => sum + t.score, 0);
  const rawMax = entered.reduce((sum, t) => sum + t.max, 0);
  if (rawMax <= 0) {
    return { score: null, max, rawObtained: 0, rawMax: 0 };
  }

  const scaled = Math.round((rawObtained / rawMax) * max * 100) / 100;
  return { score: scaled, max, rawObtained, rawMax };
}

export function buildSubjectMarkSummary(subject, assessments, markMap) {
  const testRows = buildTestRows(subject, assessments, markMap);
  const testsMarkMax = resolveTestsMarkMax(subject);
  const examMax = resolveExamMax(subject);
  const testsCombined = calculateScaledMark(testRows, testsMarkMax);
  const examMark = getExamMark(markMap, subject.id);
  const exam = { score: examMark?.score ?? null, max: examMax };
  const hasTests = testRows.some((t) => t.score != null);
  const hasExam = exam.score != null;
  const hasAny = hasTests || hasExam;
  const totalMax = resolveTotalMax(subject);
  const totalScore = hasAny
    ? Math.round(((testsCombined.score ?? 0) + (exam.score ?? 0)) * 100) / 100
    : null;

  return {
    testRows,
    testsCombined,
    exam,
    total: { score: totalScore, max: totalMax },
    hasAny,
  };
}

export function assessmentsToSteps(assessments, subject) {
  const steps = filterTestAssessments(assessments).map((a) => ({
    key: assessmentStepId('TEST', a.sortOrder),
    assessment: 'TEST',
    catNumber: a.sortOrder,
    label: a.label,
    maxScore: a.maxScore,
    date: a.date ?? null,
    sortOrder: a.sortOrder,
  }));

  const examMax = resolveExamMax(subject);
  if (examMax > 0) {
    steps.push({
      key: 'EX',
      assessment: 'EX',
      catNumber: 0,
      label: 'Exam',
      maxScore: examMax,
    });
  }

  return steps;
}

// Backward compatibility for older imports.
export function calculateCourseMark(testRows, courseMarkMax) {
  return calculateScaledMark(testRows, courseMarkMax);
}

export function resolveCourseMarkMax(subject) {
  return resolveTotalMax(subject);
}
