/**
 * Duplicate detection for student registration / Excel import.
 * Match key: campus + lastName + postName + firstName + dateOfBirth (normalized).
 */

export function normalizePersonName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeDob(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return raw;
}

export function studentDuplicateKey({ lastName, postName, firstName, dateOfBirth }) {
  return [
    normalizePersonName(lastName),
    normalizePersonName(postName),
    normalizePersonName(firstName),
    normalizeDob(dateOfBirth),
  ].join('|');
}

export function buildDuplicateIndex(students = []) {
  const index = new Map();
  for (const s of students) {
    const key = studentDuplicateKey(s);
    if (!key || key === '|||') continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(s);
  }
  return index;
}
