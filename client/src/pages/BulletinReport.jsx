import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Download, Printer, ChevronLeft, ChevronRight, Users, Calendar, GraduationCap, Loader2, FileSpreadsheet,
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
import ProclamationSheet from '../components/bulletin/ProclamationSheet';
import { downloadBulletinPdf, downloadBulletinJpeg } from '../lib/bulletinPdf';
import { downloadClassBulletinsPdf } from '../lib/classBulletinPdf';
import { downloadClassProclamation } from '../lib/proclamationExport';
import { usesCompetenceBulletin } from '../lib/grades';
import StudentSelect from '../components/StudentSelect';
import { studentFullName } from '../lib/studentName';

const PRIMARY_BULLETIN_TERM_OPTIONS = [
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
  const [periodScope, setPeriodScope] = useState('full');
  const [terms, setTerms] = useState(['Trimestre 1', 'Trimestre 2', 'Trimestre 3']);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [jpegLoading, setJpegLoading] = useState(false);
  const [proclamationLoading, setProclamationLoading] = useState(false);
  const [classPdf, setClassPdf] = useState(null);
  const [proclamation, setProclamation] = useState(null);
  const [error, setError] = useState('');
  const proclamationRef = useRef(null);

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
      setStudentId((current) => (data.some((student) => student.id === current) ? current : ''));
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
  const isCompetenceClass = usesCompetenceBulletin(selectedClass?.grade);
  const isCompetenceReport = report?.mode === 'COMPETENCE';

  useEffect(() => {
    if (!classId || !studentId) {
      setReport(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    api.getBulletinReport(classId, studentId, term, term === 'Annuel' ? 'full' : periodScope)
      .then(setReport)
      .catch((err) => {
        setError(err.message);
        setReport(null);
      })
      .finally(() => setLoading(false));
  }, [classId, studentId, term, periodScope]);

  useEffect(() => {
    if (!PRIMARY_BULLETIN_TERM_OPTIONS.some((o) => o.value === term)) {
      setTerm('Trimestre 1');
    }
  }, [term]);

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

  useEffect(() => {
    setProclamation(null);
  }, [classId, term]);

  useEffect(() => {
    if (!proclamation) return;
    proclamationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [proclamation]);

  const handleProclamation = async () => {
    if (!classId || isCompetenceClass) return;
    setProclamationLoading(true);
    setError('');
    try {
      const data = await api.getClassProclamation(classId, term);
      setProclamation(data);
    } catch (err) {
      setError(err.message || 'Failed to generate the proclamation');
    } finally {
      setProclamationLoading(false);
    }
  };

  const handleClassBulletins = async () => {
    if (!classId || !students.length || classPdf) return;
    setClassPdf({ done: 0, total: students.length });
    setError('');
    const failures = [];
    try {
      const fetched = await Promise.all(students.map(async (student) => {
        try {
          return await api.getBulletinReport(classId, student.id, term, term === 'Annuel' ? 'full' : periodScope);
        } catch (err) {
          failures.push(studentFullName(student));
          return null;
        }
      }));
      const ready = fetched.filter(Boolean);
      if (!ready.length) throw new Error(failures[0] ? `Failed to generate bulletins` : 'No bulletins to download');
      const safe = `${selectedClass?.name || 'classe'}-${term}${periodScope === 'period1' && term !== 'Annuel' ? '-periode-1' : ''}`.replace(/\s+/g, '-');
      await downloadClassBulletinsPdf(ready, `bulletins-${safe}.pdf`, setClassPdf);
      if (failures.length) {
        setError(`Some bulletins were skipped: ${failures.join(', ')}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to download class bulletins');
    } finally {
      setClassPdf(null);
    }
  };

  const handleDownloadProclamation = async () => {
    if (!proclamation) return;
    setError('');
    try {
      await downloadClassProclamation(proclamation);
    } catch (err) {
      setError(err.message || 'Failed to download the proclamation');
    }
  };

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
              disabled={!report}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {t('ui.print')}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!report || pdfLoading || jpegLoading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {pdfLoading ? t('ui.loading') : 'PDF'}
            </button>
            <button
              type="button"
              onClick={handleDownloadJpeg}
              disabled={!report || pdfLoading || jpegLoading}
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
        <div className={`grid grid-cols-1 ${isFamily ? 'md:grid-cols-2 max-w-3xl' : 'md:grid-cols-4'} gap-4`}>
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
                  allowEmpty
                  placeholder={students.length ? t('pages.bulletin.selectStudent') : t('pages.bulletin.noStudents')}
                  emptyLabel={students.length ? t('pages.bulletin.selectStudent') : t('pages.bulletin.noStudents')}
                  getLabel={(s) => `${studentFullName(s)} · ${s.studentId}`}
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
              {PRIMARY_BULLETIN_TERM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {!isCompetenceClass && term !== 'Annuel' && (
            <div>
              <label className="label">{t('pages.bulletin.periodScope')}</label>
              <select className="input" value={periodScope} onChange={(e) => setPeriodScope(e.target.value)}>
                <option value="full">{t('pages.bulletin.periodScopeFull')}</option>
                <option value="period1">{t('pages.bulletin.periodScopePeriod1')}</option>
              </select>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          {periodScope === 'period1' && term !== 'Annuel'
            ? t('pages.bulletin.periodScopePeriod1Hint')
            : (
              <>
                Choose one trimestre for a single-term bulletin, or Bulletin annuel for the full year
                {isCompetenceClass ? ' (T1 + T2 + T3 + Résultat Annuel).' : ' (T1 + T2 + T3 + MAX / P.O).'}
              </>
            )}
        </p>
        {selectedClass && (
          <p className="text-xs text-gray-400 mt-3">
            {t('pages.bulletin.bulletinFormatHint', { className: selectedClass.name })}
          </p>
        )}
        {!isFamily && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleClassBulletins}
              disabled={!classId || !students.length || classPdf || proclamationLoading}
              title={t('pages.bulletin.classBulletinsHint')}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              {classPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {classPdf
                ? `${classPdf.done} / ${classPdf.total}`
                : t('pages.bulletin.classBulletins')}
            </button>
            <button
              type="button"
              onClick={handleProclamation}
              disabled={!classId || proclamationLoading || classPdf || isCompetenceClass}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              {proclamationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              {proclamationLoading ? t('ui.loading') : t('pages.bulletin.proclamation')}
            </button>
            <p className="text-xs text-gray-400">{t('pages.bulletin.proclamationHint')}</p>
          </div>
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

      {!loading && !report && !error && !isFamily && !studentId && !proclamation && (
        <div className="card empty-state print:hidden">
          <p className="text-gray-500">{t('pages.bulletin.selectToView')}</p>
        </div>
      )}

      {proclamation && (
        <div ref={proclamationRef} className="proclamation-preview mb-6">
          <div className="flex flex-wrap items-center justify-end gap-2 mb-3 print:hidden">
            <button
              type="button"
              onClick={() => setProclamation(null)}
              className="btn-secondary"
            >
              {t('ui.close')}
            </button>
            <button
              type="button"
              onClick={handleDownloadProclamation}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {t('ui.download')} Excel
            </button>
          </div>
          <ProclamationSheet report={proclamation} />
        </div>
      )}

      {!loading && report && (
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
