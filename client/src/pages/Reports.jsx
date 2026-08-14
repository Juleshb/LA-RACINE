import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Bus, ClipboardCheck, Download, FileSpreadsheet, FileText, FileType,
  Filter, GraduationCap, Library, Loader2, RefreshCw, Sparkles, Users, Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { useTranslation } from '../context/LanguageContext';
import { exportReportExcel, exportReportPdf, exportReportWord } from '../lib/reportExport';
import { SortableTh, useTableSort } from '../hooks/useTableSort';

const DEFAULT_TERMS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];

const FEE_TYPE_OPTIONS = [
  { value: 'TUITION', labelKey: 'pageBody.fees.types.TUITION' },
  { value: 'REGISTRATION', labelKey: 'pageBody.fees.types.REGISTRATION' },
  { value: 'EXAM', labelKey: 'pageBody.fees.types.EXAM' },
  { value: 'TRANSPORT', labelKey: 'pageBody.fees.types.TRANSPORT' },
  { value: 'UNIFORM', labelKey: 'pageBody.fees.types.UNIFORM' },
  { value: 'OTHER', labelKey: 'pageBody.fees.types.OTHER' },
  { value: 'CONFIRMATION', labelKey: 'pageBody.fees.types.CONFIRMATION' },
];

const CATEGORY_ICONS = {
  People: Users,
  Academic: GraduationCap,
  Assessment: ClipboardCheck,
  Finance: Wallet,
  Library,
  Transport: Bus,
  Activities: Sparkles,
};

function categoryIcon(category) {
  return CATEGORY_ICONS[category] || BarChart3;
}

export default function Reports() {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const [feeType, setFeeType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [term, setTerm] = useState('Trimestre 1');
  const [report, setReport] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');

  const selectedDef = useMemo(
    () => catalog.find((r) => r.id === selectedId) || null,
    [catalog, selectedId],
  );

  const groupedCatalog = useMemo(() => {
    const groups = {};
    catalog.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return Object.entries(groups);
  }, [catalog]);

  const reportRows = report?.rows || [];
  const rowCount = report?.meta?.rowCount ?? report?.rows?.length ?? 0;
  const getReportSortValue = useCallback((row, key) => row?.[key] ?? '', []);
  const { sorted: sortedReportRows, sortKey, sortDir, toggleSort } = useTableSort(
    reportRows,
    getReportSortValue,
  );

  useEffect(() => {
    setLoadingCatalog(true);
    Promise.all([
      api.getReportCatalog(),
      api.getClasses().catch(() => []),
    ])
      .then(([catalogData, classData]) => {
        setCatalog(catalogData.reports || []);
        setClasses(classData || []);
        if (catalogData.reports?.length) {
          setSelectedId(catalogData.reports[0].id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingCatalog(false));
  }, []);

  const loadReport = async (reportId = selectedId, overrides = {}) => {
    if (!reportId) return;
    setLoadingReport(true);
    setError('');
    try {
      const filters = selectedDef?.filters || catalog.find((r) => r.id === reportId)?.filters || [];
      const from = overrides.dateFrom !== undefined ? overrides.dateFrom : dateFrom;
      const to = overrides.dateTo !== undefined ? overrides.dateTo : dateTo;
      const params = {};
      if (filters.includes('classId') && classId) params.classId = classId;
      if (filters.includes('status') && status) params.status = status;
      if (filters.includes('feeType') && feeType) params.feeType = feeType;
      if (filters.includes('dateRange')) {
        if (from) params.dateFrom = from;
        if (to) params.dateTo = to;
      }
      if (filters.includes('date') && from) params.date = from;
      if (filters.includes('term') && term) params.term = term;
      const data = await api.getReport(reportId, params);
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err.message);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    const def = catalog.find((r) => r.id === selectedId);
    let from = dateFrom;
    let to = dateTo;
    if (def?.filters?.includes('dateRange') && (selectedId === 'attendance' || selectedId === 'transport-attendance')) {
      if (!from && !to) {
        const today = new Date().toISOString().slice(0, 10);
        from = today;
        to = today;
        setDateFrom(today);
        setDateTo(today);
      }
    }
    loadReport(selectedId, { dateFrom: from, dateTo: to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleExport = async (format) => {
    if (!report?.rows?.length) return;
    setExporting(format);
    setError('');
    try {
      const payload = {
        title: report.title,
        columns: report.columns,
        rows: report.rows,
        meta: report.meta,
        filename: [
          report.id,
          report.meta?.dateFrom || dateFrom || '',
          report.meta?.dateTo || dateTo || '',
          new Date().toISOString().slice(0, 10),
        ].filter(Boolean).join('-'),
      };
      if (format === 'excel') exportReportExcel(payload);
      else if (format === 'pdf') exportReportPdf(payload);
      else if (format === 'word') await exportReportWord(payload);
    } catch (err) {
      setError(err.message || t('pages.reports.exportFailed'));
    } finally {
      setExporting('');
    }
  };

  const filters = selectedDef?.filters || [];
  const canExport = Boolean(report?.rows?.length) && !exporting;

  return (
    <div className="reports-page">
      <div className="reports-ambient" aria-hidden>
        <span className="reports-blob reports-blob-a" />
        <span className="reports-blob reports-blob-b" />
      </div>

      <header className="reports-header">
        <div className="reports-header-copy">
          <p className="reports-kicker">{t('pages.reports.reportTypes')}</p>
          <h1 className="reports-title">{t('pages.reports.title')}</h1>
          <p className="reports-desc">{t('pages.reports.description')}</p>
        </div>

        <div className="reports-header-actions">
          {report && !loadingReport && (
            <span className="reports-row-pill">
              {t('pages.reports.rowCount', { count: rowCount })}
            </span>
          )}
          <button
            type="button"
            onClick={() => loadReport()}
            disabled={loadingReport || !selectedId}
            className="reports-action-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loadingReport ? 'animate-spin' : ''}`} />
            <span>{t('ui.refresh')}</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('excel')}
            disabled={!canExport}
            className="reports-action-btn"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exporting === 'excel' ? t('ui.exporting') : t('pages.reports.formatExcel')}</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={!canExport}
            className="reports-action-btn"
          >
            <FileText className="w-4 h-4" />
            <span>{exporting === 'pdf' ? t('ui.exporting') : t('pages.reports.formatPdf')}</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('word')}
            disabled={!canExport}
            className="reports-action-btn reports-action-btn-primary"
          >
            <FileType className="w-4 h-4" />
            <span>{exporting === 'word' ? t('ui.exporting') : t('pages.reports.formatWord')}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="reports-error" role="alert">{error}</div>
      )}

      <div className="reports-layout">
        <aside className="reports-catalog" aria-label={t('pages.reports.reportTypes')}>
          <div className="reports-catalog-head">
            <BarChart3 className="w-4 h-4 text-brand-600" />
            <h2>{t('pages.reports.reportTypes')}</h2>
          </div>
          {loadingCatalog ? (
            <div className="reports-catalog-loading">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            </div>
          ) : catalog.length === 0 ? (
            <p className="reports-catalog-empty">{t('pages.reports.noReportsForRole')}</p>
          ) : (
            <div className="reports-catalog-scroll">
              {groupedCatalog.map(([category, items]) => {
                const Icon = categoryIcon(category);
                return (
                  <div key={category} className="reports-catalog-group">
                    <p className="reports-catalog-category">
                      <Icon className="w-3.5 h-3.5" />
                      {category}
                    </p>
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`reports-catalog-item ${selectedId === item.id ? 'is-active' : ''}`}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <div className="reports-workspace">
          {selectedDef && (
            <section className="reports-filters">
              <div className="reports-filters-head">
                <div className="min-w-0">
                  <p className="reports-filters-title">
                    <Filter className="w-3.5 h-3.5" />
                    {selectedDef.title}
                  </p>
                  <p className="reports-filters-desc">{selectedDef.description}</p>
                </div>
              </div>

              {filters.length > 0 && (
                <>
                  <div className="reports-filters-grid">
                    {filters.includes('classId') && (
                      <div>
                        <label className="label">{t('ui.class')}</label>
                        <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                          <option value="">{t('ui.allClasses')}</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {filters.includes('status') && (
                      <div>
                        <label className="label">{t('ui.status')}</label>
                        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                          <option value="">{t('ui.all')}</option>
                          {selectedId === 'fees' ? (
                            <>
                              <option value="PAID">{t('pages.reports.statusPaid')}</option>
                              <option value="PENDING">{t('pages.reports.statusPending')}</option>
                              <option value="OVERDUE">{t('pages.reports.statusOverdue')}</option>
                              <option value="WAIVED">{t('pages.reports.statusWaived')}</option>
                            </>
                          ) : (
                            <>
                              <option value="PENDING">{t('pages.reports.statusPending')}</option>
                              <option value="APPROVED">{t('pages.reports.statusApproved')}</option>
                              <option value="REJECTED">{t('pages.reports.statusRejected')}</option>
                            </>
                          )}
                        </select>
                      </div>
                    )}
                    {filters.includes('feeType') && (
                      <div>
                        <label className="label">{t('ui.feeType')}</label>
                        <select className="input" value={feeType} onChange={(e) => setFeeType(e.target.value)}>
                          <option value="">{t('ui.all')}</option>
                          {FEE_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {filters.includes('dateRange') && (
                      <>
                        <div>
                          <label className="label">{selectedDef.dateFieldLabel || t('pages.reports.fromDate')}</label>
                          <input
                            className="input"
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label">{t('pages.reports.toDate')}</label>
                          <input
                            className="input"
                            type="date"
                            value={dateTo}
                            min={dateFrom || undefined}
                            onChange={(e) => setDateTo(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                    {filters.includes('date') && !filters.includes('dateRange') && (
                      <div>
                        <label className="label">{t('ui.date')}</label>
                        <input
                          className="input"
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                        />
                      </div>
                    )}
                    {filters.includes('term') && (
                      <div>
                        <label className="label">{t('pages.marks.trimestre')}</label>
                        <select className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
                          <option value="">{t('pages.reports.allTerms')}</option>
                          {DEFAULT_TERMS.map((termOpt) => (
                            <option key={termOpt} value={termOpt}>{termOpt}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="reports-filters-actions">
                      {(dateFrom || dateTo) && filters.includes('dateRange') && (
                        <button
                          type="button"
                          onClick={() => {
                            setDateFrom('');
                            setDateTo('');
                          }}
                          className="reports-action-btn"
                        >
                          {t('pages.reports.clearDates')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => loadReport()}
                        disabled={loadingReport}
                        className="reports-action-btn reports-action-btn-primary"
                      >
                        <Download className="w-4 h-4" />
                        {t('pages.reports.applyFilters')}
                      </button>
                    </div>
                  </div>

                  {filters.includes('dateRange') && (
                    <p className="reports-filters-hint">
                      {selectedId === 'attendance' || selectedId === 'transport-attendance'
                        ? t('pages.reports.dateHintDaily')
                        : t('pages.reports.dateHintOptional')}
                      {(dateFrom || dateTo) && (
                        <>
                          {' '}
                          {t('pages.reports.currentRange', {
                            from: dateFrom || '…',
                            to: dateTo || '…',
                          })}
                        </>
                      )}
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          <section className="reports-preview">
            {loadingReport ? (
              <div className="reports-preview-empty">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                <p>{t('pages.reports.loadingReport')}</p>
              </div>
            ) : !report ? (
              <div className="reports-preview-empty">
                <span className="reports-preview-empty-icon" aria-hidden>
                  <BarChart3 className="w-7 h-7" />
                </span>
                <p className="reports-preview-empty-title">{t('pages.reports.selectReportType')}</p>
              </div>
            ) : report.rows.length === 0 ? (
              <div className="reports-preview-empty">
                <span className="reports-preview-empty-icon" aria-hidden>
                  <Filter className="w-7 h-7" />
                </span>
                <p className="reports-preview-empty-title">{t('pages.reports.noDataForReport')}</p>
                <p className="reports-preview-empty-sub">{t('pages.reports.tryDifferentFilters')}</p>
              </div>
            ) : (
              <>
                <div className="reports-table-wrap">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        {report.columns.map((col) => (
                          <SortableTh
                            key={col.key}
                            label={col.label}
                            columnKey={col.key}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedReportRows.slice(0, 200).map((row, index) => (
                        <tr key={index}>
                          {report.columns.map((col) => (
                            <td key={col.key}>{row[col.key] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {report.rows.length > 200 && (
                  <p className="reports-table-foot">
                    {t('pages.reports.showingFirst', {
                      shown: 200,
                      total: report.rows.length,
                    })}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
