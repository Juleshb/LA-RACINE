/** Nursery grades that use Excel competence bulletins (Petite / Moyenne / Grande). */
export const NURSERY_GRADES = ['CRECHE', 'N1', 'N2', 'N3', 'TOP'];

export function isNurseryGrade(grade) {
  return NURSERY_GRADES.includes(grade);
}
