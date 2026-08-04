import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Download, FileSpreadsheet, FileText, FileType, Loader2, RefreshCw, Filter,
} from 'lucide-react';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';
import { exportReportExcel, exportReportPdf, exportReportWord } from '../lib/reportExport';

const DEFAULT_TERMS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];

const FEE_TYPE_OPTIONS = [
  { value: 'TUITION', labelKey: 'pageBody.fees.types.TUITION' },
  { value: 'REGISTRATION', labelKey: 'pageBody.fees.types.REGISTRATION' },
  { value: 'EXAM', labelKey: 'pageBody.fees.types.EXAM' },
  { value: 'TRANSPORT', labelKey: 'pageBody.fees.types.TRANSPORT' },
  { value: 'UNIFORM', labelKey: 'pageBody.fees.types.UNIFORM' },
  { value: 'OTHER', labelKey: 'pageBody.fees.types.OTHER' },
];

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
      setError(err.message || 'Export failed');
    } finally {
      setExporting('');
    }
  };

  const filters = selectedDef?.filters || [];

  return (
    <div>
      <PageHeader
        title={t('pages.reports.title')}
        description={t('pages.reports.description')}
        action={(
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => loadReport()}
              disabled={loadingReport || !selectedId}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingReport ? 'animate-spin' : ''}`} />
              {t('ui.refresh')}
            </button>
            <button
              type="button"
              onClick={() => handleExport('excel')}
              disabled={!report?.rows?.length || !!exporting}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {exporting === 'excel' ? t('ui.exporting') : t('pages.reports.formatExcel')}
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={!report?.rows?.length || !!exporting}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              {exporting === 'pdf' ? t('ui.exporting') : t('pages.reports.formatPdf')}
            </button>
            <button
              type="button"
              onClick={() => handleExport('word')}
              disabled={!report?.rows?.length || !!exporting}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <FileType className="w-4 h-4" />
              {exporting === 'word' ? t('ui.exporting') : t('pages.reports.formatWord')}
            </button>
          </div>
        )}
      />

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
        <aside className="card p-0 overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-gray-900 text-sm">{t('pages.reports.reportTypes')}</h2>
          </div>
          {loadingCatalog ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            </div>
          ) : catalog.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">{t('pages.reports.noReportsForRole')}</p>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              {groupedCatalog.map(([category, items]) => (
                <div key={category}>
                  <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {category}
                  </p>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full text-left px-4 py-2.5 text-sm border-l-2 transition-colors ${
                        selectedId === item.id
                          ? 'border-brand-500 bg-brand-50 text-brand-800 font-medium'
                          : 'border-transparent text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </aside>

        <div className="space-y-4">
          {selectedDef && (
            <div className="filter-panel">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="filter-panel-title flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5" />
                    {selectedDef.title}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{selectedDef.description}</p>
                </div>
                {report && (
                  <span className="layout-flow-chip layout-flow-chip-lg">
                    {report.meta?.rowCount ?? report.rows?.length ?? 0} rows
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                      <label className="label">{selectedDef.dateFieldLabel || 'From date'}</label>
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
                {filters.length > 0 && (
                  <div className="flex items-end gap-2">
                    {(dateFrom || dateTo) && filters.includes('dateRange') && (
                      <button
                        type="button"
                        onClick={() => {
                          setDateFrom('');
                          setDateTo('');
                        }}
                        className="btn-secondary"
                      >
                        Clear dates
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => loadReport()}
                      disabled={loadingReport}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      Apply filters
                    </button>
                  </div>
                )}
              </div>
              {filters.includes('dateRange') && (
                <p className="text-xs text-gray-500 mt-3">
                  {selectedId === 'attendance' || selectedId === 'transport-attendance'
                    ? 'Pick a from/to date range. Defaults to today for a daily register.'
                    : 'Optional: filter by from/to dates. Leave blank to include all dates.'}
                  {(dateFrom || dateTo) && (
                    <>
                      {' '}Current range:
                      {dateFrom ? ` ${dateFrom}` : ' …'}
                      {' → '}
                      {dateTo || '…'}
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            {loadingReport ? (
              <div className="empty-state py-16">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-2" />
                <p className="text-gray-500">{t('pages.reports.loadingReport')}</p>
              </div>
            ) : !report ? (
              <div className="empty-state py-16">
                <BarChart3 className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-gray-500">{t('pages.reports.selectReportType')}</p>
              </div>
            ) : report.rows.length === 0 ? (
              <div className="empty-state py-16">
                <p className="text-gray-600 font-medium">{t('pages.reports.noDataForReport')}</p>
                <p className="text-sm text-gray-400 mt-1">{t('pages.reports.tryDifferentFilters')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-report">
                  <thead>
                    <tr>
                      {report.columns.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.slice(0, 200).map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                        {report.columns.map((col) => (
                          <td key={col.key}>{row[col.key] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.rows.length > 200 && (
                  <p className="px-4 py-3 text-xs text-gray-500 border-t border-gray-100">
                    Showing first 200 of {report.rows.length} rows. Export includes the full dataset.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
