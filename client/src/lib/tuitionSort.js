import { studentFullName } from './studentName.js';

const GRADE_ORDER = ['CRECHE', 'N1', 'N2', 'N3', 'M1', 'M2', 'M3', 'TOP', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

function personOf(item) {
  return item?.student || item || {};
}

function classInfo(item) {
  return personOf(item).class || {};
}

export function compareTuitionClass(a, b) {
  const left = classInfo(a);
  const right = classInfo(b);
  const leftRank = GRADE_ORDER.indexOf(String(left.grade || '').toUpperCase());
  const rightRank = GRADE_ORDER.indexOf(String(right.grade || '').toUpperCase());
  const rank = (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank);
  if (rank) return rank;
  const name = String(left.name || '').localeCompare(String(right.name || ''), undefined, {
    sensitivity: 'base',
    numeric: true,
  });
  if (name) return name;
  return String(left.section || '').localeCompare(String(right.section || ''), undefined, { sensitivity: 'base' });
}

export function compareTuitionName(a, b) {
  return studentFullName(personOf(a)).localeCompare(studentFullName(personOf(b)), undefined, { sensitivity: 'base' });
}

/** mode: "name" is A–Z. "class" groups by class, then A–Z inside the class. */
export function sortTuitionPeople(items, mode = 'class') {
  return [...items].sort((a, b) => {
    if (mode === 'class') {
      const byClass = compareTuitionClass(a, b);
      if (byClass) return byClass;
    }
    return compareTuitionName(a, b);
  });
}
