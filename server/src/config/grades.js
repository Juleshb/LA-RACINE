export const PRIMARY_GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
export const NURSERY_GRADES = ['CRECHE', 'N1', 'N2', 'N3'];

export function isPrimaryGrade(grade) {
  return PRIMARY_GRADES.includes(grade);
}
