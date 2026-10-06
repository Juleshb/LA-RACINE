/** Nursery grades that use Excel competence bulletins (Petite / Moyenne / Grande). */
export const NURSERY_GRADES = [
  'M1', 'M2', 'M3', 'TOP',
  'CRECHE', 'N1', 'N2', 'N3',
];

export const PRIMARY_GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

/** Crèche uses the competence bulletin built from the courses on the class. */
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

/** Nursery competence marks + bulletin from the official template (excludes Crèche). */
export function usesNurseryCompetence(grade) {
  return isNurseryGrade(grade) && !isCrecheGrade(grade);
}

/** Competence bulletin (A/B/C/D), including Crèche courses added on the class. */
export function usesCompetenceBulletin(grade) {
  return usesNurseryCompetence(grade) || isCrecheGrade(grade);
}

export function usesMarksAndBulletin(grade) {
  return isPrimaryGrade(grade) || usesCompetenceBulletin(grade);
}
