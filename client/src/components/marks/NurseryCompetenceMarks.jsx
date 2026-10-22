import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  Loader2,
  CheckCircle2,
  Cloud,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Users,
} from 'lucide-react';
import Modal from '../form/Modal';
import { api } from '../../lib/api';
import { studentFullName } from '../../lib/studentName';

const AUTO_SAVE_DELAY_MS = 1200;
const DEFAULT_LETTERS = ['A', 'B', 'C', 'D'];
const DEFAULT_LABELS = {
  A: 'Très bon travail',
  B: 'Bon travail',
  C: 'Moyen',
  D: 'Doit fournir des efforts',
};

function keyOf(subjectId, studentId) {
  return `${subjectId}:${studentId}`;
}

function LetterPicker({ value, letters, labels, onChange, compact }) {
  return (
    <div className={`nc-letter-picker ${compact ? 'is-compact' : ''}`} role="group">
      {letters.map((letter) => {
        const active = value === letter;
        return (
          <button
            key={letter}
            type="button"
            className={`nc-letter-btn letter-${letter.toLowerCase()} ${active ? 'is-active' : ''}`}
            title={labels?.[letter] || letter}
            aria-pressed={active}
            onClick={() => onChange(active ? '' : letter)}
          >
            {letter}
          </button>
        );
      })}
      {value && (
        <button
          type="button"
          className="nc-letter-clear"
          title="Effacer"
          aria-label="Effacer la note"
          onClick={() => onChange('')}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Nursery competence recorder — modal UI aligned with Marks create/resume flow.
 */
export default function NurseryCompetenceMarks({
  open,
  onClose,
  onSaved,
  classId,
  className,
  term,
  t,
}) {
  const [data, setData] = useState(null);
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [collapsedDomains, setCollapsedDomains] = useState({});
  const [focusStudentId, setFocusStudentId] = useState('');

  const lastSavedRef = useRef('');
  const hydratedRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const savingRef = useRef(false);

  const letters = data?.letters || DEFAULT_LETTERS;
  const gradeLabels = data?.gradeLabels || DEFAULT_LABELS;

  const load = useCallback(async () => {
    if (!open || !classId || !term) {
      setData(null);
      setRecords({});
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.getCompetenceMarks(classId, term);
      setData(result);
      const next = {};
      for (const domain of result.domains || []) {
        for (const sub of domain.subdomains || []) {
          for (const item of sub.items || []) {
            for (const [studentId, letter] of Object.entries(item.grades || {})) {
              if (letter) next[keyOf(item.id, studentId)] = letter;
            }
          }
        }
      }
      setRecords(next);
      lastSavedRef.current = JSON.stringify(next);
      hydratedRef.current = true;
      setAutoSaveStatus('idle');
      setCollapsedDomains({});
      setStudentFilter('');
      setStudentSearch('');
    } catch (err) {
      setError(err.message || t('pages.marks.noCompetencesTitle'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [open, classId, term, t]);

  useEffect(() => {
    hydratedRef.current = false;
    load();
  }, [load]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(''), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  const allStudents = data?.students || [];

  const students = useMemo(() => {
    let list = allStudents;
    if (studentFilter) {
      list = list.filter((s) => s.id === studentFilter);
    } else if (studentSearch.trim()) {
      const q = studentSearch.trim().toLowerCase();
      list = list.filter((s) => {
        const name = `${s.firstName || ''} ${s.lastName || ''} ${s.postName || ''}`.toLowerCase();
        return name.includes(q);
      });
    }
    return list;
  }, [allStudents, studentFilter, studentSearch]);

  const flatItems = useMemo(() => {
    const rows = [];
    for (const domain of data?.domains || []) {
      const collapsed = Boolean(collapsedDomains[domain.category]);
      let itemCount = 0;
      for (const sub of domain.subdomains || []) {
        itemCount += (sub.items || []).length;
      }
      rows.push({
        type: 'domain',
        key: domain.category,
        title: domain.category,
        itemCount,
        collapsed,
      });
      if (collapsed) continue;
      for (const sub of domain.subdomains || []) {
        if (sub.name) {
          rows.push({ type: 'subdomain', key: `${domain.category}-${sub.name}`, title: sub.name });
        }
        for (const item of sub.items || []) {
          rows.push({ type: 'item', key: item.id, item, domain: domain.category });
        }
      }
    }
    return rows;
  }, [data, collapsedDomains]);

  const skillItems = useMemo(() => {
    const items = [];
    for (const domain of data?.domains || []) {
      for (const sub of domain.subdomains || []) {
        for (const item of sub.items || []) items.push(item);
      }
    }
    return items;
  }, [data]);

  const progress = useMemo(() => {
    const studentList = studentFilter
      ? allStudents.filter((s) => s.id === studentFilter)
      : allStudents;
    const total = skillItems.length * studentList.length;
    if (!total) return { filled: 0, total: 0, pct: 0 };
    let filled = 0;
    for (const item of skillItems) {
      for (const st of studentList) {
        if (records[keyOf(item.id, st.id)]) filled += 1;
      }
    }
    return {
      filled,
      total,
      pct: Math.round((filled / total) * 100),
    };
  }, [skillItems, allStudents, studentFilter, records]);

  const persist = useCallback(async (nextRecords, { silent = false } = {}) => {
    if (!classId || !data || !term) return;
    const payload = [];
    for (const domain of data.domains || []) {
      for (const sub of domain.subdomains || []) {
        for (const item of sub.items || []) {
          for (const st of data.students || []) {
            const k = keyOf(item.id, st.id);
            const letter = nextRecords[k] || null;
            const prev = JSON.parse(lastSavedRef.current || '{}')[k] || null;
            if (letter !== prev) {
              payload.push({ subjectId: item.id, studentId: st.id, letter });
            }
          }
        }
      }
    }
    if (!payload.length) {
      setAutoSaveStatus('saved');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    if (!silent) setMessage('');
    setAutoSaveStatus('saving');
    try {
      await api.saveCompetenceMarks({ classId, term, records: payload });
      lastSavedRef.current = JSON.stringify(nextRecords);
      setAutoSaveStatus('saved');
      if (!silent) setMessage(t('pages.marks.competenceSaved'));
      onSaved?.();
    } catch (err) {
      setAutoSaveStatus('error');
      setError(err.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [classId, data, term, t, onSaved]);

  useEffect(() => {
    if (!open || !hydratedRef.current || !classId) return undefined;
    const serialized = JSON.stringify(records);
    if (serialized === lastSavedRef.current) return undefined;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (savingRef.current) return;
      persist(records, { silent: true });
    }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [records, classId, open, persist]);

  const setLetter = (subjectId, studentId, letter) => {
    setRecords((prev) => {
      const next = { ...prev };
      const k = keyOf(subjectId, studentId);
      if (!letter) delete next[k];
      else next[k] = letter;
      return next;
    });
    setAutoSaveStatus('idle');
    setFocusStudentId(studentId);
  };

  const fillStudentColumn = (studentId, letter) => {
    if (!letter || !skillItems.length) return;
    setRecords((prev) => {
      const next = { ...prev };
      for (const item of skillItems) {
        next[keyOf(item.id, studentId)] = letter;
      }
      return next;
    });
    setAutoSaveStatus('idle');
    setMessage(t('pages.marks.competenceFillColumn', { letter }));
  };

  const toggleDomain = (category) => {
    setCollapsedDomains((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const autoSaveLabel = {
    idle: null,
    saving: t('pages.marks.autosaveSaving'),
    saved: t('pages.marks.autosaveSaved'),
    error: t('pages.marks.autosaveError'),
  }[autoSaveStatus];

  const AutoSaveIcon = autoSaveStatus === 'saving' ? Loader2
    : autoSaveStatus === 'saved' ? CheckCircle2
      : Cloud;

  const titleClass = className || data?.className || '—';

  return (
    <Modal open={open} onClose={onClose} size="2xl">
      <div className="pm-competence-modal">
        <div className="pm-competence-modal-header">
          <div>
            <p className="pm-kicker">{t('pages.marks.nurseryCompetence')}</p>
            <h2 className="pm-view-title">{titleClass}</h2>
            <p className="pm-view-meta">{term} · A / B / C / D</p>
          </div>
          <div className="flex items-center gap-2">
            {autoSaveLabel && (
              <span className={`autosave-status autosave-status-${autoSaveStatus}`}>
                <AutoSaveIcon className={`w-3.5 h-3.5 ${autoSaveStatus === 'saving' ? 'animate-spin' : ''}`} />
                {autoSaveLabel}
              </span>
            )}
            <button type="button" className="pm-create-close" onClick={onClose} aria-label={t('ui.close')}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="pm-competence-modal-toolbar">
          <div className="pm-view-stats !px-0 !py-0">
            <div className="pm-view-stat">
              <span className="pm-view-stat-value">{progress.filled}/{progress.total}</span>
              <span className="pm-view-stat-label">{t('pages.marks.enteredShort')}</span>
            </div>
            <div className="pm-view-stat">
              <span className="pm-view-stat-value">{progress.pct}%</span>
              <span className="pm-view-stat-label">{t('pages.marks.completion')}</span>
            </div>
            <div className="pm-view-stat">
              <span className="pm-view-stat-value">{skillItems.length}</span>
              <span className="pm-view-stat-label">{t('pages.marks.competences')}</span>
            </div>
            <div className="pm-view-stat">
              <span className="pm-view-stat-value">{allStudents.length}</span>
              <span className="pm-view-stat-label">{t('pages.marks.statStudents')}</span>
            </div>
          </div>

          <div className="nc-legend">
            {letters.map((letter) => (
              <div key={letter} className={`nc-legend-item letter-${letter.toLowerCase()}`}>
                <span className="nc-legend-letter">{letter}</span>
                <span className="nc-legend-text">{gradeLabels[letter] || letter}</span>
              </div>
            ))}
          </div>

          <div className="pm-competence-filters">
            <label className="pm-create-field">
              <span className="pm-create-label flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {t('ui.student')}
              </span>
              <select
                className="pm-create-input"
                value={studentFilter}
                onChange={(e) => {
                  setStudentFilter(e.target.value);
                  setStudentSearch('');
                }}
              >
                <option value="">{t('pages.marks.allStudents')}</option>
                {allStudents.map((s) => (
                  <option key={s.id} value={s.id}>{studentFullName(s)}</option>
                ))}
              </select>
            </label>
            <label className="pm-create-field">
              <span className="pm-create-label">{t('ui.search')}</span>
              <div className="nc-search">
                <Search className="w-4 h-4" />
                <input
                  type="search"
                  placeholder={t('pages.marks.filterStudents')}
                  value={studentSearch}
                  disabled={Boolean(studentFilter)}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
            </label>
          </div>
        </div>

        <div className="pm-competence-modal-body">
          {error && (
            <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">{error}</div>
          )}
          {message && !error && (
            <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm">{message}</div>
          )}

          {loading ? (
            <div className="pm-empty">
              <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
              <p>{t('pages.marks.loadingCompetence')}</p>
            </div>
          ) : !data?.domains?.length ? (
            <div className="pm-empty">
              <p className="font-medium text-gray-700">{t('pages.marks.noCompetencesTitle')}</p>
              <p className="text-sm text-gray-500 max-w-md">{t('pages.marks.noCompetencesBody')}</p>
            </div>
          ) : students.length === 0 ? (
            <div className="pm-empty">
              <p>{t('ui.noSearchResults')}</p>
              <button
                type="button"
                className="btn-secondary text-sm mt-2"
                onClick={() => { setStudentFilter(''); setStudentSearch(''); }}
              >
                {t('pages.marks.showAllStudents')}
              </button>
            </div>
          ) : (
            <div className="nc-grid-card !shadow-none !border-0">
              <div className="nc-grid-hint">{t('pages.marks.competenceGridHint')}</div>
              <div className="nc-grid-scroll">
                <table className="nc-grid-table">
                  <thead>
                    <tr>
                      <th className="nc-skill-col">{t('pages.marks.competenceCol')}</th>
                      {students.map((s) => (
                        <th
                          key={s.id}
                          className={`nc-student-col ${focusStudentId === s.id ? 'is-focus' : ''}`}
                        >
                          <div className="nc-student-head">
                            <span className="nc-student-name" title={studentFullName(s)}>
                              {studentFullName(s)}
                            </span>
                            <div className="nc-fill-row" title={t('pages.marks.fillColumn')}>
                              {letters.map((letter) => (
                                <button
                                  key={letter}
                                  type="button"
                                  className={`nc-fill-btn letter-${letter.toLowerCase()}`}
                                  onClick={() => fillStudentColumn(s.id, letter)}
                                >
                                  {letter}
                                </button>
                              ))}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {flatItems.map((row) => {
                      if (row.type === 'domain') {
                        return (
                          <tr key={row.key} className="nc-domain-row">
                            <td colSpan={1 + students.length}>
                              <button
                                type="button"
                                className="nc-domain-toggle"
                                onClick={() => toggleDomain(row.key)}
                              >
                                {row.collapsed
                                  ? <ChevronRight className="w-4 h-4" />
                                  : <ChevronDown className="w-4 h-4" />}
                                <span>{row.title}</span>
                                <em>{row.itemCount}</em>
                              </button>
                            </td>
                          </tr>
                        );
                      }
                      if (row.type === 'subdomain') {
                        return (
                          <tr key={row.key} className="nc-subdomain-row">
                            <td colSpan={1 + students.length}>{row.title}</td>
                          </tr>
                        );
                      }
                      const item = row.item;
                      return (
                        <tr key={item.id} className="nc-item-row">
                          <td className="nc-skill-col">
                            <span className="nc-skill-name">{item.name}</span>
                          </td>
                          {students.map((s) => {
                            const value = records[keyOf(item.id, s.id)] || '';
                            return (
                              <td
                                key={s.id}
                                className={`nc-grade-cell ${focusStudentId === s.id ? 'is-focus' : ''} ${value ? `has-${value.toLowerCase()}` : ''}`}
                              >
                                <LetterPicker
                                  value={value}
                                  letters={letters}
                                  labels={gradeLabels}
                                  onChange={(letter) => setLetter(item.id, s.id, letter)}
                                  compact
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="pm-create-footer pm-create-footer-responsive">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('ui.close')}
          </button>
          <button
            type="button"
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            disabled={saving || loading || !data?.domains?.length}
            onClick={() => persist(records)}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('ui.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
