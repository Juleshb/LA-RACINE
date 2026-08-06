/** Nursery grades that use Excel competence bulletins (Petite / Moyenne / Grande). */
export const NURSERY_GRADES = [
  'M1', 'M2', 'M3', 'TOP',
  'CRECHE', 'N1', 'N2', 'N3',
];

export const PRIMARY_GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

/** Crèche: no marks recording and no bulletin. */
export const CRECHE_GRADES = ['CRECHE'];

export function isNurseryGrade(grade) {
  return NURSERY_GRADES.includes(grade);
}

export function isPrimaryGrade(grade) {
  return PRIMARY_GRADES.includes(grade);
}

export function isCrecheGrade(grade) {
  const g = String(grade || '').trim().toUpperCase();
  return CRECHE_GRADES.includes(g) || g === 'CRECHE' || g === 'CRÈCHE';
}

/** Nursery competence marks + bulletin (excludes Crèche). */
export function usesNurseryCompetence(grade) {
  return isNurseryGrade(grade) && !isCrecheGrade(grade);
}

export function usesMarksAndBulletin(grade) {
  return isPrimaryGrade(grade) || usesNurseryCompetence(grade);
}
