import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Save, Loader2, CheckCircle2, Cloud, Calendar, GraduationCap, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import PageHeader from '../PageHeader';

const AUTO_SAVE_DELAY_MS = 1200;

function keyOf(subjectId, studentId) {
  return `${subjectId}:${studentId}`;
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

  const lastSavedRef = useRef('');
  const hydratedRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const savingRef = useRef(false);

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

  const students = useMemo(() => {
    const list = data?.students || [];
    if (!studentFilter) return list;
    return list.filter((s) => s.id === studentFilter);
  }, [data, studentFilter]);

  const flatItems = useMemo(() => {
    const rows = [];
    for (const domain of data?.domains || []) {
      rows.push({ type: 'domain', key: domain.category, title: domain.category });
      for (const sub of domain.subdomains || []) {
        if (sub.name) {
          rows.push({ type: 'subdomain', key: `${domain.category}-${sub.name}`, title: sub.name });
        }
        for (const item of sub.items || []) {
          rows.push({ type: 'item', key: item.id, item });
        }
      }
    }
    return rows;
  }, [data]);

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
      if (!silent) setMessage('Competence grades saved');
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

  return (
    <div>
      <PageHeader
        title={isTeacher ? t('pages.marks.titleTeacher') : t('pages.marks.title')}
        description="Nursery competence grades (A / B / C / D) — Excel bulletin template"
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

      <div className="filter-panel mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-gray-400" /> {t('ui.class')}
            </label>
            <select className="input" value={classId} onChange={(e) => onClassChange(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" /> Period
            </label>
            <select className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
              {(data?.terms || ['Trimestre 1', 'Trimestre 2', 'Trimestre 3', 'Annuel']).map((tr) => (
                <option key={tr} value={tr}>{tr}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-gray-400" /> {t('ui.student')}
            </label>
            <select className="input" value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
              <option value="">All students</option>
              {(data?.students || []).map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </div>
        </div>
        {data?.gradeLabels && (
          <p className="text-xs text-gray-500 mt-3">
            A = {data.gradeLabels.A} · B = {data.gradeLabels.B} · C = {data.gradeLabels.C} · D = {data.gradeLabels.D}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}
      {message && !error && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{message}</div>
      )}

      {!classId ? (
        <div className="card empty-state">
          <p className="text-gray-500">Select a nursery class to enter competence grades.</p>
        </div>
      ) : loading ? (
        <div className="card empty-state">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-2" />
          <p className="text-gray-500">Loading competence grid…</p>
        </div>
      ) : !data?.domains?.length ? (
        <div className="card empty-state">
          <p className="text-gray-500 mb-2">No competence skills loaded for this class.</p>
          <p className="text-sm text-gray-400">
            Skills load automatically from the Excel nursery templates. Refresh the page, or open Courses → Load bulletin courses.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="pb-2 pr-3 font-medium min-w-[280px]">Skill / élément du programme</th>
                {students.map((s) => (
                  <th key={s.id} className="pb-2 px-1 font-medium text-center min-w-[72px]">
                    <span className="block truncate max-w-[88px]" title={`${s.firstName} ${s.lastName}`}>
                      {s.firstName}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flatItems.map((row) => {
                if (row.type === 'domain') {
                  return (
                    <tr key={row.key} className="bg-gray-100">
                      <td colSpan={1 + students.length} className="py-2 px-2 font-semibold text-gray-800">
                        {row.title}
                      </td>
                    </tr>
                  );
                }
                if (row.type === 'subdomain') {
                  return (
                    <tr key={row.key} className="bg-gray-50">
                      <td colSpan={1 + students.length} className="py-1.5 px-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {row.title}
                      </td>
                    </tr>
                  );
                }
                const item = row.item;
                return (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 text-gray-800 align-middle">{item.name}</td>
                    {students.map((s) => (
                      <td key={s.id} className="py-1 px-1 text-center">
                        <select
                          className="input py-1 px-1 text-center text-sm min-w-[64px]"
                          value={records[keyOf(item.id, s.id)] || ''}
                          onChange={(e) => setLetter(item.id, s.id, e.target.value)}
                        >
                          <option value="">—</option>
                          {(data.letters || ['A', 'B', 'C', 'D']).map((letter) => (
                            <option key={letter} value={letter}>{letter}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
