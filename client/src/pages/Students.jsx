import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Eye, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';

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

  const handleDelete = async (id) => {
    if (!confirm(t('pageBody.students.deleteConfirm'))) return;
    try {
      await api.deleteStudent(id);
      loadStudents();
    } catch (err) {
      alert(err.message);
    }
  };

  const statusLabel = (code) => {
    const key = STATUS_I18N[code || 'PENDING'];
    return key ? t(key) : code;
  };

  return (
    <div>
      <PageHeader
        title={isTeacher ? t('pages.students.titleTeacher') : t('pages.students.title')}
        description={isTeacher
          ? t('pages.students.descriptionTeacher')
          : t('pages.students.description')}
        action={!isTeacher && (
          <Link to={`/campus/${campusId}/students/register`} className="btn-primary flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('pages.students.register')}
          </Link>
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
              <Link to={`/campus/${campusId}/students/register`} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t('pageBody.students.startRegistration')}
              </Link>
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
                          <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
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
    </div>
  );
}
