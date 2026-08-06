import { useMemo, useState, useCallback } from 'react';

/** Compare two primitive-ish values for table sorting. */
export function compareSortValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null || a === '') return 1;
  if (b == null || b === '') return -1;

  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return 0;
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return a - b;
  }

  const aDate = a instanceof Date ? a : null;
  const bDate = b instanceof Date ? b : null;
  if (aDate && bDate) return aDate.getTime() - bDate.getTime();

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/**
 * Sort rows by a column key using getValue(row, key).
 */
export function sortRows(rows, sortKey, sortDir, getValue) {
  if (!rows?.length || !sortKey || !getValue) return rows || [];
  const dir = sortDir === 'desc' ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const cmp = compareSortValues(getValue(a, sortKey), getValue(b, sortKey));
    if (cmp !== 0) return cmp * dir;
    return 0;
  });
}

/**
 * Hook: sortKey / sortDir / toggleSort + sorted rows.
 */
export function useTableSort(rows, getValue, options = {}) {
  const { initialKey = '', initialDir = 'asc' } = options;
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState(initialDir);

  const toggleSort = useCallback((key) => {
    if (!key) return;
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const sorted = useMemo(
    () => sortRows(rows, sortKey, sortDir, getValue),
    [rows, sortKey, sortDir, getValue],
  );

  return { sorted, sortKey, sortDir, toggleSort, setSortKey, setSortDir };
}

// Re-export JSX component for convenient single import path
export { SortableTh } from './SortableTh.jsx';
