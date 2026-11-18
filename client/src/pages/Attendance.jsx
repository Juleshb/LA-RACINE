import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Save, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StudentPageHeader from '../components/student/StudentPageHeader';
import ParentChildFilter from '../components/parent/ParentChildFilter';
import AppIcon from '../components/icons/AppIcon';
import ListSearch, { matchesSearch } from '../components/ListSearch';
import { useTranslation } from '../context/LanguageContext';
import { useTableSort } from '../hooks/useTableSort';
import { studentFullName } from '../lib/studentName';

const statusOptions = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const statusTone = {
  PRESENT: 'is-present',
  ABSENT: 'is-absent',
  LATE: 'is-late',
  EXCUSED: 'is-excused',
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [markAllValue, setMarkAllValue] = useState('');
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

  const counts = useMemo(() => {
    const tally = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    students.forEach((student) => {
      const status = records[student.id];
      if (tally[status] != null) tally[status] += 1;
    });
    return tally;
  }, [students, records]);

  const searchedStudents = useMemo(() => students.filter((s) => {
    const status = records[s.id];
    const statusLabel = status ? t(ATTENDANCE_STATUS_I18N[status] || 'ui.notRecorded') : '';
    return matchesSearch(
      search,
      s.studentId,
      s.firstName,
      s.lastName,
      s.postName,
      s.class?.name,
      status,
      statusLabel,
    );
  }), [students, search, records, t]);

  const filteredStudents = useMemo(() => (
    statusFilter === 'ALL'
      ? searchedStudents
      : searchedStudents.filter((student) => records[student.id] === statusFilter)
  ), [searchedStudents, statusFilter, records]);

  const markVisible = (status) => {
    if (!status) return;
    setRecords((prev) => {
      const next = { ...prev };
      searchedStudents.forEach((student) => { next[student.id] = status; });
      return next;
    });
    setMarkAllValue('');
  };

  const getAttendanceSortValue = useCallback((row, key) => {
    switch (key) {
      case 'studentId': return row.studentId || '';
      case 'name': return studentFullName(row);
      case 'class': return row.class?.name || '';
      case 'status': return records[row.id] || '';
      default: return '';
    }
  }, [records]);

  const { sorted, sortKey, sortDir, setSortKey, setSortDir } = useTableSort(
    filteredStudents,
    getAttendanceSortValue,
    { initialKey: 'name' },
  );

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
        <div className="att-desk">
          <div className="card att-toolbar">
            <label className="att-field">
              <span className="label">{t('ui.date')}</span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            {!isFamily && (
              <label className="att-field">
                <span className="label">{t('ui.class')}</span>
                <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  <option value="">{t('ui.allClasses')}</option>
                  {[...classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="att-field">
              <span className="label">{t('pageBody.attendance.filterStatus')}</span>
              <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">{t('pageBody.attendance.allStatuses')}</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{t(ATTENDANCE_STATUS_I18N[status])}</option>
                ))}
              </select>
            </label>
            <label className="att-field">
              <span className="label">{t('pageBody.attendance.sortBy')}</span>
              <select
                className="input"
                value={`${sortKey}:${sortDir}`}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split(':');
                  setSortKey(key);
                  setSortDir(dir);
                }}
              >
                <option value="name:asc">{t('pageBody.attendance.sortName')}</option>
                <option value="name:desc">{t('pageBody.attendance.sortNameDesc')}</option>
                <option value="class:asc">{t('pageBody.attendance.sortClass')}</option>
                <option value="status:asc">{t('pageBody.attendance.sortStatus')}</option>
              </select>
            </label>
            {!isFamily && (
              <label className="att-field">
                <span className="label">{t('pageBody.attendance.markAll')}</span>
                <select className="input" value={markAllValue} onChange={(e) => markVisible(e.target.value)}>
                  <option value="">{t('pageBody.attendance.markAll')}</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{t(ATTENDANCE_STATUS_I18N[status])}</option>
                  ))}
                </select>
              </label>
            )}
            <ListSearch
              value={search}
              onChange={setSearch}
              placeholder={t('ui.searchStudent')}
              className="att-search"
            />
          </div>

          <div className="att-stats">
            {statusOptions.map((status) => (
              <button
                key={status}
                type="button"
                className={`att-stat ${statusTone[status]} ${statusFilter === status ? 'is-on' : ''}`}
                onClick={() => setStatusFilter((current) => (current === status ? 'ALL' : status))}
              >
                <span className="att-stat-value">{counts[status]}</span>
                <span className="att-stat-label">{t(ATTENDANCE_STATUS_I18N[status])}</span>
              </button>
            ))}
          </div>

          <div className="card att-list">
            <p className="att-list-meta">
              <Users className="w-4 h-4" />
              {filteredStudents.length}
            </p>
            {filteredStudents.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {students.length > 0 && (search.trim() || statusFilter !== 'ALL')
                  ? t('ui.noSearchResults')
                  : t('pageBody.attendance.noStudentsForFilters')}
              </p>
            ) : (
              <div className="att-table">
                <div className="att-head">
                  <span>{t('ui.studentId')}</span>
                  <span>{t('ui.name')}</span>
                  <span>{t('ui.class')}</span>
                  <span>{t('ui.status')}</span>
                </div>
                {sorted.map((s) => (
                  <div key={s.id} className="att-row">
                    <span className="att-id">{s.studentId || '—'}</span>
                    <span className="att-name">{studentFullName(s)}</span>
                    <span className="att-class">{s.class?.name || '—'}</span>
                    {isFamily ? (
                      <span className={`att-badge ${statusTone[records[s.id]] || ''}`}>
                        {records[s.id] ? t(ATTENDANCE_STATUS_I18N[records[s.id]]) : t('ui.notRecorded')}
                      </span>
                    ) : (
                      <select
                        className={`input att-status ${statusTone[records[s.id]] || ''}`}
                        value={records[s.id] || 'PRESENT'}
                        aria-label={t('ui.status')}
                        onChange={(e) => setStatus(s.id, e.target.value)}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>{t(ATTENDANCE_STATUS_I18N[status])}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
