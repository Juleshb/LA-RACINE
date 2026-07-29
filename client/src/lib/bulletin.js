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
  return { assessment: stepId, catNumber: 0 };
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
