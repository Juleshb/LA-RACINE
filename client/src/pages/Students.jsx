import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Trash2, Eye, FileText, FileSpreadsheet, X } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';
import StudentExcelImportModal from '../components/StudentExcelImportModal';

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-600',
};

const STATUS_I18N = {
  PENDING: 'ui.pending',
  APPROVED: 'ui.approved',
  REJECTED: 'ui.rejected',
};

export default function Students() {
  const { campusId } = useCampus();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isTeacher = user?.role === 'TEACHER';
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteChallengeId, setDeleteChallengeId] = useState('');
  const [deleteEmailMasked, setDeleteEmailMasked] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteSending, setDeleteSending] = useState(false);

  const loadStudents = () => {
    api.getStudents({ classId: filterClass || undefined, status: filterStatus || undefined })
      .then(setStudents)
      .catch(console.error);
  };

  useEffect(() => {
    api.getClasses().then(setClasses).catch(console.error);
  }, []);

  useEffect(() => { loadStudents(); }, [filterClass, filterStatus]);

  const displayed = filterSource === 'PARENT'
    ? students.filter((s) => s.parentSubmitted)
    : filterSource === 'SCHOOL'
      ? students.filter((s) => !s.parentSubmitted)
      : students;

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteChallengeId('');
    setDeleteEmailMasked('');
    setDeleteCode('');
    setDeleteError('');
    setDeleteLoading(false);
    setDeleteSending(false);
  };

  const openDeleteModal = async (student) => {
    setDeleteTarget(student);
    setDeleteChallengeId('');
    setDeleteEmailMasked('');
    setDeleteCode('');
    setDeleteError('');
    setDeleteSending(true);
    try {
      const data = await api.requestDeleteStudentOtp(student.id);
      setDeleteChallengeId(data.challengeId);
      setDeleteEmailMasked(data.emailMasked || '');
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteSending(false);
    }
  };

  const confirmDeleteWithOtp = async (e) => {
    e.preventDefault();
    if (!deleteTarget || !deleteChallengeId) return;
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await api.deleteStudent(deleteTarget.id, {
        challengeId: deleteChallengeId,
        code: deleteCode.trim(),
      });
      closeDeleteModal();
      loadStudents();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const resendDeleteOtp = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    setDeleteSending(true);
    try {
      const data = await api.requestDeleteStudentOtp(deleteTarget.id);
      setDeleteChallengeId(data.challengeId);
      setDeleteEmailMasked(data.emailMasked || '');
      setDeleteCode('');
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteSending(false);
    }
  };

  const statusLabel = (code) => {
    const key = STATUS_I18N[code || 'PENDING'];
    return key ? t(key) : code;
  };

  const deleteName = deleteTarget
    ? `${deleteTarget.lastName || ''} ${deleteTarget.postName || ''} ${deleteTarget.firstName || ''}`.trim()
    : '';

  return (
    <div>
      <PageHeader
        title={isTeacher ? t('pages.students.titleTeacher') : t('pages.students.title')}
        description={isTeacher
          ? t('pages.students.descriptionTeacher')
          : t('pages.students.description')}
        action={!isTeacher && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary flex items-center gap-2"
              onClick={() => setImportOpen(true)}
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t('pages.students.importExcel')}
            </button>
            <Link to={`/campus/${campusId}/students/register`} className="btn-primary flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('pages.students.register')}
            </Link>
          </div>
        )}
      />

      <div className="flex flex-wrap gap-4 mb-6">
        <select className="input max-w-xs" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="">{isTeacher ? t('ui.allMyClasses') : t('ui.allClasses')}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {!isTeacher && (
          <>
            <select className="input max-w-xs" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">{t('ui.allStatuses')}</option>
              <option value="PENDING">{t('ui.pending')}</option>
              <option value="APPROVED">{t('ui.approved')}</option>
              <option value="REJECTED">{t('ui.rejected')}</option>
            </select>
            <select className="input max-w-xs" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
              <option value="">{t('ui.allSources')}</option>
              <option value="PARENT">{t('ui.parentSubmissions')}</option>
              <option value="SCHOOL">{t('ui.schoolRegistrations')}</option>
            </select>
          </>
        )}
      </div>

      <div className="card">
        {displayed.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">{t('pageBody.students.empty')}</p>
            {!isTeacher && (
              <div className="flex flex-wrap gap-3 justify-center">
                <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => setImportOpen(true)}>
                  <FileSpreadsheet className="w-4 h-4" /> {t('pages.students.importExcel')}
                </button>
                <Link to={`/campus/${campusId}/students/register`} className="btn-primary inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> {t('pageBody.students.startRegistration')}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">{t('ui.studentId')}</th>
                  <th className="pb-3 font-medium">{t('ui.name')}</th>
                  <th className="pb-3 font-medium">{t('ui.class')}</th>
                  {!isTeacher && <th className="pb-3 font-medium">{t('ui.status')}</th>}
                  {!isTeacher && <th className="pb-3 font-medium">{t('ui.source')}</th>}
                  <th className="pb-3 font-medium">{t('ui.parent')}</th>
                  <th className="pb-3 font-medium">{t('ui.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 text-brand-600 font-medium">{s.studentId}</td>
                    <td className="py-3">{s.lastName} {s.postName} {s.firstName}</td>
                    <td className="py-3">{s.class?.name || s.registrationClass || '—'}</td>
                    {!isTeacher && (
                      <td className="py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[s.registrationStatus] || STATUS_STYLES.PENDING}`}>
                          {statusLabel(s.registrationStatus)}
                        </span>
                      </td>
                    )}
                    {!isTeacher && (
                      <td className="py-3">
                        {s.parentSubmitted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700">{t('ui.parentPortal')}</span>
                        ) : (
                          <span className="text-xs text-gray-400">{t('ui.schoolLabel')}</span>
                        )}
                      </td>
                    )}
                    <td className="py-3 text-gray-400">{s.fatherName || s.parentName || '—'}</td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Link to={`/campus/${campusId}/students/${s.id}`} className="p-1.5 text-gray-400 hover:text-brand-600" title={t('ui.view')}>
                          <Eye className="w-4 h-4" />
                        </Link>
                        {!isTeacher && (
                          <button type="button" onClick={() => openDeleteModal(s)} className="p-1.5 text-gray-400 hover:text-red-400" title={t('ui.delete')}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentExcelImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadStudents}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm deletion</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Delete <strong>{deleteName || deleteTarget.studentId}</strong>? Enter the OTP sent to your email.
                </p>
              </div>
              <button type="button" className="p-1 text-gray-400 hover:text-gray-600" onClick={closeDeleteModal} aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={confirmDeleteWithOtp} className="space-y-4 px-5 py-4">
              {deleteSending && !deleteChallengeId ? (
                <p className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending verification code…
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  Code sent to <strong>{deleteEmailMasked || 'your email'}</strong>
                </p>
              )}

              {deleteError && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</div>
              )}

              <div>
                <label htmlFor="delete-otp" className="mb-1 block text-sm font-medium text-gray-700">
                  Verification code
                </label>
                <input
                  id="delete-otp"
                  className="input w-full tracking-widest"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={deleteCode}
                  onChange={(e) => setDeleteCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  disabled={!deleteChallengeId || deleteSending}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  className="text-sm text-brand-600 hover:underline disabled:opacity-50"
                  onClick={resendDeleteOtp}
                  disabled={deleteSending || deleteLoading}
                >
                  {deleteSending ? 'Sending…' : 'Resend code'}
                </button>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary" onClick={closeDeleteModal} disabled={deleteLoading}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    disabled={deleteLoading || !deleteChallengeId || deleteCode.length < 6}
                  >
                    {deleteLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                      </span>
                    ) : (
                      'Delete student'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
