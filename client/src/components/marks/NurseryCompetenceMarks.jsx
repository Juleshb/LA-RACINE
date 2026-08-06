import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  Loader2,
  CheckCircle2,
  Cloud,
  Calendar,
  GraduationCap,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import PageHeader from '../PageHeader';

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

export default function NurseryCompetenceMarks({
  campusId,
  classes,
  classId,
  onClassChange,
  t,
  isTeacher,
}) {
  const [term, setTerm] = useState('Trimestre 1');
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
    if (!classId) {
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
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [classId, term]);

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
    if (!classId || !data) return;
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
      if (!silent) setMessage('Notes de compétence enregistrées');
    } catch (err) {
      setAutoSaveStatus('error');
      setError(err.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [classId, data, term]);

  useEffect(() => {
    if (!hydratedRef.current || !classId) return undefined;
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
  }, [records, classId, persist]);

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
    setMessage(`Colonne remplie avec ${letter} pour cet élève`);
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

  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <div className="nc-page">
      <PageHeader
        title={isTeacher ? t('pages.marks.titleTeacher') : t('pages.marks.title')}
        description="Notes de compétence maternelle (A / B / C / D) — saisie rapide pour le bulletin"
        action={(
          <div className="flex gap-2 flex-wrap items-center">
            {autoSaveLabel && (
              <span className={`autosave-status autosave-status-${autoSaveStatus}`}>
                <AutoSaveIcon className={`w-3.5 h-3.5 ${autoSaveStatus === 'saving' ? 'animate-spin' : ''}`} />
                {autoSaveLabel}
              </span>
            )}
            {!isTeacher && (
              <Link to={`/campus/${campusId}/bulletin-report`} className="btn-secondary">
                Bulletin
              </Link>
            )}
            <button
              type="button"
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
              disabled={saving || !classId}
              onClick={() => persist(records)}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('ui.save')}
            </button>
          </div>
        )}
      />

      <section className="nc-toolbar card">
        <div className="nc-toolbar-grid">
          <div>
            <label className="label flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-brand-600" /> {t('ui.class')}
            </label>
            <select className="input" value={classId} onChange={(e) => onClassChange(e.target.value)}>
              <option value="">Choisir une classe nursery…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-600" /> Période
            </label>
            <div className="nc-term-segment" role="tablist">
              {(data?.terms || ['Trimestre 1', 'Trimestre 2', 'Trimestre 3', 'Annuel']).map((tr) => (
                <button
                  key={tr}
                  type="button"
                  role="tab"
                  aria-selected={term === tr}
                  className={`nc-term-btn ${term === tr ? 'is-active' : ''}`}
                  onClick={() => setTerm(tr)}
                >
                  {tr === 'Annuel' ? 'Annuel' : tr.replace('Trimestre ', 'T')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-brand-600" /> Élève
            </label>
            <select
              className="input"
              value={studentFilter}
              onChange={(e) => {
                setStudentFilter(e.target.value);
                setStudentSearch('');
              }}
            >
              <option value="">Tous les élèves</option>
              {allStudents.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="nc-toolbar-secondary">
          <div className="nc-search">
            <Search className="w-4 h-4" />
            <input
              type="search"
              placeholder="Filtrer les colonnes élèves…"
              value={studentSearch}
              disabled={Boolean(studentFilter)}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
          </div>

          <div className="nc-legend">
            {letters.map((letter) => (
              <div key={letter} className={`nc-legend-item letter-${letter.toLowerCase()}`}>
                <span className="nc-legend-letter">{letter}</span>
                <span className="nc-legend-text">{gradeLabels[letter] || letter}</span>
              </div>
            ))}
          </div>
        </div>

        {classId && skillItems.length > 0 && (
          <div className="nc-progress">
            <div className="nc-progress-meta">
              <span>
                Progression · {selectedClass?.name || 'Classe'} · {term}
              </span>
              <strong>{progress.filled}/{progress.total} ({progress.pct}%)</strong>
            </div>
            <div className="nc-progress-track" aria-hidden="true">
              <div className="nc-progress-fill" style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">{error}</div>
      )}
      {message && !error && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm">{message}</div>
      )}

      {!classId ? (
        <div className="nc-empty card">
          <GraduationCap className="w-10 h-10 text-gray-300" />
          <p>Choisissez une classe nursery pour saisir les compétences.</p>
        </div>
      ) : loading ? (
        <div className="nc-empty card">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p>Chargement de la grille de compétences…</p>
        </div>
      ) : !data?.domains?.length ? (
        <div className="nc-empty card">
          <p className="font-medium text-gray-700">Aucune compétence chargée pour cette classe.</p>
          <p className="text-sm text-gray-500 max-w-md">
            Les compétences viennent des modèles Excel nursery. Actualisez la page, ou ouvrez Cours → Charger les cours du bulletin.
          </p>
        </div>
      ) : students.length === 0 ? (
        <div className="nc-empty card">
          <p>Aucun élève ne correspond au filtre.</p>
          <button
            type="button"
            className="btn-secondary text-sm mt-1"
            onClick={() => { setStudentFilter(''); setStudentSearch(''); }}
          >
            Réinitialiser le filtre
          </button>
        </div>
      ) : (
        <div className="nc-grid-card">
          <div className="nc-grid-hint">
            Cliquez <strong>A / B / C / D</strong> pour noter. Cliquez à nouveau pour désélectionner.
            Sur l’en-tête élève, utilisez « Remplir » pour appliquer une lettre à toutes les compétences.
          </div>
          <div className="nc-grid-scroll">
            <table className="nc-grid-table">
              <thead>
                <tr>
                  <th className="nc-skill-col">Compétence / élément</th>
                  {students.map((s) => (
                    <th
                      key={s.id}
                      className={`nc-student-col ${focusStudentId === s.id ? 'is-focus' : ''}`}
                    >
                      <div className="nc-student-head">
                        <span className="nc-student-name" title={`${s.firstName} ${s.lastName}`}>
                          {s.firstName}
                        </span>
                        <span className="nc-student-last">{s.lastName}</span>
                        <div className="nc-fill-row" title="Remplir toute la colonne">
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
                            <em>{row.itemCount} compétence{row.itemCount > 1 ? 's' : ''}</em>
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
  );
}
