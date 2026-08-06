import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  downloadMarksImportTemplate,
  parseMarksImportFile,
  matchMarksImportRows,
} from '../../lib/marksExcelImport';

export default function MarksExcelImportModal({
  open,
  onClose,
  onApply,
  context,
}) {
  const inputRef = useRef(null);
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [parseErrors, setParseErrors] = useState([]);
  const [matched, setMatched] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [matchErrors, setMatchErrors] = useState([]);
  const [appliedCount, setAppliedCount] = useState(0);
  const [includeOverMax, setIncludeOverMax] = useState(false);

  const canUse = Boolean(context?.students?.length && context?.subjectId);

  const reset = () => {
    setStep('upload');
    setParsing(false);
    setApplying(false);
    setError('');
    setParseErrors([]);
    setMatched([]);
    setUnmatched([]);
    setMatchErrors([]);
    setAppliedCount(0);
    setIncludeOverMax(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  useEffect(() => {
    if (open) reset();
  }, [open]);

  const previewRows = useMemo(() => {
    if (includeOverMax) return matched;
    return matched.filter((r) => !r.overMax);
  }, [matched, includeOverMax]);

  const overMaxCount = matched.filter((r) => r.overMax).length;

  if (!open) return null;

  const handleDownload = () => {
    if (!canUse) return;
    downloadMarksImportTemplate({
      className: context.className,
      subjectName: context.subjectName,
      term: context.term,
      assessmentLabel: context.assessmentLabel,
      assessmentKey: context.assessmentKey,
      maxScore: context.maxScore,
      assessedOn: context.assessedOn,
      students: context.students,
      records: context.records,
    });
  };

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setError('');
    setParseErrors([]);
    try {
      const parsed = await parseMarksImportFile(file);
      if (parsed.errors?.length && !parsed.rows?.length) {
        setParseErrors(parsed.errors);
        setError(parsed.errors[0]?.error || 'Could not parse file');
        return;
      }
      const result = matchMarksImportRows(parsed.rows, context.students || [], context.maxScore);
      setParseErrors(parsed.errors || []);
      setMatched(result.matched);
      setUnmatched(result.unmatched);
      setMatchErrors(result.errors);
      if (!result.matched.length) {
        setError('No matching students with scores found in this file.');
        setStep('upload');
        return;
      }
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Failed to read Excel file');
    } finally {
      setParsing(false);
    }
  };

  const handleApply = async () => {
    if (!previewRows.length) return;
    setApplying(true);
    setError('');
    try {
      await onApply(previewRows);
      setAppliedCount(previewRows.length);
      setStep('done');
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-brand-700" />
            <div>
              <h2 className="font-bold text-gray-900">Import marks from Excel</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {context?.className || 'Class'} · {context?.subjectName || 'Subject'} · {context?.assessmentLabel || 'Assessment'}
              </p>
            </div>
          </div>
          <button type="button" className="p-2 rounded-lg hover:bg-gray-100" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
          {!canUse && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Select a class and subject with students before downloading or importing a template.
            </div>
          )}

          {step === 'upload' && (
            <>
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm text-gray-700 space-y-2">
                <p className="font-semibold text-brand-900">How it works</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  <li>Download the Excel template (roster + current scores).</li>
                  <li>Fill the <strong>score</strong> column offline.</li>
                  <li>Upload the file here to import and save.</li>
                </ol>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary flex items-center gap-2"
                  disabled={!canUse}
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4" />
                  Download template
                </button>
                <label className={`btn-primary flex items-center gap-2 cursor-pointer ${!canUse || parsing ? 'opacity-50 pointer-events-none' : ''}`}>
                  {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {parsing ? 'Reading…' : 'Choose Excel file'}
                  <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    disabled={!canUse || parsing}
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </label>
              </div>

              {(parseErrors.length > 0 || matchErrors.length > 0) && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-1">
                  {[...parseErrors, ...matchErrors].slice(0, 8).map((err) => (
                    <p key={`${err.row}-${err.error}`}>
                      {err.row ? `Row ${err.row}: ` : ''}{err.error}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 px-2.5 py-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {previewRows.length} ready to import
                </span>
                {unmatched.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-100 px-2.5 py-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {unmatched.length} unmatched
                  </span>
                )}
                {overMaxCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 text-red-700 border border-red-100 px-2.5 py-1 font-medium">
                    {overMaxCount} over max
                  </span>
                )}
              </div>

              {overMaxCount > 0 && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeOverMax}
                    onChange={(e) => setIncludeOverMax(e.target.checked)}
                  />
                  Include scores above max ({context.maxScore})
                </label>
              )}

              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Student</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-500">Score</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.studentId} className={`border-t border-gray-100 ${row.overMax ? 'bg-red-50/50' : ''}`}>
                        <td className="px-3 py-2">
                          <span className="font-medium text-gray-900">{row.name}</span>
                          <span className="block text-xs text-gray-400 font-mono">{row.studentCode}</span>
                        </td>
                        <td className="px-3 py-2 text-center font-bold tabular-nums">
                          {row.score}
                          <span className="text-gray-400 font-normal"> / {row.maxScore}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-500">{row.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {unmatched.length > 0 && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  Unmatched: {unmatched.slice(0, 5).map((u) => u.studentId || `${u.firstName} ${u.lastName}`).join(', ')}
                  {unmatched.length > 5 ? ` (+${unmatched.length - 5})` : ''}
                </div>
              )}
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-semibold text-gray-900">Imported {appliedCount} mark{appliedCount !== 1 ? 's' : ''}</p>
              <p className="text-sm text-gray-500">Scores were applied and saved for this assessment.</p>
            </div>
          )}

          {error && step !== 'upload' && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {error && step === 'upload' && !parseErrors.length && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          {step === 'preview' && (
            <>
              <button type="button" className="btn-secondary" onClick={reset}>
                Back
              </button>
              <button
                type="button"
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
                disabled={!previewRows.length || applying}
                onClick={handleApply}
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {applying ? 'Importing…' : `Import ${previewRows.length} score${previewRows.length !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
          {step === 'done' && (
            <button type="button" className="btn-primary" onClick={onClose}>
              Done
            </button>
          )}
          {step === 'upload' && (
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
