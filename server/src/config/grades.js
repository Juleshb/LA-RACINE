export const PRIMARY_GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

/** Official nursery grades (M1–M3 + Top) plus legacy codes still in DB. */
export const NURSERY_GRADES = [
  'M1', 'M2', 'M3', 'TOP',
  'CRECHE', 'N1', 'N2', 'N3',
];

/** Crèche: attendance/care only — no marks and no bulletin. */
export const CRECHE_GRADES = ['CRECHE'];

export function isPrimaryGrade(grade) {
  return PRIMARY_GRADES.includes(grade);
}

export function isNurseryGrade(grade) {
  return NURSERY_GRADES.includes(grade);
}

export function isCrecheGrade(grade) {
  const g = String(grade || '').trim().toUpperCase();
  return CRECHE_GRADES.includes(g) || g === 'CRECHE' || g === 'CRÈCHE';
}

/** Nursery classes that use A/B/C/D competence marks + bulletin (excludes Crèche). */
export function usesNurseryCompetence(grade) {
  return isNurseryGrade(grade) && !isCrecheGrade(grade);
}

/** Any class that records academic marks / bulletins. */
export function usesMarksAndBulletin(grade) {
  return isPrimaryGrade(grade) || usesNurseryCompetence(grade);
}
