import { buildAllCurricula, GRADE_LABELS } from './bulletin.js';

export const CURRICULA_BY_GRADE = buildAllCurricula();

/** @deprecated use CURRICULA_BY_GRADE.P1 */
export const P1_CURRICULUM = CURRICULA_BY_GRADE.P1;

const GRADE_ALIASES = {
  N1: 'M1',
  N2: 'M2',
  N3: 'M3',
  CRECHE: 'M1',
};

export function normalizeCurriculumGrade(grade) {
  const key = String(grade || '').trim().toUpperCase();
  return GRADE_ALIASES[key] || key;
}

export function getCurriculum(grade) {
  const key = String(grade || '').trim().toUpperCase();
  if (!key) return null;
  return CURRICULA_BY_GRADE[key]
    || CURRICULA_BY_GRADE[GRADE_ALIASES[key]]
    || null;
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
