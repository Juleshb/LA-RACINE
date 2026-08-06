import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/** Clickable sortable table header cell. */
export function SortableTh({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSort,
  className = '',
  align = 'left',
}) {
  const active = sortKey === columnKey;
  const Icon = !active ? ArrowUpDown : (sortDir === 'asc' ? ArrowUp : ArrowDown);
  return (
    <th className={`${className}`.trim()}>
      <button
        type="button"
        className={`table-sort-btn ${active ? 'is-active' : ''} ${align === 'right' ? 'is-right' : ''} ${align === 'center' ? 'is-center' : ''}`}
        onClick={() => onSort?.(columnKey)}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
      </button>
    </th>
  );
}
