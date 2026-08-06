import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { matchesSearch } from './ListSearch';
import { useTranslation } from '../context/LanguageContext';

function defaultLabel(s) {
  const name = [s.firstName, s.lastName].filter(Boolean).join(' ').trim() || s.name || '';
  const id = s.studentId ? ` · ${s.studentId}` : '';
  const cls = s.class?.name || s.className ? ` — ${s.class?.name || s.className}` : '';
  return `${name}${id}${cls}`.trim() || s.id;
}

/**
 * Searchable student picker (combobox).
 * Drop-in replacement for <select> listing students.
 */
export default function StudentSelect({
  students = [],
  value = '',
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  required = false,
  disabled = false,
  allowEmpty = true,
  className = '',
  getLabel = defaultLabel,
  id,
  name,
}) {
  const { t } = useTranslation();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => students.find((s) => String(s.id) === String(value)) || null,
    [students, value],
  );

  const filtered = useMemo(() => {
    return students.filter((s) =>
      matchesSearch(
        query,
        s.firstName,
        s.lastName,
        s.name,
        s.studentId,
        s.class?.name,
        s.className,
      ),
    );
  }, [students, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const emptyText = emptyLabel || placeholder || t('ui.select');
  const searchText = searchPlaceholder || t('ui.searchStudent');

  const pick = (idValue) => {
    onChange?.(idValue);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={`student-select ${className}`.trim()} ref={rootRef}>
      {required && (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden
          required
          value={value || ''}
          onChange={() => {}}
          className="student-select-native"
          name={name}
        />
      )}
      <button
        type="button"
        id={id}
        className={`student-select-trigger input ${open ? 'is-open' : ''} ${!selected ? 'is-placeholder' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className="student-select-value">
          {selected ? getLabel(selected) : emptyText}
        </span>
        <ChevronDown className="student-select-chevron" aria-hidden />
      </button>

      {open && (
        <div className="student-select-panel" role="listbox">
          <div className="student-select-search">
            <Search className="student-select-search-icon" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              className="student-select-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchText}
              aria-label={searchText}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                  setQuery('');
                }
                if (e.key === 'Enter' && filtered.length === 1) {
                  e.preventDefault();
                  pick(filtered[0].id);
                }
              }}
            />
            {query ? (
              <button
                type="button"
                className="student-select-clear"
                onClick={() => setQuery('')}
                aria-label={t('ui.close')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
          <ul className="student-select-list">
            {allowEmpty && (
              <li>
                <button
                  type="button"
                  className={`student-select-option ${!value ? 'is-active' : ''}`}
                  onClick={() => pick('')}
                >
                  {emptyText}
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="student-select-empty">{t('ui.noSearchResults')}</li>
            ) : (
              filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={String(s.id) === String(value)}
                    className={`student-select-option ${String(s.id) === String(value) ? 'is-active' : ''}`}
                    onClick={() => pick(s.id)}
                  >
                    {getLabel(s)}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
