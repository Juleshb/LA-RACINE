export function getMaxForAssessment(course, assessment) {
  if (!course) return assessment.fallbackMax || 100;
  if (assessment.maxScore != null && assessment.maxScore > 0) return assessment.maxScore;
  if (assessment.maxField === 'custom' && assessment.customMax) return assessment.customMax;
  const fromSubject = assessment.maxField ? course[assessment.maxField] : null;
  if (fromSubject != null && fromSubject > 0) return fromSubject;
  return assessment.fallbackMax || 100;
}

export function parseAssessmentStepId(stepId) {
  if (typeof stepId === 'string' && stepId.startsWith('TEST:')) {
    const catNumber = Number(stepId.split(':')[1]);
    return { assessment: 'TEST', catNumber: Number.isInteger(catNumber) && catNumber > 0 ? catNumber : 1 };
  }
  if (stepId === 'TEST1') return { assessment: 'TEST1', catNumber: 1 };
  if (stepId === 'TEST2') return { assessment: 'TEST2', catNumber: 2 };
  return { assessment: stepId, catNumber: 0 };
}

/** First test in a period keeps the period number. Extra tests use period * 100 + test index. */
export function encodePeriodTestCatNumber(periodNumber, testIndex) {
  const period = Math.max(1, Math.trunc(Number(periodNumber) || 1));
  const test = Math.min(99, Math.max(1, Math.trunc(Number(testIndex) || 1)));
  if (test <= 1) return period;
  return period * 100 + test;
}

export function decodePeriodTestCatNumber(catNumber) {
  const n = Number(catNumber) || 0;
  if (n >= 100) {
    const period = Math.floor(n / 100);
    const test = n % 100;
    if (period >= 1 && test >= 2) return { period, test };
  }
  if (n > 0) return { period: n, test: 1 };
  return { period: 0, test: 0 };
}

/** Stored mark catNumber for the period/test the user is recording. */
export function selectionCatNumber(assessmentKey, testIndex) {
  const parsed = parseAssessmentStepId(assessmentKey);
  if (parsed.assessment === 'CAT') return Math.max(1, Number(testIndex) || 1);
  if (parsed.assessment === 'TEST') return encodePeriodTestCatNumber(parsed.catNumber, testIndex);
  if (parsed.assessment === 'TEST1' || parsed.assessment === 'TEST2') {
    const test = Math.min(99, Math.max(1, Math.trunc(Number(testIndex) || 1)));
    return test <= 1 ? 0 : test;
  }
  return 0;
}

export function courseUsesBulletinScale(course) {
  return Boolean(
    course?.totalMax
    || course?.testsMarkMax
    || course?.test1Max
    || course?.assessments?.length,
  );
}

export function getAssessmentsForCourse(course, classConfig) {
  if (course?.assessments?.length) {
    const steps = course.assessments
      .filter((a) => a.label?.trim().toLowerCase() !== 'exam')
      .map((a) => ({
        key: `TEST:${a.sortOrder}`,
        assessment: 'TEST',
        catNumber: a.sortOrder,
        label: a.label,
        maxScore: a.maxScore,
        date: a.date ?? null,
        sortOrder: a.sortOrder,
      }));

    const examMax = Number(course.examMax) || 0;
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
  if (!courseUsesBulletinScale(course)) {
    return [{ key: 'SCORE', label: 'Note', maxField: 'totalMax', fallbackMax: 100 }];
  }
  return classConfig?.assessments || [];
}

export const DEFAULT_TERMS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
