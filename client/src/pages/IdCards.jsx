import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Download, IdCard, Loader2, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import ListSearch, { matchesSearch } from '../components/ListSearch';
import StudentIdCard from '../components/cards/StudentIdCard';
import StaffIdCard from '../components/cards/StaffIdCard';
import {
  downloadIdCardJpeg,
  downloadIdCardPdf,
  staffCardExportFields,
  studentCardExportFields,
} from '../lib/idCardPdf';
import { SortableTh, useTableSort } from '../hooks/useTableSort';

export default function IdCards() {
  const { campus, campusId, academicYear } = useCampus();
  const [searchParams] = useSearchParams();
  const cardRef = useRef(null);

  const initialStudent = searchParams.get('student') || '';
  const initialStaff = searchParams.get('staff') || '';
  const initialTab = searchParams.get('tab') === 'staff' || initialStaff ? 'staff' : 'students';

  const [tab, setTab] = useState(initialTab);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [school, setSchool] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(initialStaff || initialStudent || '');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [didPrefill, setDidPrefill] = useState(Boolean(initialStudent || initialStaff));

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.getStudents({ status: 'APPROVED' }),
      api.getTeachers(),
      api.getSchool().catch(() => null),
    ])
      .then(([studentList, teacherList, schoolData]) => {
        setStudents(Array.isArray(studentList) ? studentList : []);
        setTeachers(Array.isArray(teacherList) ? teacherList : []);
        setSchool(schoolData);
      })
      .catch((err) => setError(err.message || 'Failed to load cards data'))
      .finally(() => setLoading(false));
  }, [campusId]);

  const schoolName = school?.name || 'École La RACINE';
  const campusName = campus?.name || '';
  const yearName = academicYear?.name || '';

  const filteredStudents = useMemo(
    () => students.filter((s) => matchesSearch(
      search,
      s.studentId,
      s.lastName,
      s.postName,
      s.firstName,
      s.class?.name,
    )),
    [students, search],
  );

  const filteredTeachers = useMemo(
    () => teachers.filter((t) => matchesSearch(search, t.name, t.subject, t.email, t.phone)),
    [teachers, search],
  );

  const getStudentSortValue = useCallback((row, key) => {
    switch (key) {
      case 'studentId': return row.studentId || '';
      case 'name': return `${row.lastName || ''} ${row.postName || ''} ${row.firstName || ''}`.trim();
      case 'class': return row.class?.name || '';
      default: return '';
    }
  }, []);

  const getTeacherSortValue = useCallback((row, key) => {
    switch (key) {
      case 'name': return row.name || '';
      case 'subject': return row.subject || '';
      case 'phone': return row.phone || '';
      default: return '';
    }
  }, []);

  const {
    sorted: sortedStudents,
    sortKey: studentSortKey,
    sortDir: studentSortDir,
    toggleSort: toggleStudentSort,
  } = useTableSort(filteredStudents, getStudentSortValue, { initialKey: 'name' });

  const {
    sorted: sortedTeachers,
    sortKey: teacherSortKey,
    sortDir: teacherSortDir,
    toggleSort: toggleTeacherSort,
  } = useTableSort(filteredTeachers, getTeacherSortValue, { initialKey: 'name' });

  const selectedStudent = useMemo(() => {
    const base = filteredStudents.find((s) => s.id === selectedId)
      || students.find((s) => s.id === selectedId);
    if (!base) return null;
    if (studentDetail?.id === base.id) {
      return {
        ...base,
        ...studentDetail,
        class: studentDetail.class || base.class,
        studentId: studentDetail.studentId || base.studentId,
      };
    }
    return base;
  }, [filteredStudents, students, selectedId, studentDetail]);
  const selectedTeacher = filteredTeachers.find((t) => t.id === selectedId)
    || teachers.find((t) => t.id === selectedId);

  useEffect(() => {
    // Auto-select first row when tab/list changes (skip once if URL prefilled)
    if (didPrefill) {
      setDidPrefill(false);
      return;
    }
    if (tab === 'students') {
      const first = filteredStudents[0]?.id || '';
      if (!filteredStudents.some((s) => s.id === selectedId)) {
        setSelectedId(first);
      }
    } else {
      const first = filteredTeachers[0]?.id || '';
      if (!filteredTeachers.some((t) => t.id === selectedId)) {
        setSelectedId(first);
      }
    }
  }, [tab, filteredStudents, filteredTeachers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) {
      setPhotoUrl(null);
      setStudentDetail(null);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;
    setLoadingPhoto(true);

    const load = async () => {
      try {
        if (tab === 'students') {
          const data = await api.getStudent(selectedId);
          if (cancelled) return;
          setPhotoUrl(data.photoUrl || null);
          setStudentDetail(data);
        } else {
          setStudentDetail(null);
          const teacher = teachers.find((t) => t.id === selectedId);
          if (teacher?.hasPhoto) {
            const detail = await api.getTeacher(selectedId).catch(() => null);
            if (cancelled) return;
            if (detail?.photoUrl) {
              setPhotoUrl(detail.photoUrl);
            } else {
              objectUrl = await api.getTeacherPhotoUrl(selectedId);
              if (!cancelled) setPhotoUrl(objectUrl);
            }
          } else {
            setPhotoUrl(null);
          }
        }
      } catch {
        if (!cancelled) {
          setPhotoUrl(null);
          if (tab === 'students') setStudentDetail(null);
        }
      } finally {
        if (!cancelled) setLoadingPhoto(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [tab, selectedId, teachers]);

  const handleExport = async (kind) => {
    setExporting(kind);
    setError('');
    try {
      if (tab === 'students' && selectedStudent) {
        const code = selectedStudent.studentId || selectedStudent.id;
        const payload = {
          kind: 'student',
          fields: studentCardExportFields(selectedStudent, yearName),
          photoUrl,
          schoolName,
          campusName,
          academicYear: yearName,
        };
        if (kind === 'pdf') await downloadIdCardPdf(payload, `carte-eleve-${code}.pdf`);
        else await downloadIdCardJpeg(payload, `carte-eleve-${code}.jpg`);
      } else if (tab === 'staff' && selectedTeacher) {
        const code = (selectedTeacher.name || selectedTeacher.id).replace(/\s+/g, '-');
        const payload = {
          kind: 'staff',
          fields: staffCardExportFields(selectedTeacher, yearName, 'ENSEIGNANT'),
          photoUrl,
          schoolName,
          campusName,
          academicYear: yearName,
        };
        if (kind === 'pdf') await downloadIdCardPdf(payload, `carte-personnel-${code}.pdf`);
        else await downloadIdCardJpeg(payload, `carte-personnel-${code}.jpg`);
      } else {
        setError('Select a person before downloading.');
      }
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting('');
    }
  };

  return (
    <div>
      <PageHeader
        title="ID Cards"
        description="Student cards for accepted registrations, and staff cards for teachers."
      />

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${
            tab === 'students' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-700'
          }`}
          onClick={() => { setTab('students'); setSearch(''); }}
        >
          <IdCard className="w-4 h-4" />
          Students (accepted)
          <span className="opacity-80 text-xs">{students.length}</span>
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${
            tab === 'staff' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-700'
          }`}
          onClick={() => { setTab('staff'); setSearch(''); }}
        >
          <CreditCard className="w-4 h-4" />
          Staff
          <span className="opacity-80 text-xs">{teachers.length}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] gap-6">
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <ListSearch
              value={search}
              onChange={setSearch}
              placeholder={tab === 'students' ? 'Search accepted students…' : 'Search staff…'}
            />
          </div>

          {loading ? (
            <div className="py-16 flex justify-center text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : tab === 'students' ? (
            filteredStudents.length === 0 ? (
              <p className="text-center text-gray-500 py-12 px-4">
                {students.length === 0
                  ? 'No accepted students yet. Approve registrations first.'
                  : 'No students match your search.'}
              </p>
            ) : (
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500 sticky top-0">
                    <tr>
                      <SortableTh label="ID" columnKey="studentId" sortKey={studentSortKey} sortDir={studentSortDir} onSort={toggleStudentSort} className="px-4 py-2 font-medium" />
                      <SortableTh label="Name" columnKey="name" sortKey={studentSortKey} sortDir={studentSortDir} onSort={toggleStudentSort} className="px-4 py-2 font-medium" />
                      <SortableTh label="Class" columnKey="class" sortKey={studentSortKey} sortDir={studentSortDir} onSort={toggleStudentSort} className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((s) => (
                      <tr
                        key={s.id}
                        className={`border-t border-gray-100 cursor-pointer ${selectedId === s.id ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                        onClick={() => setSelectedId(s.id)}
                      >
                        <td className="px-4 py-2.5 text-brand-700 font-medium">{s.studentId}</td>
                        <td className="px-4 py-2.5">{s.lastName} {s.postName} {s.firstName}</td>
                        <td className="px-4 py-2.5 text-gray-500">{s.class?.name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredTeachers.length === 0 ? (
            <p className="text-center text-gray-500 py-12 px-4">
              {teachers.length === 0 ? 'No teachers yet.' : 'No staff match your search.'}
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500 sticky top-0">
                  <tr>
                    <SortableTh label="Name" columnKey="name" sortKey={teacherSortKey} sortDir={teacherSortDir} onSort={toggleTeacherSort} className="px-4 py-2 font-medium" />
                    <SortableTh label="Subject" columnKey="subject" sortKey={teacherSortKey} sortDir={teacherSortDir} onSort={toggleTeacherSort} className="px-4 py-2 font-medium" />
                    <SortableTh label="Phone" columnKey="phone" sortKey={teacherSortKey} sortDir={teacherSortDir} onSort={toggleTeacherSort} className="px-4 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {sortedTeachers.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-t border-gray-100 cursor-pointer ${selectedId === t.id ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-900">{t.name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{t.subject || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{t.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-semibold text-gray-900">Preview</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-1.5"
                  disabled={!selectedId || Boolean(exporting) || loadingPhoto}
                  onClick={() => handleExport('jpeg')}
                >
                  {exporting === 'jpeg' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  JPEG
                </button>
                <button
                  type="button"
                  className="btn-primary text-sm inline-flex items-center gap-1.5"
                  disabled={!selectedId || Boolean(exporting) || loadingPhoto}
                  onClick={() => handleExport('pdf')}
                >
                  {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  PDF
                </button>
              </div>
            </div>

            <div className="id-card-preview-stage">
              {tab === 'students' && selectedStudent ? (
                <StudentIdCard
                  ref={cardRef}
                  student={selectedStudent}
                  photoUrl={photoUrl}
                  schoolName={schoolName}
                  campusName={campusName}
                  academicYear={yearName}
                />
              ) : tab === 'staff' && selectedTeacher ? (
                <StaffIdCard
                  ref={cardRef}
                  staff={selectedTeacher}
                  photoUrl={photoUrl}
                  schoolName={schoolName}
                  campusName={campusName}
                  academicYear={yearName}
                  roleLabel="ENSEIGNANT"
                />
              ) : (
                <div className="text-center text-gray-400 py-16 text-sm flex flex-col items-center gap-2">
                  <Search className="w-6 h-6" />
                  Select a person to preview their card
                </div>
              )}
            </div>
            {loadingPhoto && (
              <p className="text-xs text-gray-500 mt-3 inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading photo…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
