import { buildAllCurricula, GRADE_LABELS } from './bulletin.js';

export const CURRICULA_BY_GRADE = buildAllCurricula();

/** @deprecated use CURRICULA_BY_GRADE.P1 */
export const P1_CURRICULUM = CURRICULA_BY_GRADE.P1;

export function getCurriculum(grade) {
  return CURRICULA_BY_GRADE[grade] || null;
}

export function listCurricula() {
  return Object.values(CURRICULA_BY_GRADE).map((c) => ({
    grade: c.grade,
    label: c.label,
    domainCount: c.domains.length,
    subjectCount: c.domains.reduce((n, d) => n + d.subjects.length, 0),
    grandTotalMax: c.grandTotalMax,
  }));
}

export function getCurriculumDomains(grade) {
  return getCurriculum(grade)?.domains || [];
}

export { GRADE_LABELS };
