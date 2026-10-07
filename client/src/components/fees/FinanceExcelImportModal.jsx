import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { api } from '../../lib/api';
import { downloadFinanceImportTemplate, parseFinanceImportFile } from '../../lib/financeExcelImport';
import { useTranslation } from '../../context/LanguageContext';

export default function FinanceExcelImportModal({ open, onClose, onImported }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [step, setStep] = useState('upload');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [result, setResult] = useState(null);

  const reset = () => {
    setStep('upload');
    setParsing(false);
    setImporting(false);
    setError('');
    setRows([]);
    setParseErrors([]);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  useEffect(() => {
    if (open) reset();
  }, [open]);

  if (!open) return null;

  const handleDownload = async () => {
    setLoadingStudents(true);
    setError('');
    try {
      const [students, years] = await Promise.all([
        api.getStudents().catch(() => []),
        api.getAcademicYears().catch(() => []),
      ]);
      const yearList = Array.isArray(years) ? years : [];
      const activeYear = yearList.find((year) => year.isActive) || yearList[0];
      await downloadFinanceImportTemplate({
        students: Array.isArray(students) ? students : [],
        academicYearName: activeYear?.name || '',
      });
    } catch (err) {
      setError(err.message || t('pageBody.fees.importFailed'));
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setError('');
    try {
      const parsed = await parseFinanceImportFile(file);
      setParseErrors(parsed.errors || []);
      setRows(parsed.rows || []);
      if (!parsed.rows?.length) {
        setError(parsed.errors?.[0]?.error || t('pageBody.fees.importNone'));
        setStep('upload');
        return;
      }
      setStep('preview');
    } catch (err) {
      setError(err.message || t('pageBody.fees.importFailed'));
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    try {
      const response = await api.importFees(rows);
      setResult(response);
      setStep('done');
      if (response.created > 0) onImported?.();
    } catch (err) {
      setError(err.message || t('pageBody.fees.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('pageBody.fees.importTitle')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t('pageBody.fees.importHint')}</p>
          </div>
          <button type="button" className="btn-secondary text-sm p-2" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{error}</div>
          )}

          {step === 'upload' && (
            <>
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4 space-y-3">
                <p className="text-sm text-brand-900 font-medium">{t('pageBody.fees.importStepTemplate')}</p>
                <p className="text-xs text-gray-600">{t('pageBody.fees.importTemplateHint')}</p>
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-2"
                  onClick={handleDownload}
                  disabled={loadingStudents}
                >
                  {loadingStudents ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {t('pageBody.fees.downloadTemplate')}
                </button>
              </div>
              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <p className="text-sm text-gray-900 font-medium">{t('pageBody.fees.importStepUpload')}</p>
                <label className={`btn-primary text-sm inline-flex items-center gap-2 cursor-pointer ${parsing ? 'opacity-60 pointer-events-none' : ''}`}>
                  {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {t('pageBody.fees.chooseFile')}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className="hidden"
                    disabled={parsing}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                </label>
              </div>
            </>
          )}

          {parseErrors.length > 0 && step !== 'done' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900 mb-2">
                {t('pageBody.fees.importSkipped', { count: parseErrors.length })}
              </p>
              <ul className="text-xs text-amber-800 space-y-1 max-h-28 overflow-y-auto">
                {parseErrors.slice(0, 12).map((item) => (
                  <li key={`${item.row}-${item.error}`}>Row {item.row}: {item.error}</li>
                ))}
              </ul>
            </div>
          )}

          {step === 'preview' && (
            <>
              <p className="text-sm text-gray-600">
                {t('pageBody.fees.importReady', { count: rows.length })}
              </p>
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="px-3 py-2 font-medium">{t('pageBody.fees.importColSheet')}</th>
                      <th className="px-3 py-2 font-medium">{t('ui.name')}</th>
                      <th className="px-3 py-2 font-medium">{t('pageBody.fees.importColType')}</th>
                      <th className="px-3 py-2 font-medium">{t('pageBody.fees.importColAmount')}</th>
                      <th className="px-3 py-2 font-medium">{t('ui.status')}</th>
                      <th className="px-3 py-2 font-medium">{t('pageBody.fees.importColTerm')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 12).map((row) => (
                      <tr key={`${row.sheet || ''}-${row.row}-${row.label || row.feeType}-${row.installmentIndex || ''}`} className="border-b border-gray-50">
                        <td className="px-3 py-2">{row.sheet || row.studentCode || '—'}</td>
                        <td className="px-3 py-2">{row.fullName || [row.lastName, row.postName, row.firstName].filter(Boolean).join(' ')}</td>
                        <td className="px-3 py-2">{row.label || row.feeType}</td>
                        <td className="px-3 py-2">{row.amount}</td>
                        <td className="px-3 py-2">{row.status}</td>
                        <td className="px-3 py-2">{row.term || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 12 && (
                <p className="text-xs text-gray-500">{t('pageBody.fees.importMore', { count: rows.length - 12 })}</p>
              )}
            </>
          )}

          {step === 'done' && result && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-sm font-medium text-emerald-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                {t('pageBody.fees.imported', { count: result.created })}
              </p>
              {result.skipped > 0 && (
                <p className="text-sm text-amber-800">{t('pageBody.fees.importSkipped', { count: result.skipped })}</p>
              )}
              {result.errors?.length > 0 && (
                <ul className="text-xs text-amber-900 space-y-1 max-h-28 overflow-y-auto">
                  {result.errors.slice(0, 12).map((item) => (
                    <li key={`${item.row}-${item.error}`}>Row {item.row}: {item.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          {step === 'preview' && (
            <button type="button" className="btn-secondary text-sm" onClick={reset}>
              {t('ui.back')}
            </button>
          )}
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            {step === 'done' ? t('ui.close') : t('ui.cancel')}
          </button>
          {step === 'preview' && (
            <button type="button" className="btn-primary text-sm inline-flex items-center gap-2" onClick={handleImport} disabled={importing}>
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('pageBody.fees.importConfirm', { count: rows.length })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
