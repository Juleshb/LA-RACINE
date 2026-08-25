import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Plus, Save, ChevronDown, ChevronUp, Info, FileText, Users, BookOpen, Calendar,
  CheckCircle2, Loader2, Cloud, Search, Settings2, ArrowRight, FileSpreadsheet, Download,
} from 'lucide-react';
import { Navigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';
import BulletinSteps from '../components/bulletin/BulletinSteps';
import SubjectTestManager from '../components/marks/SubjectTestManager';
import NurseryCompetenceMarks from '../components/marks/NurseryCompetenceMarks';
import MarksExcelImportModal from '../components/marks/MarksExcelImportModal';
import { downloadMarksImportTemplate } from '../lib/marksExcelImport';
import ScoreBadge from '../components/bulletin/ScoreBadge';
import { formatGradingScale, groupCoursesByCategory } from '../lib/curriculum';
import { isCrecheGrade, usesNurseryCompetence } from '../lib/grades';
import {
  getMaxForAssessment,
  courseUsesBulletinScale,
  getAssessmentsForCourse,
  parseAssessmentStepId,
  DEFAULT_TERMS,
} from '../lib/bulletin';
import { SortableTh, useTableSort } from '../hooks/useTableSort';

const LEGACY_TERMS = ['Term 1', 'Term 2', 'Term 3'];
const LEGACY_ASSESSMENTS = ['CAT', 'Mid-term', 'Final'];
const AUTO_SAVE_DELAY_MS = 1000;

function serializeRecords(records) {
  return JSON.stringify(records);
}

function hasSavableMarks(records) {
  return Object.values(records).some((r) => {
    const score = r?.score;
    return score !== '' && score != null && !Number.isNaN(Number(score));
  });
}

export default function Marks() {
  const { user } = useAuth();
  const { campusId } = useCampus();
  const { t } = useTranslation();
  const isTeacher = user?.role === 'TEACHER';

  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [classBulletinConfig, setClassBulletinConfig] = useState(null);
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState('Trimestre 1');
  const [assessedOn, setAssessedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [assessment, setAssessment] = useState('TEST1');
  const [catNumber, setCatNumber] = useState(1);
  const [catOptions, setCatOptions] = useState([]);
  const [nextCatNumber, setNextCatNumber] = useState(1);
  const [savedAssessments, setSavedAssessments] = useState([]);
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({});
  const [maxScore, setMaxScore] = useState(100);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [showTestsSetup, setShowTestsSetup] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [subjectTests, setSubjectTests] = useState([]);
  const [testsMarkMax, setTestsMarkMax] = useState('');
  const [examMax, setExamMax] = useState('');
  const [totalMax, setTotalMax] = useState('');
  const [testsDraft, setTestsDraft] = useState([]);
  const [testsSaving, setTestsSaving] = useState(false);
  const [testsLoading, setTestsLoading] = useState(false);

  const lastSavedRef = useRef('');
  const hydratedRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const savingRef = useRef(false);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === subjectId) || null,
    [courses, subjectId],
  );
  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classes, classId],
  );
  const courseWithTests = useMemo(() => {
    if (!selectedCourse) return null;
    return {
      ...selectedCourse,
      assessments: subjectTests,
      testsMarkMax: testsMarkMax === '' ? selectedCourse.testsMarkMax : testsMarkMax,
      examMax: examMax === '' ? selectedCourse.examMax : examMax,
      totalMax: totalMax === '' ? selectedCourse.totalMax : totalMax,
    };
  }, [selectedCourse, subjectTests, testsMarkMax, examMax, totalMax]);
  const isBulletinCourse = useMemo(
    () => courseUsesBulletinScale(courseWithTests),
    [courseWithTests],
  );
  const bulletinAssessments = useMemo(
    () => getAssessmentsForCourse(courseWithTests, classBulletinConfig),
    [courseWithTests, classBulletinConfig],
  );
  const usesFlexibleTests = subjectTests.length > 0;
  const activeAssessment = useMemo(
    () => parseAssessmentStepId(assessment),
    [assessment],
  );
  const assessmentTypes = useMemo(
    () => (isBulletinCourse
      ? bulletinAssessments.map((a) => a.key)
      : LEGACY_ASSESSMENTS),
    [isBulletinCourse, bulletinAssessments],
  );
  const terms = useMemo(
    () => (isBulletinCourse
      ? (classBulletinConfig?.terms || DEFAULT_TERMS)
      : [...DEFAULT_TERMS, ...LEGACY_TERMS]),
    [isBulletinCourse, classBulletinConfig],
  );
  const courseGroups = useMemo(() => groupCoursesByCategory(courses), [courses]);
  const subjectInClass = Boolean(subjectId && courses.some((c) => c.id === subjectId));
  const bulletinAssessmentKey = useMemo(
    () => bulletinAssessments.map((a) => a.key).join('|'),
    [bulletinAssessments],
  );

  useEffect(() => {
    api.getClasses().then((data) => {
      setClasses(data);
      if (data.length > 0) setClassId(data[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!classId) {
      setClassBulletinConfig(null);
      return;
    }
    api.getClassBulletinConfig(classId)
      .then((data) => setClassBulletinConfig(data.config))
      .catch(console.error);
  }, [classId]);

  useEffect(() => {
    if (!classId) {
      setCourses([]);
      setSubjectId('');
      return undefined;
    }

    let cancelled = false;
    setCoursesLoading(true);
    setSubjectId('');
    setStudents([]);
    setRecords({});
    setMessage('');

    api.getCourses(classId)
      .then((data) => {
        if (cancelled) return;
        setCourses(data);
        setSubjectId(data[0]?.id || '');
      })
      .catch((err) => {
        if (cancelled) return;
        setCourses([]);
        setSubjectId('');
        setMessage(err.message);
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });

    return () => { cancelled = true; };
  }, [classId]);

  useEffect(() => {
    if (!subjectId || !subjectInClass) {
      setSubjectTests([]);
      setTestsMarkMax('');
      setExamMax('');
      setTotalMax('');
      setTestsDraft([]);
      return undefined;
    }

    let cancelled = false;
    setTestsLoading(true);
    api.getSubjectTests(subjectId)
      .then((data) => {
        if (cancelled) return;
        setSubjectTests(data.tests || []);
        setTestsMarkMax(data.testsMarkMax ?? '');
        setExamMax(data.examMax ?? '');
        setTotalMax(data.totalMax ?? '');
        setTestsDraft((data.tests || []).map((t) => ({
          id: t.id,
          label: t.label,
          maxScore: t.maxScore,
          date: t.date ? new Date(t.date).toISOString().slice(0, 10) : '',
          sortOrder: t.sortOrder,
        })));
        if ((data.tests || []).length > 0) {
          setAssessment(`TEST:${data.tests[0].sortOrder}`);
        }
      })
      .catch((err) => {
        if (!cancelled) console.error(err);
      })
      .finally(() => {
        if (!cancelled) setTestsLoading(false);
      });

    return () => { cancelled = true; };
  }, [subjectId, subjectInClass]);

  useEffect(() => {
    if (!subjectId || !subjectInClass) {
      setSavedAssessments([]);
      return undefined;
    }

    let cancelled = false;
    api.getMarkAssessments(subjectId, term).then((data) => {
      if (cancelled) return;
      let nextSaved;
      if (usesFlexibleTests) {
        nextSaved = bulletinAssessments
          .filter((a) => {
            if (a.assessment === 'EX') {
              return (data.others || []).some((o) => o.assessment === 'EX');
            }
            return (data.others || []).some((o) => o.assessment === 'TEST' && o.catNumber === a.catNumber);
          })
          .map((a) => a.key);
      } else {
        const keys = bulletinAssessments.map((a) => a.key);
        nextSaved = keys.filter((a) =>
          (data.others || []).some((o) => o.assessment === a),
        );
      }
      setSavedAssessments((prev) => (
        prev.length === nextSaved.length && prev.every((k, i) => k === nextSaved[i])
          ? prev
          : nextSaved
      ));

      if (assessment === 'CAT') {
        setCatOptions(data.cats || []);
        setNextCatNumber(data.nextCatNumber || 1);
        if (data.cats?.length) {
          setCatNumber(data.cats[data.cats.length - 1].catNumber);
        } else {
          setCatNumber(data.nextCatNumber || 1);
        }
      }
    }).catch(console.error);

    return () => { cancelled = true; };
  }, [subjectId, term, assessment, bulletinAssessments, bulletinAssessmentKey, subjectInClass, usesFlexibleTests]);

  useEffect(() => {
    if (!classId || !subjectId || !subjectInClass) {
      setStudents([]);
      setRecords({});
      return undefined;
    }

    let cancelled = false;
    hydratedRef.current = false;
    setAutoSaveStatus('idle');
    const catNum = activeAssessment.assessment === 'CAT'
      ? catNumber
      : activeAssessment.assessment === 'TEST'
        ? activeAssessment.catNumber
        : 0;

    api.getMarks(classId, subjectId, term, activeAssessment.assessment, catNum).then((data) => {
      if (cancelled) return;
      setStudents(data.students);
      const initial = {};
      data.students.forEach((s) => {
        initial[s.id] = {
          score: s.mark?.score ?? '',
          maxScore: s.mark?.maxScore ?? 100,
          notes: s.mark?.notes ?? '',
        };
      });
      setRecords(initial);
      lastSavedRef.current = serializeRecords(initial);
      hydratedRef.current = true;
      setAutoSaveStatus('saved');
      const firstWithMark = data.students.find((s) => s.mark);
      if (firstWithMark?.mark?.maxScore) setMaxScore(firstWithMark.mark.maxScore);
      setMessage('');
    }).catch((err) => {
      if (!cancelled) setMessage(err.message);
    });

    return () => {
      cancelled = true;
      hydratedRef.current = false;
    };
  }, [classId, subjectId, term, assessment, catNumber, subjectInClass, activeAssessment.assessment, activeAssessment.catNumber]);

  useEffect(() => {
    if (!courseWithTests) return;
    if (isBulletinCourse && assessmentTypes.length > 0 && !assessmentTypes.includes(assessment)) {
      setAssessment(assessmentTypes[0]);
    }
    if (!isBulletinCourse && !LEGACY_ASSESSMENTS.includes(assessment)) {
      setAssessment('CAT');
    }
  }, [subjectId, isBulletinCourse, bulletinAssessmentKey, assessment, assessmentTypes]);

  useEffect(() => {
    if (!courseWithTests) return;
    const def = bulletinAssessments.find((a) => a.key === assessment);
    if (!def) return;
    const nextMax = getMaxForAssessment(courseWithTests, def);
    setMaxScore((prev) => (prev === nextMax ? prev : nextMax));
  }, [assessment, courseWithTests, bulletinAssessmentKey, bulletinAssessments]);

  const refreshSavedAssessments = useCallback(async () => {
    if (!subjectId) return;
    const data = await api.getMarkAssessments(subjectId, term);
    let nextSaved;
    if (usesFlexibleTests) {
      nextSaved = bulletinAssessments
        .filter((a) => {
          if (a.assessment === 'EX') {
            return (data.others || []).some((o) => o.assessment === 'EX');
          }
          return (data.others || []).some((o) => o.assessment === 'TEST' && o.catNumber === a.catNumber);
        })
        .map((a) => a.key);
    } else {
      const keys = bulletinAssessments.map((a) => a.key);
      nextSaved = keys.filter((a) =>
        (data.others || []).some((o) => o.assessment === a),
      );
    }
    setSavedAssessments((prev) => (
      prev.length === nextSaved.length && prev.every((k, i) => k === nextSaved[i])
        ? prev
        : nextSaved
    ));

    if (assessment === 'CAT') {
      setCatOptions(data.cats || []);
      setNextCatNumber(data.nextCatNumber || 1);
    }
    return nextSaved;
  }, [subjectId, term, assessment, bulletinAssessments, usesFlexibleTests]);

  const recordsRef = useRef(records);
  recordsRef.current = records;
  const studentsRef = useRef(students);
  studentsRef.current = students;

  const performSave = useCallback(async ({ auto = false } = {}) => {
    const currentRecords = recordsRef.current;
    const currentStudents = studentsRef.current;
    if (!subjectId || currentStudents.length === 0 || savingRef.current) return false;
    if (!hasSavableMarks(currentRecords)) return false;

    savingRef.current = true;
    setSaving(true);
    if (auto) setAutoSaveStatus('saving');
    else setMessage('');

    try {
      const payload = {
        subjectId,
        term,
        assessment: activeAssessment.assessment,
        catNumber: activeAssessment.assessment === 'CAT'
          ? catNumber
          : activeAssessment.assessment === 'TEST'
            ? activeAssessment.catNumber
            : 0,
        records: currentStudents.map((s) => ({
          studentId: s.id,
          score: currentRecords[s.id]?.score,
          maxScore,
          notes: currentRecords[s.id]?.notes || null,
        })),
        assessedOn,
      };
      const result = await api.saveMarks(payload);
      lastSavedRef.current = serializeRecords(currentRecords);

      const bulletinSaved = await refreshSavedAssessments();

      if (auto) {
        setAutoSaveStatus('saved');
        setMessage('');
      } else {
        setMessage(`Marks saved for ${result.saved} student(s) — ${result.label || assessment}.`);
        if (isBulletinCourse) {
          const keys = bulletinAssessments.map((a) => a.key);
          const next = keys.find((a) => !bulletinSaved.includes(a));
          const currentLabel = bulletinAssessments.find((a) => a.key === assessment)?.label || assessment;
          if (next && next !== assessment) {
            const nextLabel = bulletinAssessments.find((a) => a.key === next)?.label || next;
            setMessage(`Saved ${result.saved} student(s) for ${currentLabel}. Next: record ${nextLabel}.`);
          }
        }
      }
      return true;
    } catch (err) {
      if (auto) setAutoSaveStatus('error');
      setMessage(err.message);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    subjectId,
    term,
    assessedOn,
    assessment,
    activeAssessment.assessment,
    activeAssessment.catNumber,
    catNumber,
    maxScore,
    refreshSavedAssessments,
    isBulletinCourse,
    bulletinAssessments,
  ]);

  useEffect(() => {
    if (!hydratedRef.current || !subjectId || students.length === 0) return undefined;

    const current = serializeRecords(records);
    if (current === lastSavedRef.current) {
      setAutoSaveStatus((s) => (s === 'pending' || s === 'saving' ? 'saved' : s));
      return undefined;
    }

    if (!hasSavableMarks(records)) return undefined;

    setAutoSaveStatus('pending');
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      performSave({ auto: true });
    }, AUTO_SAVE_DELAY_MS);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [records, subjectId, students.length, performSave]);

  const setScore = (studentId, value) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], score: value },
    }));
  };

  const setNotes = (studentId, value) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], notes: value },
    }));
  };

  const handleAddCat = () => {
    setCatNumber(nextCatNumber);
    setStudents([]);
    setRecords({});
    setMessage('');
    hydratedRef.current = false;
    setAutoSaveStatus('idle');
  };

  const handleSaveTests = async () => {
    if (!subjectId) return;
    setTestsSaving(true);
    setMessage('');
    try {
      const result = await api.saveSubjectTests({
        subjectId,
        testsMarkMax: Number(testsMarkMax) || undefined,
        examMax: Number(examMax) || undefined,
        tests: testsDraft.map((t, index) => ({
          id: t.id,
          label: t.label || `Test ${index + 1}`,
          maxScore: Number(t.maxScore),
          date: t.date || null,
          sortOrder: index + 1,
        })),
      });
      setSubjectTests(result.tests || []);
      setTestsMarkMax(result.testsMarkMax ?? '');
      setExamMax(result.examMax ?? '');
      setTotalMax(result.totalMax ?? '');
      setTestsDraft((result.tests || []).map((t) => ({
        id: t.id,
        label: t.label,
        maxScore: t.maxScore,
        date: t.date ? new Date(t.date).toISOString().slice(0, 10) : '',
        sortOrder: t.sortOrder,
      })));
      setCourses((prev) => prev.map((c) => (
        c.id === subjectId
          ? {
            ...c,
            testsMarkMax: result.testsMarkMax,
            examMax: result.examMax,
            totalMax: result.totalMax,
          }
          : c
      )));
      if (!result.steps?.some((s) => s.key === assessment)) {
        setAssessment(result.steps?.[0]?.key || `TEST:${result.tests?.[0]?.sortOrder || 1}`);
      }
      setMessage('Test and exam setup saved. Record each test, then the exam.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setTestsSaving(false);
    }
  };

  const handleSave = () => performSave({ auto: false });

  const filledCount = students.filter((s) => {
    const score = records[s.id]?.score;
    return score !== '' && score != null && !Number.isNaN(Number(score));
  }).length;
  const progressPct = students.length ? Math.round((filledCount / students.length) * 100) : 0;
  const currentAssessmentLabel = bulletinAssessments.find((a) => a.key === assessment)?.label || assessment;

  const handleDownloadMarksTemplate = () => {
    if (!students.length) return;
    downloadMarksImportTemplate({
      className: selectedClass?.name,
      subjectName: selectedCourse?.name,
      term,
      assessmentLabel: currentAssessmentLabel,
      assessmentKey: assessment,
      maxScore,
      assessedOn,
      students,
      records,
    });
  };

  const handleImportMarks = async (rows) => {
    const next = { ...records };
    for (const row of rows) {
      next[row.studentId] = {
        score: row.score,
        maxScore: row.maxScore || maxScore,
        notes: row.notes || next[row.studentId]?.notes || '',
      };
    }
    setRecords(next);

    // Save immediately with imported values (don't wait for state flush)
    if (!subjectId) throw new Error('Select a subject first');
    if (savingRef.current) throw new Error('Save already in progress — try again');
    savingRef.current = true;
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        subjectId,
        term,
        assessment: activeAssessment.assessment,
        catNumber: activeAssessment.assessment === 'CAT'
          ? catNumber
          : activeAssessment.assessment === 'TEST'
            ? activeAssessment.catNumber
            : 0,
        records: students.map((s) => ({
          studentId: s.id,
          score: next[s.id]?.score,
          maxScore,
          notes: next[s.id]?.notes || null,
        })),
        assessedOn,
      };
      const result = await api.saveMarks(payload);
      lastSavedRef.current = serializeRecords(next);
      hydratedRef.current = true;
      setAutoSaveStatus('saved');
      await refreshSavedAssessments();
      setMessage(`Imported and saved ${rows.length} mark(s) — ${result.label || currentAssessmentLabel}.`);
    } catch (err) {
      setAutoSaveStatus('error');
      setMessage(err.message);
      throw err;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const visibleStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const hay = `${s.firstName || ''} ${s.lastName || ''} ${s.studentId || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [students, studentSearch]);

  const getMarksSortValue = useCallback((row, key) => {
    switch (key) {
      case 'studentId': return row.studentId || '';
      case 'name': return `${row.firstName || ''} ${row.lastName || ''}`.trim();
      case 'score': {
        const score = records[row.id]?.score;
        if (score === '' || score == null || Number.isNaN(Number(score))) return null;
        return Number(score);
      }
      case 'pct': {
        const score = records[row.id]?.score;
        if (score === '' || score == null || Number.isNaN(Number(score)) || !maxScore) return null;
        return Number(score) / Number(maxScore);
      }
      default: return '';
    }
  }, [records, maxScore]);

  const { sorted: sortedStudents, sortKey, sortDir, toggleSort } = useTableSort(
    visibleStudents,
    getMarksSortValue,
    { initialKey: 'name' },
  );

  const focusScoreInput = (index) => {
    const el = document.querySelector(`[data-mark-score="${index}"]`);
    if (el) {
      el.focus();
      el.select?.();
    }
  };

  const onScoreKeyDown = (e, index) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusScoreInput(index + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusScoreInput(index - 1);
    }
  };

  const autoSaveLabel = {
    idle: null,
    pending: t('pages.marks.autosavePending'),
    saving: t('pages.marks.autosaveSaving'),
    saved: t('pages.marks.autosaveSaved'),
    error: t('pages.marks.autosaveError'),
  }[autoSaveStatus];

  const autoSaveIcon = autoSaveStatus === 'saving' ? Loader2
    : autoSaveStatus === 'saved' ? CheckCircle2
      : Cloud;

  const AutoSaveIcon = autoSaveIcon;

  useEffect(() => {
    if (isBulletinCourse && selectedCourse && !testsLoading && testsDraft.length === 0) {
      setShowTestsSetup(true);
    }
  }, [isBulletinCourse, selectedCourse, testsLoading, testsDraft.length]);

  if (user?.role === 'PARENT') {
    return <Navigate to={`/campus/${campusId}/bulletin-report`} replace />;
  }

  if (isCrecheGrade(selectedClass?.grade)) {
    return (
      <div>
        <PageHeader
          title={isTeacher ? t('pages.marks.titleTeacher') : t('pages.marks.title')}
          description="Crèche — pas de notes ni de bulletin"
        />
        <div className="card empty-state py-16 text-center">
          <p className="text-gray-800 font-semibold text-lg">Crèche</p>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Aucune note ni bulletin n&apos;est requis pour la Crèche.
            Choisissez une autre classe (maternelle M1–TOP ou primaire) pour saisir des notes.
          </p>
          <div className="mt-6 max-w-sm mx-auto text-left">
            <label className="label">{t('ui.class')}</label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (usesNurseryCompetence(selectedClass?.grade)) {
    return (
      <NurseryCompetenceMarks
        campusId={campusId}
        classes={classes.filter((c) => usesNurseryCompetence(c.grade))}
        classId={classId}
        onClassChange={setClassId}
        t={t}
        isTeacher={isTeacher}
      />
    );
  }

  return (
    <div className="pm-page">
      <PageHeader
        title={isTeacher ? t('pages.marks.titleTeacher') : t('pages.marks.title')}
        description={isTeacher
          ? t('pages.marks.descriptionTeacher')
          : t('pages.marks.description')}
        action={(
          <div className="flex gap-2 flex-wrap items-center">
            {!isTeacher && (
              <>
                <Link to={`/campus/${campusId}/midterms`} className="btn-secondary flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Périodes
                </Link>
                <Link to={`/campus/${campusId}/bulletin-report`} className="btn-secondary flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {t('pages.bulletin.title')}
                </Link>
              </>
            )}
            <button
              type="button"
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
              disabled={students.length === 0}
              onClick={handleDownloadMarksTemplate}
              title={t('pages.marks.downloadTemplate')}
            >
              <Download className="w-4 h-4" />
              {t('pages.marks.template')}
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
              disabled={students.length === 0}
              onClick={() => setImportOpen(true)}
              title={t('pages.marks.importExcel')}
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t('pages.marks.import')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !subjectId || students.length === 0 || !hasSavableMarks(records)}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
              title={t('pages.marks.saveNowTitle')}
            >
              <Save className="w-4 h-4" />
              {saving ? t('ui.saving') : t('ui.save')}
            </button>
          </div>
        )}
      />

      {/* Step 1 — Context */}
      <section className="pm-setup card">
        <div className="pm-setup-head">
          <div>
            <p className="pm-kicker">{t('pages.marks.stepSetup')}</p>
            <h2 className="pm-setup-title">{t('pages.marks.selectWhatToRecord')}</h2>
          </div>
          {classBulletinConfig && (
            <span className="pm-layout-chip">{classBulletinConfig.label}</span>
          )}
        </div>

        <div className="pm-setup-grid">
          <div>
            <label className="label flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-gray-400" /> {t('ui.class')}
            </label>
            <select
              className="input"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={classes.length === 0}
            >
              {classes.length === 0 ? (
                <option value="">{t('pages.marks.noClasses')}</option>
              ) : (
                classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>
          </div>

          <div className="pm-setup-subject">
            <label className="label flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-gray-400" /> {t('pages.marks.subSubject')}
            </label>
            <select
              className="input"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={coursesLoading || courses.length === 0}
            >
              {coursesLoading ? (
                <option value="">{t('pages.marks.loadingCourses')}</option>
              ) : courses.length === 0 ? (
                <option value="">
                  {isTeacher
                    ? t('pages.marks.noCoursesTeacher')
                    : t('pages.marks.noCoursesAdmin')}
                </option>
              ) : (
                courseGroups.map((group) => (
                  <optgroup key={group.category} label={group.category}>
                    {group.courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
            {!coursesLoading && courses.length > 0 && (
              <p className="field-hint">{t('pages.marks.subSubjectsForClass', {
                count: courses.length,
                plural: courses.length !== 1 ? 's' : '',
                className: selectedClass?.name || t('ui.thisCampus'),
              })}</p>
            )}
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" /> {t('pages.marks.trimestre')}
            </label>
            <div className="pm-term-segment" role="group" aria-label={t('pages.marks.trimestre')}>
              {terms.map((termOption) => (
                <button
                  key={termOption}
                  type="button"
                  className={`pm-term-btn ${term === termOption ? 'is-active' : ''}`}
                  onClick={() => setTerm(termOption)}
                >
                  {termOption.replace('Trimestre ', 'T')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">{t('pages.marks.assessmentDate')}</label>
            <input
              type="date"
              className="input"
              value={assessedOn}
              onChange={(e) => setAssessedOn(e.target.value)}
            />
            <p className="field-hint">{t('pages.marks.assessmentDateHint')}</p>
          </div>

          {!isBulletinCourse && (
            <>
              <div>
                <label className="label">{t('pages.marks.assessment')}</label>
                <select className="input" value={assessment} onChange={(e) => setAssessment(e.target.value)}>
                  {assessmentTypes.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              {assessment === 'CAT' ? (
                <div>
                  <label className="label">{t('pages.marks.catNumber')}</label>
                  <div className="flex gap-2">
                    <select className="input flex-1" value={catNumber} onChange={(e) => setCatNumber(Number(e.target.value))}>
                      {catOptions.length === 0 ? (
                        <option value={catNumber}>CAT {catNumber} (new)</option>
                      ) : (
                        catOptions.map((c) => (
                          <option key={c.catNumber} value={c.catNumber}>{c.label}</option>
                        ))
                      )}
                      {!catOptions.some((c) => c.catNumber === nextCatNumber) && (
                        <option value={nextCatNumber}>CAT {nextCatNumber} (new)</option>
                      )}
                    </select>
                    <button type="button" onClick={handleAddCat} className="btn-secondary px-3 shrink-0" title={`Create CAT ${nextCatNumber}`}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="label">{t('pages.marks.maxScore')}</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={maxScore}
                    onChange={(e) => setMaxScore(Number(e.target.value) || 100)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Tests setup — collapsible */}
      {isBulletinCourse && selectedCourse && (
        <section className="pm-tests-wrap card">
          <button
            type="button"
            className="pm-tests-toggle"
            onClick={() => setShowTestsSetup((v) => !v)}
            aria-expanded={showTestsSetup}
          >
            <span className="pm-tests-toggle-left">
              <Settings2 className="w-4 h-4" />
              <span>
                <strong>{t('pages.marks.testsSetup')}</strong>
                <span className="pm-tests-toggle-meta">
                  {testsDraft.length} test{testsDraft.length !== 1 ? 's' : ''}
                  {testsMarkMax !== '' ? ` · TEST/${testsMarkMax}` : ''}
                  {examMax !== '' ? ` · EX/${examMax}` : ''}
                </span>
              </span>
            </span>
            {showTestsSetup ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showTestsSetup && (
            <div className="pm-tests-body">
              <SubjectTestManager
                tests={testsDraft}
                testsMarkMax={testsMarkMax}
                examMax={examMax}
                totalMax={totalMax}
                onChange={(nextTests, nextTestsMarkMax, nextExamMax) => {
                  setTestsDraft(nextTests);
                  setTestsMarkMax(nextTestsMarkMax);
                  setExamMax(nextExamMax);
                }}
                onSave={handleSaveTests}
                saving={testsSaving}
                canEdit
                embedded
              />
            </div>
          )}
        </section>
      )}

      {/* Step 2 — Assessment + entry */}
      {isBulletinCourse && selectedCourse && !testsLoading && (
        <section className="pm-session card">
          <div className="pm-session-head">
            <div>
              <p className="pm-kicker">{t('pages.marks.stepRecord')}</p>
              <h2 className="pm-session-title">
                {currentAssessmentLabel}
                <ArrowRight className="pm-session-arrow" aria-hidden />
                <span className="pm-session-subject">{selectedCourse.name}</span>
              </h2>
              <p className="pm-session-meta">
                {selectedClass?.name} · {formatGradingScale(selectedCourse)} · {term}
              </p>
            </div>
            <div className="pm-session-stats">
              <div className="pm-stat">
                <span className="pm-stat-value">{maxScore}</span>
                <span className="pm-stat-label">{t('pages.marks.maxScore')}</span>
              </div>
              <div className="pm-stat">
                <span className="pm-stat-value">{filledCount}/{students.length}</span>
                <span className="pm-stat-label">{t('pages.marks.enteredShort')}</span>
              </div>
            </div>
          </div>

          <div className="pm-progress">
            <div className="pm-progress-meta">
              <span>{t('pages.marks.classProgress')}</span>
              <strong>{progressPct}%</strong>
            </div>
            <div className="pm-progress-track">
              <div className="pm-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <BulletinSteps
            assessments={bulletinAssessments}
            savedAssessments={savedAssessments}
            current={assessment}
            onSelect={setAssessment}
            course={courseWithTests}
          />
        </section>
      )}

      {selectedCourse && !isBulletinCourse && (
        <div className="pm-legacy-bar">
          <span className="text-sm text-gray-500">{t('pages.marks.recording')}</span>
          <span className="pm-layout-chip">{term}</span>
          <span className="pm-layout-chip">{assessment === 'CAT' ? `CAT ${catNumber}` : assessment}</span>
          <span className="pm-layout-chip">Max {maxScore}</span>
        </div>
      )}

      <div className="pm-help card">
        <button
          type="button"
          className="pm-help-summary"
          onClick={() => setShowGuide((v) => !v)}
          aria-expanded={showGuide}
        >
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            {t('pages.marks.howToRecord')}
          </span>
          {showGuide ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showGuide && (
          <div className="pm-help-body">
            <p>{t('pages.marks.autoSaveHint')}</p>
            {isBulletinCourse && <p>{t('pages.marks.bulletinRecordHint')}</p>}
            <p>{t('pages.marks.keyboardHint')}</p>
            <p>{t('pages.marks.excelHint')}</p>
            {isTeacher && (
              <p className="pm-help-teacher">{t('pages.marks.teachersOnlyHint')}</p>
            )}
          </div>
        )}
      </div>

      {message && (
        <div className={`pm-message ${message.toLowerCase().includes('saved') || message.includes('Next:') || message.includes('setup') ? 'is-ok' : 'is-error'}`}>
          {message}
        </div>
      )}

      {isTeacher && !coursesLoading && classId && courses.length === 0 && (
        <div className="card mb-6 empty-state">
          <div className="empty-state-icon"><BookOpen className="w-6 h-6" /></div>
          <p className="text-gray-600 font-medium">{t('pages.marks.emptyNoCoursesTitle', { className: selectedClass?.name || t('ui.thisCampus') })}</p>
          <p className="text-sm text-gray-400 mt-1">{t('pages.marks.emptyNoCoursesBody')}</p>
        </div>
      )}

      {/* Score grid */}
      <section className="pm-grid card">
        <div className="pm-grid-toolbar">
          <div className="pm-grid-title-wrap">
            <h3 className="pm-grid-title">
              {students.length === 0
                ? t('pages.marks.selectClassAndSubject')
                : t('pages.marks.enterScores', { assessment: currentAssessmentLabel, max: maxScore })}
            </h3>
            {students.length > 0 && (
              <p className="pm-grid-hint">{t('pages.marks.enterScoresHint')}</p>
            )}
          </div>
          {students.length > 0 && (
            <div className="pm-search">
              <Search className="w-4 h-4" aria-hidden />
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder={t('ui.searchStudent')}
                aria-label={t('ui.searchStudent')}
              />
            </div>
          )}
          {autoSaveLabel && students.length > 0 && (
            <span className={`autosave-status autosave-status-${autoSaveStatus}`}>
              <AutoSaveIcon className={`w-3.5 h-3.5 ${autoSaveStatus === 'saving' ? 'animate-spin' : ''}`} />
              {autoSaveLabel}
            </span>
          )}
        </div>

        {students.length === 0 ? (
          <div className="pm-empty">
            <Users className="w-8 h-8 text-gray-300" />
            <p>{!subjectId ? t('pages.marks.selectClassAndSubject') : t('pages.marks.noStudentsInClass')}</p>
          </div>
        ) : visibleStudents.length === 0 ? (
          <div className="pm-empty">
            <Search className="w-8 h-8 text-gray-300" />
            <p>{t('ui.noSearchResults')}</p>
          </div>
        ) : (
          <div className="pm-grid-scroll">
            <table className="pm-table">
              <thead>
                <tr>
                  <th className="pm-col-idx">#</th>
                  <SortableTh label={t('pages.marks.studentId')} columnKey="studentId" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pm-col-id" />
                  <SortableTh label={t('ui.name')} columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pm-col-name" />
                  <SortableTh label={`${currentAssessmentLabel} / ${maxScore}`} columnKey="score" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pm-col-score text-center" align="center" />
                  <SortableTh label="%" columnKey="pct" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pm-col-pct text-center" align="center" />
                  <th className="pm-col-notes">{t('ui.notes')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((s, idx) => {
                  const score = records[s.id]?.score;
                  const hasScore = score !== '' && score !== undefined && score != null && !Number.isNaN(Number(score));
                  const pct = hasScore ? Math.round((Number(score) / maxScore) * 100) : null;
                  const overMax = hasScore && Number(score) > Number(maxScore);
                  return (
                    <tr
                      key={s.id}
                      className={`${hasScore ? 'is-filled' : 'is-empty'} ${overMax ? 'is-over' : ''}`}
                    >
                      <td className="pm-col-idx text-gray-400 tabular-nums">{idx + 1}</td>
                      <td className="pm-col-id font-mono text-xs text-gray-500">{s.studentId}</td>
                      <td className="pm-col-name font-medium text-gray-900">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="pm-col-score text-center">
                        <input
                          className={`pm-score-input ${hasScore ? 'has-value' : ''} ${overMax ? 'is-invalid' : ''}`}
                          type="number"
                          min="0"
                          max={maxScore}
                          step="0.5"
                          data-mark-score={idx}
                          value={records[s.id]?.score ?? ''}
                          onChange={(e) => setScore(s.id, e.target.value)}
                          onKeyDown={(e) => onScoreKeyDown(e, idx)}
                          placeholder="—"
                          aria-label={`${s.firstName} ${s.lastName} score`}
                        />
                      </td>
                      <td className="pm-col-pct text-center">
                        <ScoreBadge percent={pct} />
                      </td>
                      <td className="pm-col-notes">
                        <input
                          className="pm-notes-input"
                          value={records[s.id]?.notes ?? ''}
                          onChange={(e) => setNotes(s.id, e.target.value)}
                          placeholder={t('pages.marks.optionalNote')}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {students.length > 0 && (
        <div className="pm-dock">
          <div className="pm-dock-progress">
            <div className="pm-progress-track">
              <div className="pm-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="pm-dock-count">
              {t('pages.marks.enteredCount', { filled: filledCount, total: students.length })}
            </span>
          </div>
          <div className="pm-dock-actions">
            {autoSaveLabel && (
              <span className={`autosave-status autosave-status-${autoSaveStatus}`}>
                <AutoSaveIcon className={`w-3.5 h-3.5 ${autoSaveStatus === 'saving' ? 'animate-spin' : ''}`} />
                {autoSaveLabel}
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasSavableMarks(records)}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? t('ui.saving') : t('ui.save')}
            </button>
          </div>
        </div>
      )}

      <MarksExcelImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onApply={handleImportMarks}
        context={{
          className: selectedClass?.name,
          subjectName: selectedCourse?.name,
          subjectId,
          term,
          assessmentLabel: currentAssessmentLabel,
          assessmentKey: assessment,
          maxScore,
          assessedOn,
          students,
          records,
        }}
      />
    </div>
  );
}
