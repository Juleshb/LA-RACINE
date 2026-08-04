import { Search } from 'lucide-react';

/** Shared list search field (reuses Users page styles). */
export default function ListSearch({ value, onChange, placeholder, className = '' }) {
  return (
    <div className={`users-search-wrap ${className}`.trim()}>
      <Search className="users-search-icon" aria-hidden />
      <input
        className="users-search-input"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

/** Case-insensitive match against one or more text parts. */
export function matchesSearch(query, ...parts) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = parts
    .flat()
    .filter((p) => p != null && p !== '')
    .map((p) => String(p).toLowerCase())
    .join(' ');
  return haystack.includes(q);
}
