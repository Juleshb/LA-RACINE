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
import NurseryBulletinSheet from '../components/bulletin/NurseryBulletinSheet';
import { downloadBulletinPdf, downloadBulletinJpeg } from '../lib/bulletinPdf';
import { isCrecheGrade, usesNurseryCompetence } from '../lib/grades';
import StudentSelect from '../components/StudentSelect';

const NURSERY_BULLETIN_TERM_OPTIONS = [
  { value: 'Trimestre 1', label: '1er Trimestre' },
  { value: 'Trimestre 2', label: '2ème Trimestre' },
  { value: 'Trimestre 3', label: '3ème Trimestre' },
  { value: 'Annuel', label: 'Bulletin annuel (année complète)' },
];

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
  const [jpegLoading, setJpegLoading] = useState(false);
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

  const selectedClass = isParent
    ? children.find((c) => c.id === studentId)?.class
    : classes.find((c) => c.id === classId);
  const isCrecheClass = isCrecheGrade(selectedClass?.grade);
  const isCompetenceClass = usesNurseryCompetence(selectedClass?.grade);
  const isCompetenceReport = report?.mode === 'COMPETENCE';

  useEffect(() => {
    if (!classId || !studentId || isCrecheClass) {
      setReport(null);
      setLoading(false);
      if (isCrecheClass) setError('');
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
  }, [classId, studentId, term, isCrecheClass]);

  useEffect(() => {
    if (!isCompetenceClass) return;
    if (!NURSERY_BULLETIN_TERM_OPTIONS.some((o) => o.value === term)) {
      setTerm('Trimestre 1');
    }
  }, [isCompetenceClass, term]);

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

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!report || !sheetRef.current) return;
    setPdfLoading(true);
    try {
      const name = `${report.student.studentId}-${report.term || 'bulletin'}`.replace(/\s+/g, '-');
      await downloadBulletinPdf(sheetRef.current, `bulletin-${name}.pdf`);
    } catch (err) {
      setError(err.message || 'Failed to generate PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadJpeg = async () => {
    if (!report || !sheetRef.current) return;
    setJpegLoading(true);
    try {
      const name = `${report.student.studentId}-${report.term || 'bulletin'}`.replace(/\s+/g, '-');
      await downloadBulletinJpeg(sheetRef.current, `bulletin-${name}.jpg`);
    } catch (err) {
      setError(err.message || 'Failed to generate JPEG');
    } finally {
      setJpegLoading(false);
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
              disabled={!report || isCrecheClass}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {t('ui.print')}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!report || pdfLoading || jpegLoading || isCrecheClass}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {pdfLoading ? t('ui.loading') : 'PDF'}
            </button>
            <button
              type="button"
              onClick={handleDownloadJpeg}
              disabled={!report || pdfLoading || jpegLoading || isCrecheClass}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {jpegLoading ? t('ui.loading') : 'JPEG'}
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
        <div className={`grid grid-cols-1 ${isFamily ? (isCompetenceClass ? 'md:grid-cols-1 max-w-sm' : 'md:grid-cols-1 max-w-sm') : 'md:grid-cols-3'} gap-4`}>
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
                <StudentSelect
                  className="flex-1"
                  students={students}
                  value={studentId}
                  onChange={setStudentId}
                  allowEmpty={students.length === 0}
                  emptyLabel={t('pages.bulletin.noStudents')}
                  getLabel={(s) => `${s.firstName} ${s.lastName} · ${s.studentId}`}
                />
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
              {isCompetenceClass
                ? NURSERY_BULLETIN_TERM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))
                : terms.map((tr) => <option key={tr} value={tr}>{tr}</option>)}
            </select>
          </div>
        </div>
        {isCompetenceClass && (
          <p className="text-xs text-gray-400 mt-3">
            Choose one trimestre for a single-term bulletin, or Bulletin annuel for the full year (T1 + T2 + T3 + Résultat Annuel).
          </p>
        )}
        {selectedClass && (
          <p className="text-xs text-gray-400 mt-3">
            {t('pages.bulletin.bulletinFormatHint', { className: selectedClass.name })}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100 print:hidden">{error}</div>
      )}

      {isCrecheClass && (
        <div className="card empty-state py-16 text-center print:hidden">
          <p className="text-gray-800 font-semibold text-lg">Crèche</p>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Aucun bulletin n&apos;est généré pour la Crèche. Les notes et bulletins concernent la maternelle (M1–TOP) et le primaire.
          </p>
        </div>
      )}

      {loading && !isCrecheClass && (
        <div className="card empty-state print:hidden">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-2" />
          <p className="text-gray-500">{t('pages.bulletin.loadingBulletin')}</p>
        </div>
      )}

      {!loading && !isCrecheClass && report && (
        <div className="bulletin-preview-wrap print:p-0">
          <div ref={sheetRef}>
            {isCompetenceReport || report.mode === 'COMPETENCE' ? (
              <NurseryBulletinSheet report={report} />
            ) : (
              <BulletinScolaireSheet report={report} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
