import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StudentPageHeader from '../components/student/StudentPageHeader';
import ParentChildFilter from '../components/parent/ParentChildFilter';
import AppIcon from '../components/icons/AppIcon';
import { useTranslation } from '../context/LanguageContext';

const statusOptions = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const statusColors = {
  PRESENT: 'bg-brand-50 text-brand-700 border-brand-600',
  ABSENT: 'bg-red-50 text-red-600 border-red-300',
  LATE: 'bg-gray-100 text-gray-700 border-gray-300',
  EXCUSED: 'bg-gray-100 text-gray-600 border-gray-300',
};

const STUDENT_STATUS = {
  PRESENT: { label: 'You were at school!', icon: 'present', card: 'student-att-present-card' },
  ABSENT: { label: 'You were away', icon: 'absent', card: 'student-att-absent-card' },
  LATE: { label: 'You were late', icon: 'late', card: 'student-att-late-card' },
  EXCUSED: { label: 'Excused day', icon: 'excused', card: 'student-att-excused-card' },
};

function formatFriendlyDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

const ATTENDANCE_STATUS_I18N = {
  PRESENT: 'ui.present',
  ABSENT: 'ui.absent',
  LATE: 'ui.late',
  EXCUSED: 'ui.excused',
};

export default function Attendance() {
  const { campusId } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isParent = user?.role === 'PARENT';
  const isStudent = user?.role === 'STUDENT';
  const isTeacher = user?.role === 'TEACHER';
  const isFamily = isParent || isStudent;
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [records, setRecords] = useState({});
  const [students, setStudents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageSuccess, setMessageSuccess] = useState(false);

  useEffect(() => {
    if (isParent) {
      api.getParentChildren().then((list) => {
        setChildren(list);
        if (list.length) setSelectedChildId(list[0].id);
      }).catch(console.error);
    } else if (!isStudent) {
      api.getClasses().then(setClasses).catch(console.error);
    }
  }, [isParent, isStudent]);

  useEffect(() => {
    const queryClassId = isParent
      ? children.find((c) => c.id === selectedChildId)?.classId
      : (isStudent ? undefined : (classId || undefined));

    api.getAttendance(date, queryClassId || undefined).then((data) => {
      const rows = isParent && selectedChildId
        ? data.students.filter((s) => s.id === selectedChildId)
        : data.students;
      setStudents(rows);
      const initial = {};
      rows.forEach((s) => {
        const recorded = s.attendance[0]?.status;
        initial[s.id] = recorded ?? (isFamily ? undefined : 'PRESENT');
      });
      setRecords(initial);
    }).catch(console.error);
  }, [date, classId, isParent, isStudent, selectedChildId, children]);

  const setStatus = (studentId, status) => {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setMessageSuccess(false);
    try {
      const payload = {
        date,
        records: Object.entries(records).map(([studentId, status]) => ({ studentId, status })),
      };
      const result = await api.saveAttendance(payload);
      setMessageSuccess(true);
      setMessage(t('pageBody.attendance.savedMessage', { count: result.saved }));
    } catch (err) {
      setMessageSuccess(false);
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const studentRecord = isStudent && students[0] ? records[students[0].id] : null;
  const studentStatus = studentRecord ? STUDENT_STATUS[studentRecord] : null;

  return (
    <div className={isStudent ? 'student-page' : ''}>
      {isStudent ? (
        <StudentPageHeader
          icon="present"
          title="My days at school"
          subtitle="See if you were present on each day"
          backTo={`/campus/${campusId}`}
        />
      ) : (
        <PageHeader
          title={isParent
            ? t('pages.attendance.titleParent')
            : isTeacher
              ? t('pages.attendance.titleTeacher')
              : t('pages.attendance.title')}
          description={isParent
            ? t('pages.attendance.descriptionParent')
            : isTeacher
              ? t('pages.attendance.descriptionTeacher')
              : t('pages.attendance.description')}
          action={!isFamily && (
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? t('ui.saving') : t('pages.attendance.save')}
            </button>
          )}
        />
      )}

      {message && !isStudent && (
        <div className={`mb-6 p-4 rounded-lg text-sm ${messageSuccess ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-600'}`}>
          {message}
        </div>
      )}

      {isParent && (
        <ParentChildFilter
          children={children}
          value={selectedChildId}
          onChange={setSelectedChildId}
        />
      )}

      {isStudent ? (
        <>
          <div className="student-date-picker">
            <label htmlFor="student-att-date">Pick a day</label>
            <input
              id="student-att-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {students.length === 0 ? (
            <div className="student-empty-card">No record for this day yet.</div>
          ) : studentStatus ? (
            <div className={`student-att-big-card ${studentStatus.card}`}>
              <span className="student-att-big-icon" aria-hidden>
                <AppIcon name={studentStatus.icon} className="w-16 h-16" />
              </span>
              <p className="student-att-big-label">{studentStatus.label}</p>
              <p className="student-att-big-date">{formatFriendlyDate(date)}</p>
            </div>
          ) : (
            <div className="student-att-big-card student-att-none-card">
              <span className="student-att-big-icon" aria-hidden>
                <AppIcon name="unknown" className="w-16 h-16" />
              </span>
              <p className="student-att-big-label">Not recorded yet</p>
              <p className="student-att-big-date">{formatFriendlyDate(date)}</p>
            </div>
          )}
        </>
      ) : (
        <>
      <div className="flex gap-4 mb-6">
        <div>
          <label className="label">{t('ui.date')}</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {!isFamily && (
          <div>
            <label className="label">{t('ui.class')}</label>
            <select className="input min-w-[200px]" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">{t('ui.allClasses')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="card">
        {students.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t('pageBody.attendance.noStudentsForFilters')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">{t('ui.studentId')}</th>
                  <th className="pb-3 font-medium">{t('ui.name')}</th>
                  <th className="pb-3 font-medium">{t('ui.class')}</th>
                  <th className="pb-3 font-medium">{t('ui.status')}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 text-brand-600">{s.studentId}</td>
                    <td className="py-3 font-medium">{s.firstName} {s.lastName}</td>
                    <td className="py-3 text-gray-400">{s.class?.name || '—'}</td>
                    <td className="py-3">
                      {isFamily ? (
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${statusColors[records[s.id]] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {records[s.id] ? t(ATTENDANCE_STATUS_I18N[records[s.id]] || 'ui.notRecorded') : t('ui.notRecorded')}
                        </span>
                      ) : (
                        <div className="flex gap-2">
                          {statusOptions.map((status) => (
                            <button
                              key={status}
                              onClick={() => setStatus(s.id, status)}
                              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                records[s.id] === status
                                  ? statusColors[status]
                                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                              }`}
                            >
                              {t(ATTENDANCE_STATUS_I18N[status])}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
