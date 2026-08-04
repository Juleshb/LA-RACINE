/** Nursery grades that use Excel competence bulletins (Petite / Moyenne / Grande). */
export const NURSERY_GRADES = [
  'M1', 'M2', 'M3', 'TOP',
  'CRECHE', 'N1', 'N2', 'N3',
];

export function isNurseryGrade(grade) {
  return NURSERY_GRADES.includes(grade);
}
