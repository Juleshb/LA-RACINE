export const PRIMARY_GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

/** Official nursery grades (M1–M3 + Top) plus legacy codes still in DB. */
export const NURSERY_GRADES = [
  'M1', 'M2', 'M3', 'TOP',
  'CRECHE', 'N1', 'N2', 'N3',
];

export function isPrimaryGrade(grade) {
  return PRIMARY_GRADES.includes(grade);
}

export function isNurseryGrade(grade) {
  return NURSERY_GRADES.includes(grade);
}
