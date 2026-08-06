import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Info,
  Loader2,
  Save,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import { isPrimaryGrade } from '../lib/grades';
import { exportPeriodReportExcel, exportPeriodReportPdf } from '../lib/periodReportExport';

function formatDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatDateFr(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function periodCode(sequence) {
  return sequence === 2 ? 'P2' : 'P1';
}

function studentDisplayName(student) {
  return [student?.lastName, student?.postName, student?.firstName].filter(Boolean).join(' ');
}

function subjectMark(row, subjectId) {
  const mark = (row.subjects || []).find((s) => s.subjectId === subjectId);
  if (mark?.obtained == null) return null;
  return Number(mark.obtained);
}

function compareReportRows(a, b, sortKey) {
  if (sortKey === 'place') {
    return (a.standing?.place ?? 9999) - (b.standing?.place ?? 9999);
  }
  if (sortKey === 'student') {
    return studentDisplayName(a.student).localeCompare(studentDisplayName(b.student), 'fr', {
      sensitivity: 'base',
    });
  }
  if (sortKey === 'total') {
    return (a.standing?.obtained ?? -1) - (b.standing?.obtained ?? -1);
  }
  if (sortKey === 'pct') {
    return (a.standing?.pct ?? -1) - (b.standing?.pct ?? -1);
  }
  if (sortKey.startsWith('subj:')) {
    const subjectId = sortKey.slice(5);
    return (subjectMark(a, subjectId) ?? -1) - (subjectMark(b, subjectId) ?? -1);
  }
  return 0;
}

export default function Midterms() {
  const { user } = useAuth();
  const { campusId } = useCampus();
  const reportRef = useRef(null);

  const [term, setTerm] = useState('Trimestre 1');
  const [terms, setTerms] = useState(['Trimestre 1', 'Trimestre 2', 'Trimestre 3']);
  const [windows, setWindows] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [primaryClassCount, setPrimaryClassCount] = useState(0);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [publishingId, setPublishingId] = useState('');
  const [notifyParents, setNotifyParents] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [draftDates, setDraftDates] = useState({});
  const [exporting, setExporting] = useState('');
  const [reportLoadingId, setReportLoadingId] = useState('');
  const [reportQuery, setReportQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [sortKey, setSortKey] = useState('place');
  const [sortDir, setSortDir] = useState('asc');

  const isFamily = user?.role === 'PARENT' || user?.role === 'STUDENT';

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classes, classId],
  );

  const publishedCount = useMemo(
    () => windows.filter((w) => w.status === 'PUBLISHED').length,
    [windows],
  );

  const p1 = useMemo(() => windows.find((w) => w.sequence === 1) || null, [windows]);
  const p2 = useMemo(() => windows.find((w) => w.sequence === 2) || null, [windows]);

  const loadWindows = async (selectedTerm = term) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getMidtermWindows(selectedTerm);
      setWindows(data.windows || []);
      setTerms(data.terms || terms);
      setCanManage(Boolean(data.canManage) && !isFamily);
      setPrimaryClassCount(data.primaryClassCount || 0);
      const nextDrafts = {};
      (data.windows || []).forEach((w) => {
        nextDrafts[w.id] = formatDateInput(w.cutoffDate);
      });
      setDraftDates(nextDrafts);
    } catch (err) {
      setError(err.message || 'Impossible de charger les périodes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWindows(term);
  }, [campusId, term]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.getClasses()
      .then((list) => {
        const primary = (list || []).filter((c) => isPrimaryGrade(c.grade));
        setClasses(primary);
        if (primary.length && !classId) setClassId(primary[0].id);
      })
      .catch(console.error);
  }, [campusId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(t);
  }, [message]);

  const handleSaveDate = async (periodWindow) => {
    setSavingId(periodWindow.id);
    setError('');
    setMessage('');
    try {
      await api.updateMidtermWindow(periodWindow.id, {
        cutoffDate: draftDates[periodWindow.id],
        title: periodWindow.title,
      });
      setMessage(`${periodWindow.title} : date enregistrée. Publiez pour figer les notes.`);
      await loadWindows(term);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId('');
    }
  };

  const handlePublish = async (periodWindow) => {
    const cutoff = draftDates[periodWindow.id] || formatDateInput(periodWindow.cutoffDate);
    if (!confirm(
      `Publier la ${periodWindow.title} pour ${term} ?\n\nLes notes continues jusqu'au ${cutoff} seront moyennées sur le MAXIMA et figées.${periodWindow.sequence === 2 ? '\nLa P2 inclut les notes de la P1.' : ''}`,
    )) {
      return;
    }
    setPublishingId(periodWindow.id);
    setError('');
    setMessage('');
    try {
      if (draftDates[periodWindow.id] && draftDates[periodWindow.id] !== formatDateInput(periodWindow.cutoffDate)) {
        await api.updateMidtermWindow(periodWindow.id, {
          cutoffDate: draftDates[periodWindow.id],
          title: periodWindow.title,
        });
      }
      const result = await api.publishMidtermWindow(periodWindow.id, { notifyParents });
      let msg = `${periodWindow.title} publiée pour ${result.snapshot?.students || 0} élève(s).`;
      if (notifyParents && result.sms) {
        if (result.sms.error && !result.sms.sent) msg += ` SMS : ${result.sms.error}`;
        else msg += ` SMS : ${result.sms.sent} envoyé(s).`;
      }
      setMessage(msg);
      await loadWindows(term);
      if (classId) {
        const rep = await loadReport(periodWindow.id, classId);
        if (rep) {
          requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishingId('');
    }
  };

  const loadReport = async (windowId, selectedClassId = classId) => {
    if (!windowId || !selectedClassId) {
      setError('Choisissez d\'abord une classe primaire.');
      return null;
    }
    setError('');
    setReportLoadingId(windowId);
    try {
      const rep = await api.getMidtermReport(windowId, selectedClassId);
      setReport(rep);
      setReportQuery('');
      setSortKey('place');
      setSortDir('asc');
      requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return rep;
    } catch (err) {
      setError(err.message);
      setReport(null);
      return null;
    } finally {
      setReportLoadingId('');
    }
  };

  const handleExport = async (format, periodWindow) => {
    if (!classId || !periodWindow?.id) {
      setError('Choisissez une classe primaire avant d\'exporter.');
      return;
    }
    if (periodWindow.status && periodWindow.status !== 'PUBLISHED') {
      setError('Publiez la période avant d\'exporter le rapport.');
      return;
    }

    setExporting(`${format}-${periodWindow.id}`);
    setError('');
    setMessage('');
    try {
      let rep = report;
      const sameReport = report?.window?.id === periodWindow.id && report?.class?.id === classId;
      if (!sameReport) {
        rep = await loadReport(periodWindow.id, classId);
      }
      if (!rep?.rows) throw new Error('Impossible de charger le rapport de période');

      if (format === 'excel') exportPeriodReportExcel(rep);
      else exportPeriodReportPdf(rep);

      setMessage(
        format === 'excel'
          ? `Excel détaillé téléchargé — ${rep.class?.name || 'classe'}`
          : `Proclamation PDF téléchargée — ${rep.class?.name || 'classe'}`,
      );
    } catch (err) {
      console.error('Period export failed:', err);
      setError(err.message || 'Échec de l\'export');
    } finally {
      setExporting('');
    }
  };

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'student' ? 'asc' : 'desc');
    if (key === 'place') setSortDir('asc');
  };

  const sortedReportRows = useMemo(() => {
    const rows = (report?.rows || []).slice();
    rows.sort((a, b) => {
      const cmp = compareReportRows(a, b, sortKey);
      if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
      // Stable tie-breakers
      const byPlace = (a.standing?.place ?? 9999) - (b.standing?.place ?? 9999);
      if (byPlace !== 0) return byPlace;
      return studentDisplayName(a.student).localeCompare(studentDisplayName(b.student), 'fr', {
        sensitivity: 'base',
      });
    });

    const q = reportQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = studentDisplayName(row.student).toLowerCase();
      const id = String(row.student?.studentId || '').toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [report, reportQuery, sortKey, sortDir]);

  const SortHeader = ({ label, columnKey, className = '' }) => {
    const active = sortKey === columnKey;
    const Icon = !active ? ArrowUpDown : (sortDir === 'asc' ? ArrowUp : ArrowDown);
    return (
      <th className={className}>
        <button
          type="button"
          className={`period-sort-btn ${active ? 'is-active' : ''}`}
          onClick={() => toggleSort(columnKey)}
          title={`Trier par ${label}`}
        >
          <span>{label}</span>
          <Icon className="w-3.5 h-3.5" />
        </button>
      </th>
    );
  };

  const renderPeriodPanel = (periodWindow) => {
    if (!periodWindow) return null;
    const published = periodWindow.status === 'PUBLISHED';
    const code = periodCode(periodWindow.sequence);
    const dateDirty = draftDates[periodWindow.id]
      && draftDates[periodWindow.id] !== formatDateInput(periodWindow.cutoffDate);
    const canOpenReport = Boolean(classId) && published;
    const isActiveReport = report?.window?.id === periodWindow.id;

    return (
      <article
        key={periodWindow.id}
        className={`period-panel ${published ? 'is-published' : 'is-draft'} ${isActiveReport ? 'is-active' : ''}`}
      >
        <div className="period-panel-rail" aria-hidden="true" />
        <div className="period-panel-main">
          <header className="period-panel-head">
            <div className="period-panel-id">
              <span className={`period-code ${periodWindow.sequence === 2 ? 'is-p2' : 'is-p1'}`}>
                {code}
              </span>
              <div>
                <h3>{periodWindow.title}</h3>
                <p>
                  {periodWindow.sequence === 2
                    ? 'Moyenne cumulative · inclut P1'
                    : 'Moyenne des notes continues'}
                </p>
              </div>
            </div>
            <span className={`period-chip ${published ? 'is-live' : 'is-wait'}`}>
              {published ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock3 className="w-3.5 h-3.5" />}
              {published ? 'Publié' : 'Brouillon'}
            </span>
          </header>

          <div className="period-panel-date">
            <label className="label" htmlFor={`cutoff-${periodWindow.id}`}>Date limite</label>
            <div className="period-date-row">
              <input
                id={`cutoff-${periodWindow.id}`}
                type="date"
                className="input"
                disabled={!canManage}
                value={draftDates[periodWindow.id] || ''}
                onChange={(e) => setDraftDates((prev) => ({
                  ...prev,
                  [periodWindow.id]: e.target.value,
                }))}
              />
              {canManage && (
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-1.5 shrink-0"
                  disabled={savingId === periodWindow.id || !dateDirty}
                  onClick={() => handleSaveDate(periodWindow)}
                  title={dateDirty ? 'Enregistrer la nouvelle date' : 'Aucune date inchangée'}
                >
                  {savingId === periodWindow.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Save className="w-4 h-4" />}
                  Sauver
                </button>
              )}
            </div>
            <p className="period-hint">
              Notes prises en compte jusqu&apos;au <strong>{formatDateFr(draftDates[periodWindow.id] || periodWindow.cutoffDate)}</strong>
              {periodWindow.publishedAt
                ? ` · publié le ${new Date(periodWindow.publishedAt).toLocaleString('fr-FR')}`
                : ''}
              {dateDirty ? ' · date modifiée (non enregistrée)' : ''}
            </p>
          </div>

          {canManage && (
            <div className="period-publish-row">
              <button
                type="button"
                className="btn-primary text-sm inline-flex items-center gap-1.5"
                disabled={publishingId === periodWindow.id}
                onClick={() => handlePublish(periodWindow)}
              >
                {publishingId === periodWindow.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
                {published ? 'Republier' : 'Publier'}
              </button>
              <p className="period-hint period-hint-inline">
                Fige les moyennes et le classement pour tout le primaire
              </p>
            </div>
          )}

          <div className="period-report-actions">
            <div className="period-report-actions-title">
              <span>Rapport & export</span>
              {!classId && <em>Choisissez une classe ci-dessus</em>}
              {classId && !published && <em>Publiez d&apos;abord cette période</em>}
            </div>
            <div className="period-btn-group">
              <button
                type="button"
                className={`period-btn ${isActiveReport ? 'is-selected' : ''}`}
                disabled={!canOpenReport || reportLoadingId === periodWindow.id}
                onClick={() => loadReport(periodWindow.id, classId)}
              >
                {reportLoadingId === periodWindow.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Users className="w-4 h-4" />}
                Classement
              </button>
              <button
                type="button"
                className="period-btn"
                disabled={!canOpenReport || exporting === `excel-${periodWindow.id}`}
                onClick={() => handleExport('excel', periodWindow)}
              >
                {exporting === `excel-${periodWindow.id}`
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <FileSpreadsheet className="w-4 h-4" />}
                Excel
              </button>
              <button
                type="button"
                className="period-btn"
                disabled={!canOpenReport || exporting === `pdf-${periodWindow.id}`}
                onClick={() => handleExport('pdf', periodWindow)}
              >
                {exporting === `pdf-${periodWindow.id}`
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />}
                PDF
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="period-page">
      <PageHeader
        title="Périodes (primaire)"
        description="Dates, publication et rapports de classe pour la 1ère et 2ème période."
        action={(
          <button
            type="button"
            className="btn-secondary text-sm inline-flex items-center gap-1.5"
            onClick={() => setShowHelp((v) => !v)}
          >
            <Info className="w-4 h-4" />
            {showHelp ? 'Masquer l\'aide' : 'Comment ça marche'}
          </button>
        )}
      />

      {showHelp && (
        <div className="period-help">
          <ol>
            <li><strong>1. Contexte</strong> — choisissez le trimestre et la classe pour les rapports.</li>
            <li><strong>2. Périodes</strong> — fixez la date limite, enregistrez, puis publiez (P1 avant P2).</li>
            <li><strong>3. Résultats</strong> — ouvrez le classement, exportez Excel (détail) ou PDF (proclamation).</li>
          </ol>
          <p>Les notes continues sont moyennées sur le MAXIMA de la matière. P2 inclut P1.</p>
        </div>
      )}

      {error && (
        <div className="period-alert period-alert-error" role="alert">
          <span>{error}</span>
          <button type="button" className="period-alert-close" onClick={() => setError('')} aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {message && (
        <div className="period-alert period-alert-success" role="status">
          <span>{message}</span>
          <button type="button" className="period-alert-close" onClick={() => setMessage('')} aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1 — Context */}
      <section className="period-step">
        <div className="period-step-label">
          <span className="period-step-num">1</span>
          <div>
            <h2>Contexte</h2>
            <p>Trimestre et classe utilisés pour les rapports et exports</p>
          </div>
        </div>

        <div className="period-context">
          <div className="period-context-main">
            <div>
              <p className="period-field-label">
                <Calendar className="w-3.5 h-3.5" /> Trimestre
              </p>
              <div className="period-segment" role="tablist" aria-label="Trimestre">
                {terms.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={term === t}
                    className={`period-segment-btn ${term === t ? 'is-active' : ''}`}
                    onClick={() => { setTerm(t); setReport(null); }}
                  >
                    {t.replace('Trimestre ', 'T')}
                  </button>
                ))}
              </div>
            </div>

            <div className="period-context-class">
              <label className="period-field-label" htmlFor="period-class">
                <GraduationCap className="w-3.5 h-3.5" /> Classe primaire
              </label>
              <select
                id="period-class"
                className="input"
                value={classId}
                onChange={(e) => { setClassId(e.target.value); setReport(null); }}
              >
                <option value="">Choisir une classe…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="period-context-side">
            <div className="period-mini-stat">
              <span>{primaryClassCount}</span>
              <em>classes</em>
            </div>
            <div className="period-mini-stat">
              <span>{publishedCount}/{windows.length || 2}</span>
              <em>publiées</em>
            </div>
            <div className="period-mini-stat period-mini-stat-wide">
              <span>{selectedClass?.name || '—'}</span>
              <em>rapport</em>
            </div>
          </div>

          {canManage && (
            <label className="period-sms">
              <input
                type="checkbox"
                checked={notifyParents}
                onChange={(e) => setNotifyParents(e.target.checked)}
              />
              <span>Notifier les parents par SMS à la publication</span>
            </label>
          )}
        </div>
      </section>

      {/* Step 2 — Periods */}
      <section className="period-step">
        <div className="period-step-label">
          <span className="period-step-num">2</span>
          <div>
            <h2>Périodes · {term}</h2>
            <p>Définir, enregistrer et publier P1 puis P2</p>
          </div>
        </div>

        {loading ? (
          <div className="period-loading">
            <Loader2 className="w-7 h-7 animate-spin" />
            <p>Chargement…</p>
          </div>
        ) : (
          <div className="period-flow">
            {renderPeriodPanel(p1)}
            <div className="period-flow-arrow" aria-hidden="true">
              <ChevronRight className="w-5 h-5" />
              <span>puis</span>
            </div>
            {renderPeriodPanel(p2)}
          </div>
        )}
      </section>

      {/* Step 3 — Report */}
      <section className="period-step" ref={reportRef}>
        <div className="period-step-label">
          <span className="period-step-num">3</span>
          <div>
            <h2>Résultats de classe</h2>
            <p>Classement, détail par matière, exports</p>
          </div>
        </div>

        {!report ? (
          <div className="period-report-empty">
            <Users className="w-8 h-8 text-gray-300" />
            <p>
              {classId
                ? 'Ouvrez le classement d’une période publiée (bouton Classement).'
                : 'Choisissez une classe, puis ouvrez le classement d’une période publiée.'}
            </p>
          </div>
        ) : (
          <div className="period-report">
            <div className="period-report-head">
              <div>
                <p className="period-report-kicker">
                  {periodCode(report.window?.sequence)} · {report.window?.title}
                </p>
                <h3>{report.class?.name}</h3>
                <p className="period-report-meta">
                  Limite {formatDateInput(report.window?.cutoffDate)}
                  {' · '}
                  {report.rows?.length || 0} élève{(report.rows?.length || 0) > 1 ? 's' : ''}
                </p>
              </div>
              <div className="period-report-tools">
                <div className="period-search">
                  <Search className="w-4 h-4" />
                  <input
                    type="search"
                    placeholder="Rechercher un élève…"
                    value={reportQuery}
                    onChange={(e) => setReportQuery(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-1.5"
                  disabled={exporting === `excel-${report.window?.id}`}
                  onClick={() => handleExport('excel', report.window)}
                >
                  {exporting === `excel-${report.window?.id}`
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <FileSpreadsheet className="w-4 h-4" />}
                  Excel
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-1.5"
                  disabled={exporting === `pdf-${report.window?.id}`}
                  onClick={() => handleExport('pdf', report.window)}
                >
                  {exporting === `pdf-${report.window?.id}`
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Download className="w-4 h-4" />}
                  PDF
                </button>
              </div>
            </div>

            <div className="period-report-table-wrap">
              <table className="period-report-table">
                <thead>
                  <tr>
                    <SortHeader label="#" columnKey="place" className="col-place" />
                    <SortHeader label="Élève" columnKey="student" className="col-student" />
                    <SortHeader label="Total" columnKey="total" />
                    <SortHeader label="%" columnKey="pct" />
                    {(report.subjects || []).map((s) => (
                      <SortHeader
                        key={s.id}
                        label={s.code || s.name}
                        columnKey={`subj:${s.id}`}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedReportRows.length === 0 ? (
                    <tr>
                      <td colSpan={4 + (report.subjects?.length || 0)} className="period-table-empty">
                        Aucun élève ne correspond à « {reportQuery} »
                      </td>
                    </tr>
                  ) : sortedReportRows.map((row) => {
                    const place = row.standing?.place;
                    const top = place === 1 || place === 2 || place === 3;
                    return (
                      <tr key={row.student.id} className={top ? `is-top is-top-${place}` : ''}>
                        <td className="col-place">
                          <span className="period-place-chip">{place ?? '—'}</span>
                        </td>
                        <td className="col-student">
                          <span className="period-student-name">{studentDisplayName(row.student)}</span>
                          {row.student.studentId && (
                            <span className="period-student-id">{row.student.studentId}</span>
                          )}
                        </td>
                        <td>
                          {row.standing
                            ? `${row.standing.obtained}/${row.standing.maxScore}`
                            : '—'}
                        </td>
                        <td className="col-pct">
                          {row.standing?.pct != null
                            ? `${Math.round(row.standing.pct * 10) / 10}%`
                            : '—'}
                        </td>
                        {(row.subjects || []).map((s) => (
                          <td key={s.subjectId}>
                            {s.obtained != null ? `${s.obtained}/${s.maxScore}` : '—'}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {!publishedCount && !loading && isFamily && (
        <p className="period-empty">Aucune période publiée pour ce trimestre.</p>
      )}
    </div>
  );
}
