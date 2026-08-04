import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { downloadStudentImportTemplate, parseStudentImportFile } from '../lib/studentExcelImport';

function yearName(years, id) {
  return years.find((y) => y.id === id)?.name || id || '—';
}

function classLabelFor(classes, student) {
  if (student.classLabel) return student.classLabel;
  const hit = classes.find((c) => c.id === student.classId);
  if (hit) return hit.name;
  if (student.classGrade) {
    return `${student.classGrade}${student.classSection ? ` ${student.classSection}` : ''}`;
  }
  return '—';
}

function campusLabelFor(student) {
  if (student.campusLetter) {
    return `LA RACINE (${student.campusLetter})`;
  }
  if (student.inscritA) return student.inscritA;
  return student.campusCode || student.campusName || '—';
}

function PreviewDetail({ student }) {
  const rows = [
    ['Campus', campusLabelFor(student)],
    ['Nom', student.lastName],
    ['Post-Nom', student.postName],
    ['Prénom', student.firstName],
    ['Sexe', student.gender === 'MALE' ? 'Masculin' : student.gender === 'FEMALE' ? 'Féminin' : student.gender],
    ['Naissance', student.dateOfBirth],
    ['Nationalité', student.nationality],
    ['Père', `${student.fatherName || '—'} · ${student.fatherPhone || ''}`],
    ['Mère', `${student.motherName || '—'} · ${student.motherPhone || ''}`],
    ['Adresse', [student.district, student.sector, student.cell, student.village].filter(Boolean).join(', ')],
    ['Urgence', `${student.emergencyContactName || '—'} · ${student.emergencyContactPhone || ''}`],
    ['Provenance', student.previousSchoolName || student.previousClass || '—'],
    ['Transport', student.transportMode || '—'],
    ['Arrêt', student.busStop || '—'],
    ['Paiement', student.paymentMethod || '—'],
  ];
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs bg-gray-50 rounded-lg p-3 border border-gray-100">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2 sm:block">
          <dt className="text-gray-500">{label}</dt>
          <dd className="text-gray-900 font-medium sm:mt-0.5">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function StudentExcelImportModal({ open, onClose, onImported }) {
  const inputRef = useRef(null);
  const [campuses, setCampuses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseErrors, setParseErrors] = useState([]);
  const [previewRows, setPreviewRows] = useState([]); // parsed students awaiting confirm
  const [excluded, setExcluded] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [status, setStatus] = useState('PENDING');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [dupInfo, setDupInfo] = useState({}); // row -> { reason, message, ... }
  const [checkingDup, setCheckingDup] = useState(false);

  const defaultCampusId = typeof localStorage !== 'undefined' ? localStorage.getItem('campusId') : null;

  const resetFlow = () => {
    setParseErrors([]);
    setPreviewRows([]);
    setExcluded(new Set());
    setExpanded(new Set());
    setDupInfo({});
    setResult(null);
    setError('');
    setStep('upload');
    setStatus('PENDING');
    if (inputRef.current) inputRef.current.value = '';
  };

  useEffect(() => {
    if (!open) return;
    resetFlow();
    setLoadingMeta(true);
    (async () => {
      try {
        const campusList = await api.getCampuses();
        const activeCampuses = (Array.isArray(campusList) ? campusList : []).filter((c) => c.isActive !== false);
        setCampuses(activeCampuses);

        const meta = await Promise.all(
          activeCampuses.map(async (campus) => {
            const [years, cls] = await Promise.all([
              api.getAcademicYearsForCampus(campus.id),
              api.getClassesForCampus(campus.id, { allYears: true }),
            ]);
            return {
              years: (Array.isArray(years) ? years : []).map((y) => ({ ...y, campusId: y.campusId || campus.id })),
              classes: (Array.isArray(cls) ? cls : []).map((c) => ({ ...c, campusId: c.campusId || campus.id })),
            };
          }),
        );

        setAcademicYears(meta.flatMap((m) => m.years));
        setClasses(meta.flatMap((m) => m.classes));
      } catch (err) {
        setError(err.message || 'Failed to load campuses / classes');
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [open]);

  const selectedStudents = useMemo(
    () => previewRows.filter((s) => !excluded.has(s.__row)),
    [previewRows, excluded],
  );

  const duplicateCount = useMemo(
    () => Object.keys(dupInfo).length,
    [dupInfo],
  );

  if (!open) return null;

  const handleDownload = async () => {
    try {
      await downloadStudentImportTemplate();
    } catch (err) {
      setError(err.message || 'Could not download template');
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setResult(null);
    setParseErrors([]);
    setPreviewRows([]);
    setExcluded(new Set());
    setExpanded(new Set());
    setDupInfo({});

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseStudentImportFile(buffer, {
        academicYears,
        classes,
        campuses,
        defaultCampusId,
      });
      setParseErrors(parsed.errors);

      if (!parsed.students.length) {
        setError(parsed.errors[0]?.error || 'No valid students found in the file.');
        setStep('upload');
        return;
      }

      setPreviewRows(parsed.students);
      setStep('preview');
      setCheckingDup(true);
      try {
        const check = await api.checkStudentImportDuplicates(parsed.students);
        const map = {};
        const autoExclude = new Set();
        for (const d of check.duplicates || []) {
          map[d.row] = d;
          autoExclude.add(d.row);
        }
        setDupInfo(map);
        setExcluded(autoExclude);
      } catch (dupErr) {
        // Preview still usable; server will skip duplicates on confirm
        console.error(dupErr);
      } finally {
        setCheckingDup(false);
      }
    } catch (err) {
      setError(err.message || 'Could not read Excel file');
      setStep('upload');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const toggleExclude = (row) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  };

  const toggleExpand = (row) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  };

  const confirmImport = async () => {
    if (!selectedStudents.length) {
      setError('Select at least one student to register.');
      return;
    }
    setImporting(true);
    setError('');
    try {
      const response = await api.registerStudentsBulk(selectedStudents, status, { skipDuplicates: true });
      setResult(response);
      setStep('done');
      if (response.created > 0) onImported?.();
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import students (Excel)</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {step === 'upload' && 'Upload the form export, then review before registering.'}
              {step === 'preview' && 'Review each student below, then confirm registration.'}
              {step === 'done' && 'Import finished.'}
            </p>
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
                <p className="text-sm text-brand-900 font-medium">1. Download template (optional)</p>
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-2"
                  onClick={handleDownload}
                  disabled={loadingMeta}
                >
                  <Download className="w-4 h-4" />
                  Download Excel template
                </button>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <p className="text-sm text-gray-900 font-medium">2. Upload Google Form export</p>
                <label className={`btn-primary text-sm inline-flex items-center gap-2 cursor-pointer ${loadingMeta ? 'opacity-60 pointer-events-none' : ''}`}>
                  <Upload className="w-4 h-4" />
                  Choose .xlsx file
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className="hidden"
                    disabled={loadingMeta}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                </label>
                <p className="text-xs text-gray-500">
                  Column <strong>Inscrit à :</strong> (LA RACINE A or B) chooses the campus for each student.
                  You will preview all students before anything is saved.
                </p>
              </div>
            </>
          )}

          {parseErrors.length > 0 && step !== 'done' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900 mb-2">
                Skipped rows ({parseErrors.length}) — these will not be imported
              </p>
              <ul className="text-xs text-amber-800 space-y-1 max-h-28 overflow-y-auto">
                {parseErrors.slice(0, 20).map((e) => (
                  <li key={`${e.row}-${e.error}`}>Row {e.row}: {e.error}</li>
                ))}
                {parseErrors.length > 20 && <li>…and {parseErrors.length - 20} more</li>}
              </ul>
            </div>
          )}

          {step === 'preview' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-3">
                <div className="flex flex-col gap-1 text-sm text-brand-900">
                  <span className="inline-flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    <strong>{selectedStudents.length}</strong> of {previewRows.length} selected for registration
                  </span>
                  {checkingDup && (
                    <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Checking duplicates…
                    </span>
                  )}
                  {!checkingDup && duplicateCount > 0 && (
                    <span className="text-xs text-amber-800">
                      {duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'} found (same name + date of birth) — unchecked by default. They will not be imported.
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-gray-600 flex items-center gap-2">
                    Status after import
                    <select className="input py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="PENDING">Pending (review later)</option>
                      <option value="APPROVED">Approved</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs text-gray-500">
                      <tr>
                        <th className="px-3 py-2 w-10">Inc.</th>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2">Campus</th>
                        <th className="px-3 py-2">Class</th>
                        <th className="px-3 py-2">Year</th>
                        <th className="px-3 py-2">Parent phones</th>
                        <th className="px-3 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((student) => {
                        const row = student.__row;
                        const isOut = excluded.has(row);
                        const isOpen = expanded.has(row);
                        const dup = dupInfo[row];
                        return (
                          <tr key={row} className={`border-t border-gray-100 align-top ${isOut ? 'opacity-45 bg-gray-50' : ''} ${dup ? 'bg-amber-50/40' : ''}`}>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={!isOut}
                                onChange={() => toggleExclude(row)}
                                aria-label={`Include row ${row}`}
                              />
                            </td>
                            <td className="px-3 py-2 text-gray-500">{row}</td>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-900">
                                {student.lastName} {student.postName} {student.firstName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {student.gender === 'MALE' ? 'M' : student.gender === 'FEMALE' ? 'F' : '—'}
                                {' · '}
                                {student.dateOfBirth || '—'}
                              </p>
                              {dup && (
                                <p className="text-[11px] text-amber-800 mt-1 font-medium">
                                  Duplicate — {dup.message}
                                </p>
                              )}
                              {isOpen && (
                                <div className="mt-2">
                                  <PreviewDetail student={student} />
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-900">{campusLabelFor(student)}</p>
                              <p className="text-xs text-gray-500">{student.campusCode || student.campusName || ''}</p>
                            </td>
                            <td className="px-3 py-2">
                              <p>{classLabelFor(classes, student)}</p>
                              {student.classSection ? (
                                <p className="text-xs text-gray-500">Section {student.classSection}</p>
                              ) : null}
                              {!student.classId && student.classGrade ? (
                                <p className="text-[11px] text-amber-700 mt-0.5">Will create class if missing</p>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">{yearName(academicYears, student.academicYearId)}
                              {student.yearBorrowed ? (
                                <p className="text-[11px] text-amber-700 mt-0.5">Year will be created on this campus if missing</p>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600">
                              <div>{student.fatherPhone || '—'}</div>
                              <div>{student.motherPhone || '—'}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  className="text-gray-400 hover:text-brand-700 p-1"
                                  onClick={() => toggleExpand(row)}
                                  title={isOpen ? 'Hide details' : 'View form details'}
                                >
                                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                <button
                                  type="button"
                                  className="text-gray-400 hover:text-red-600 p-1"
                                  onClick={() => toggleExclude(row)}
                                  title={isOut ? 'Include again' : 'Remove from import'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {step === 'done' && result && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
              <p className="text-sm font-medium text-green-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Registered {result.created} of {result.total}
                {result.skipped ? ` · ${result.skipped} duplicate(s) skipped` : ''}
                {result.failed ? ` · ${result.failed} failed` : ''}
              </p>
              {result.created > 0 && (
                <p className="text-xs text-green-800">
                  Open the Students list to see them
                  {status === 'PENDING' ? ' (filter status: Pending)' : ''}.
                  {' '}Switch campus in the top bar to LA RACINE A or B to see students for that campus.
                  {' '}If they don’t appear, also switch the school year to the year used in the Excel (e.g. 2026–2027).
                </p>
              )}
              {(result.skipped > 0 || result.failed > 0) && (
                <ul className="text-xs text-amber-900 space-y-1 max-h-40 overflow-y-auto">
                  {(result.results || [])
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <li key={`${r.row}-${r.error}`}>
                        Row {r.row}{r.name ? ` (${r.name})` : ''}: {r.error}
                      </li>
                    ))}
                </ul>
              )}
              {(result.results || []).filter((r) => r.ok).length > 0 && (
                <div className="text-xs text-gray-700 max-h-36 overflow-y-auto space-y-1 border-t border-green-200 pt-2">
                  {(result.results || []).filter((r) => r.ok).map((r) => (
                    <p key={r.id || r.studentId}>✓ {r.studentId} — {r.name}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap justify-between gap-2">
          <div>
            {step === 'preview' && (
              <button type="button" className="btn-secondary text-sm" onClick={resetFlow} disabled={importing}>
                Choose another file
              </button>
            )}
            {step === 'done' && (
              <button type="button" className="btn-secondary text-sm" onClick={resetFlow}>
                Import another file
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={importing}>
              Close
            </button>
            {step === 'preview' && (
              <button
                type="button"
                className="btn-primary text-sm inline-flex items-center gap-2"
                onClick={confirmImport}
                disabled={importing || selectedStudents.length === 0}
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {importing
                  ? 'Registering…'
                  : `Confirm register (${selectedStudents.length})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
