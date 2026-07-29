import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Download, Printer, ChevronLeft, ChevronRight, Users, Calendar, GraduationCap, Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';
import ParentChildFilter from '../components/parent/ParentChildFilter';
import BulletinScolaireSheet from '../components/bulletin/BulletinScolaireSheet';
import { downloadBulletinPdf } from '../lib/bulletinPdf';

export default function BulletinReport() {
  const { campusId } = useCampus();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isParent = user?.role === 'PARENT';
  const isStudent = user?.role === 'STUDENT';
  const isTeacher = user?.role === 'TEACHER';
  const isFamily = isParent || isStudent;
  const sheetRef = useRef(null);
  const [classes, setClasses] = useState([]);
  const [children, setChildren] = useState([]);
  const [students, setStudents] = useState([]);
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [term, setTerm] = useState('Trimestre 1');
  const [terms, setTerms] = useState(['Trimestre 1', 'Trimestre 2', 'Trimestre 3']);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');

  const studentIndex = useMemo(
    () => students.findIndex((s) => s.id === studentId),
    [students, studentId],
  );

  useEffect(() => {
    if (isParent) {
      api.getParentChildren().then((list) => {
        setChildren(list);
        const first = list[0];
        if (first) {
          setClassId(first.classId || '');
          setStudentId(first.id);
        }
      }).catch(console.error);
      return;
    }
    if (isStudent) {
      api.getMe().then((data) => {
        const student = data.user?.student;
        if (student) {
          setClassId(student.classId || '');
          setStudentId(student.id);
          if (student.class) {
            setClasses([{ id: student.classId, name: student.class.name, grade: student.class.grade }]);
          }
        }
      }).catch(console.error);
      return;
    }
    api.getClasses().then((data) => {
      setClasses(data);
      if (data.length) setClassId(data[0].id);
    }).catch(console.error);
  }, [isParent, isStudent]);

  useEffect(() => {
    if (isFamily) return;
    if (!classId) {
      setStudents([]);
      setStudentId('');
      return;
    }
    api.getClassBulletinConfig(classId).then((data) => {
      if (data.config?.terms?.length) setTerms(data.config.terms);
    }).catch(console.error);
    api.getStudents({ classId }).then((data) => {
      setStudents(data);
      setStudentId(data[0]?.id || '');
    }).catch(console.error);
  }, [classId, isFamily]);

  useEffect(() => {
    if (!isParent || !children.length) return;
    const child = children.find((c) => c.id === studentId) || children[0];
    if (child?.classId) {
      setClassId(child.classId);
      api.getClassBulletinConfig(child.classId).then((data) => {
        if (data.config?.terms?.length) setTerms(data.config.terms);
      }).catch(console.error);
    }
  }, [isParent, children, studentId]);

  useEffect(() => {
    if (!isStudent || !classId) return;
    api.getClassBulletinConfig(classId).then((data) => {
      if (data.config?.terms?.length) setTerms(data.config.terms);
    }).catch(console.error);
  }, [isStudent, classId]);

  useEffect(() => {
    if (!classId || !studentId) {
      setReport(null);
      return;
    }
    setLoading(true);
    setError('');
    api.getBulletinReport(classId, studentId, term)
      .then(setReport)
      .catch((err) => {
        setError(err.message);
        setReport(null);
      })
      .finally(() => setLoading(false));
  }, [classId, studentId, term]);

  const goStudent = (delta) => {
    if (isParent) {
      const idx = children.findIndex((c) => c.id === studentId);
      const next = children[idx + delta];
      if (next) setStudentId(next.id);
      return;
    }
    const next = students[studentIndex + delta];
    if (next) setStudentId(next.id);
  };

  const selectedClass = isParent
    ? children.find((c) => c.id === studentId)?.class
    : classes.find((c) => c.id === classId);

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!report || !sheetRef.current) return;
    setPdfLoading(true);
    try {
      const name = `${report.student.studentId}-${report.term}`.replace(/\s+/g, '-');
      await downloadBulletinPdf(sheetRef.current, `bulletin-${name}.pdf`);
    } catch (err) {
      setError(err.message || 'Failed to generate PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="bulletin-report-page">
      <PageHeader
        title={isStudent
          ? t('pages.bulletin.titleStudent')
          : isParent
            ? t('pages.bulletin.titleParent')
            : isTeacher
              ? t('pages.bulletin.titleTeacher')
              : t('pages.bulletin.title')}
        description={isStudent
          ? t('pages.bulletin.descriptionStudent')
          : isParent
            ? t('pages.bulletin.descriptionParent')
            : isTeacher
              ? t('pages.bulletin.descriptionTeacher')
              : t('pages.bulletin.description')}
        action={(
          <div className="flex gap-2 print:hidden">
            {!isFamily && (
              <Link to={`/campus/${campusId}/marks`} className="btn-secondary flex items-center gap-2">
                {isTeacher ? t('pages.bulletin.enterMarks') : t('pages.bulletin.recordMarks')}
              </Link>
            )}
            <button
              type="button"
              onClick={handlePrint}
              disabled={!report}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {t('ui.print')}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!report || pdfLoading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {pdfLoading ? t('ui.loading') : t('ui.download')}
            </button>
          </div>
        )}
      />

      {isParent && (
        <ParentChildFilter
          children={children}
          value={studentId}
          onChange={setStudentId}
        />
      )}

      <div className="filter-panel print:hidden">
        <p className="filter-panel-title">{isFamily ? t('pages.bulletin.filterFamily') : t('pages.bulletin.filterStaff')}</p>
        <div className={`grid grid-cols-1 ${isFamily ? 'md:grid-cols-1 max-w-sm' : 'md:grid-cols-3'} gap-4`}>
          {!isFamily && (
            <div>
              <label className="label flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-gray-400" /> {t('ui.class')}
              </label>
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>
                ))}
              </select>
            </div>
          )}
          {!isParent && (
            <div>
              <label className="label flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gray-400" /> {t('ui.student')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="student-nav-btn shrink-0"
                  disabled={studentIndex <= 0}
                  onClick={() => goStudent(-1)}
                  aria-label={t('pages.bulletin.prevStudent')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select className="input flex-1" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                  {students.length === 0 ? (
                    <option value="">{t('pages.bulletin.noStudents')}</option>
                  ) : (
                    students.map((s) => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName} · {s.studentId}</option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  className="student-nav-btn shrink-0"
                  disabled={studentIndex < 0 || studentIndex >= students.length - 1}
                  onClick={() => goStudent(1)}
                  aria-label={t('pages.bulletin.nextStudent')}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="label flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" /> {t('pages.bulletin.trimestre')}
            </label>
            <select className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
              {terms.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {selectedClass && (
          <p className="text-xs text-gray-400 mt-3">
            {t('pages.bulletin.bulletinFormatHint', { className: selectedClass.name })}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100 print:hidden">{error}</div>
      )}

      {loading && (
        <div className="card empty-state print:hidden">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-2" />
          <p className="text-gray-500">{t('pages.bulletin.loadingBulletin')}</p>
        </div>
      )}

      {!loading && report && (
        <div className="bulletin-preview-wrap print:p-0">
          <div ref={sheetRef}>
            <BulletinScolaireSheet report={report} />
          </div>
        </div>
      )}
    </div>
  );
}
