import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Save, Info, FileText, BookOpen,
  CheckCircle2, Loader2, Cloud, FileSpreadsheet, Download,
  Filter, PencilLine, Pencil, Eye, Play, BarChart3,
} from 'lucide-react';
import { Navigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import ListSearch, { matchesSearch } from '../components/ListSearch';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { useTranslation } from '../context/LanguageContext';
import CreateAssessmentModal from '../components/marks/CreateAssessmentModal';
import ViewRecordedMarksModal from '../components/marks/ViewRecordedMarksModal';
import NurseryCompetenceMarks from '../components/marks/NurseryCompetenceMarks';
import MarksExcelImportModal from '../components/marks/MarksExcelImportModal';
import { downloadMarksImportTemplate } from '../lib/marksExcelImport';
import ScoreBadge from '../components/bulletin/ScoreBadge';
import { groupCoursesByCategory } from '../lib/curriculum';
import { usesCompetenceBulletin } from '../lib/grades';
import {
  courseUsesBulletinScale,
  getAssessmentsForCourse,
  parseAssessmentStepId,
  DEFAULT_TERMS,
} from '../lib/bulletin';
import { SortableTh, useTableSort } from '../hooks/useTableSort';
import { studentFullName } from '../lib/studentName';

function sessionAssessmentKey(session) {
  if (!session) return '';
  if (session.assessment === 'TEST' && session.catNumber > 0) return `TEST:${session.catNumber}`;
  return session.assessment;
}

const LEGACY_TERMS = ['Term 1', 'Term 2', 'Term 3'];
const LEGACY_ASSESSMENTS = ['CAT', 'Mid-term', 'Final'];
const NURSERY_TERMS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3', 'Annuel'];
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
  const [maxScore, setMaxScore] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [recordingOpen, setRecordingOpen] = useState(false);
  const [missingOnly, setMissingOnly] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [courseQuery, setCourseQuery] = useState('');
  const [listFilterClassId, setListFilterClassId] = useState('');
  const [listFilterTerm, setListFilterTerm] = useState('');
  const [listSortBy, setListSortBy] = useState('recent');
  const [competenceOpen, setCompetenceOpen] = useState(false);
  const [competenceSession, setCompetenceSession] = useState(null);
  const [recordedLoading, setRecordedLoading] = useState(false);
  const [recordedSummary, setRecordedSummary] = useState(null);
  const [recordedSessions, setRecordedSessions] = useState([]);
  const [classStudentCount, setClassStudentCount] = useState(0);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewSession, setViewSession] = useState(null);
  const [viewStudents, setViewStudents] = useState([]);
  const [viewRecords, setViewRecords] = useState({});
  const [viewLoading, setViewLoading] = useState(false);
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
  const [isCompactRecorder, setIsCompactRecorder] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsCompactRecorder(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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

  const periodLabel = useCallback((raw, fallbackNumber) => {
    const text = String(raw || '').trim();
    const testMatch = text.match(/^(?:TEST|Test|Period|Période)\s*(\d+)$/i);
    if (testMatch) return t('pages.marks.periodN', { count: Number(testMatch[1]) });
    if (/^TEST1$/i.test(text)) return t('pages.marks.periodN', { count: 1 });
    if (/^TEST2$/i.test(text)) return t('pages.marks.periodN', { count: 2 });
    if (fallbackNumber) return t('pages.marks.periodN', { count: fallbackNumber });
    return text;
  }, [t]);

  useEffect(() => {
    api.getMarksClasses()
      .then((data) => setClasses(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!classId) {
      setClassBulletinConfig(null);
      setCourses([]);
      return undefined;
    }
    api.getClassBulletinConfig(classId)
      .then((data) => setClassBulletinConfig(data.config))
      .catch(console.error);

    let cancelled = false;
    setCoursesLoading(true);
    api.getCourses(classId, { forMarks: true })
      .then((data) => {
        if (cancelled) return;
        setCourses(data);
        setSubjectId((prev) => (prev && data.some((c) => c.id === prev) ? prev : (data[0]?.id || '')));
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

  const refreshRecorded = useCallback(async () => {
    setRecordedLoading(true);
    try {
      const data = await api.getRecordedMarks();
      setRecordedSessions(data.sessions || []);
      setRecordedSummary(data.summary || null);
      setClassStudentCount(data.studentCount || 0);
    } catch (err) {
      console.error(err);
      setRecordedSessions([]);
      setRecordedSummary(null);
      setMessage(err.message);
    } finally {
      setRecordedLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRecorded();
  }, [refreshRecorded]);

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
          setAssessment((prev) => {
            if (typeof prev === 'string' && (prev.startsWith('TEST:') || prev === 'TEST1' || prev === 'TEST2' || prev === 'EX')) {
              return prev;
            }
            const first = data.tests[0].sortOrder;
            setCatNumber(first);
            return `TEST:${first}`;
          });
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
      const next = assessmentTypes[0];
      setAssessment(next);
      const parsed = parseAssessmentStepId(next);
      if (parsed.catNumber > 0) setCatNumber(parsed.catNumber);
    }
    if (!isBulletinCourse && !LEGACY_ASSESSMENTS.includes(assessment)) {
      setAssessment('CAT');
      setCatNumber(nextCatNumber || 1);
    }
  }, [subjectId, isBulletinCourse, bulletinAssessmentKey, assessment, assessmentTypes, nextCatNumber, courseWithTests]);

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
          maxScore: Number(maxScore),
          notes: currentRecords[s.id]?.notes || null,
        })),
        assessedOn,
      };
      const result = await api.saveMarks(payload);
      lastSavedRef.current = serializeRecords(currentRecords);

      const bulletinSaved = await refreshSavedAssessments();
      refreshRecorded();

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
    refreshRecorded,
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
    // Typing only — strip non-numeric (comma → decimal point)
    let next = String(value ?? '').replace(',', '.');
    next = next.replace(/[^\d.]/g, '');
    const parts = next.split('.');
    if (parts.length > 2) next = `${parts[0]}.${parts.slice(1).join('')}`;
    setRecords((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], score: next },
    }));
  };

  const setNotes = (studentId, value) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], notes: value },
    }));
  };

  const handleSave = () => performSave({ auto: false });

  const filledCount = students.filter((s) => {
    const score = records[s.id]?.score;
    return score !== '' && score != null && !Number.isNaN(Number(score));
  }).length;
  const progressPct = students.length ? Math.round((filledCount / students.length) * 100) : 0;
  const currentAssessmentLabel = (() => {
    const found = bulletinAssessments.find((a) => a.key === assessment);
    if (assessment === 'EX' || found?.label === 'EX' || found?.label === 'Exam') {
      return t('pages.marks.typeExam');
    }
    if (assessment === 'CAT') return t('pages.marks.periodN', { count: catNumber || 1 });
    if (typeof assessment === 'string' && assessment.startsWith('TEST:')) {
      return t('pages.marks.periodN', { count: activeAssessment.catNumber || catNumber || 1 });
    }
    if (assessment === 'TEST1' || assessment === 'TEST2') {
      return t('pages.marks.periodN', { count: catNumber || activeAssessment.catNumber || (assessment === 'TEST2' ? 2 : 1) });
    }
    if (found) return periodLabel(found.label || found.key, found.catNumber || found.sortOrder || catNumber);
    return periodLabel(assessment, catNumber);
  })();

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

  const studentHasScore = useCallback((studentId) => {
    const score = records[studentId]?.score;
    return score !== '' && score != null && !Number.isNaN(Number(score));
  }, [records]);

  const visibleStudents = useMemo(() => {
    let list = students;
    if (missingOnly) {
      list = list.filter((s) => !studentHasScore(s.id));
    }
    const q = studentSearch.trim();
    if (!q) return list;
    return list.filter((s) => matchesSearch(q, studentFullName(s), s.studentId || ''));
  }, [students, studentSearch, missingOnly, studentHasScore]);

  const getMarksSortValue = useCallback((row, key) => {
    switch (key) {
      case 'studentId': return row.studentId || '';
      case 'name': return studentFullName(row);
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

  const focusScoreInput = (studentId) => {
    const el = document.querySelector(`[data-mark-student="${studentId}"]`);
    if (el) {
      el.focus();
      el.select?.();
    }
  };

  const preventScoreScroll = (e) => {
    // Number inputs change value on mouse-wheel — scores must be typed only
    e.preventDefault();
  };

  const onScoreKeyDown = (e, studentId) => {
    const order = sortedStudents.map((s) => s.id);
    const index = order.indexOf(studentId);
    if (index < 0) return;
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (order[index + 1]) focusScoreInput(order[index + 1]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (order[index - 1]) focusScoreInput(order[index - 1]);
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

  const missingCount = students.filter((s) => !studentHasScore(s.id)).length;

  const listFilterClasses = useMemo(() => {
    const byId = new Map();
    for (const cls of classes) {
      byId.set(cls.id, { id: cls.id, name: cls.name, grade: cls.grade });
    }
    for (const session of recordedSessions) {
      if (session.classId && !byId.has(session.classId)) {
        byId.set(session.classId, {
          id: session.classId,
          name: session.className || session.classId,
          grade: '',
        });
      }
    }
    return [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [classes, recordedSessions]);

  const listFilterTerms = useMemo(() => {
    const terms = new Set([
      ...DEFAULT_TERMS,
      ...NURSERY_TERMS,
      ...LEGACY_TERMS,
      ...recordedSessions.map((s) => s.term).filter(Boolean),
    ]);
    const preferred = [...DEFAULT_TERMS, ...NURSERY_TERMS, ...LEGACY_TERMS];
    return [...terms].sort((a, b) => {
      const ai = preferred.indexOf(a);
      const bi = preferred.indexOf(b);
      if (ai === -1 && bi === -1) return String(a).localeCompare(String(b));
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [recordedSessions]);

  const filteredSessions = useMemo(() => {
    const q = courseQuery.trim();
    const filtered = recordedSessions.filter((session) => {
      if (listFilterClassId && session.classId !== listFilterClassId) return false;
      if (listFilterTerm && session.term !== listFilterTerm) return false;
      if (!q) return true;
      return matchesSearch(
        q,
        session.className,
        session.subjectName,
        session.subjectCode,
        session.label,
        session.term,
        session.category,
      );
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (listSortBy === 'class') {
        const byClass = String(a.className || '').localeCompare(String(b.className || ''));
        if (byClass) return byClass;
        const byTerm = String(a.term || '').localeCompare(String(b.term || ''));
        if (byTerm) return byTerm;
        return String(a.subjectName || '').localeCompare(String(b.subjectName || ''));
      }
      if (listSortBy === 'term') {
        const byTerm = String(a.term || '').localeCompare(String(b.term || ''));
        if (byTerm) return byTerm;
        const byClass = String(a.className || '').localeCompare(String(b.className || ''));
        if (byClass) return byClass;
        return String(a.subjectName || '').localeCompare(String(b.subjectName || ''));
      }
      if (listSortBy === 'subject') {
        const bySubject = String(a.subjectName || '').localeCompare(String(b.subjectName || ''));
        if (bySubject) return bySubject;
        return String(a.className || '').localeCompare(String(b.className || ''));
      }
      const byUpdated = String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      if (byUpdated) return byUpdated;
      return String(a.className || '').localeCompare(String(b.className || ''));
    });
    return sorted;
  }, [recordedSessions, courseQuery, listFilterClassId, listFilterTerm, listSortBy]);

  const createClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classes, classId],
  );
  // Only when this class has assigned competence subjects (never unassigned nursery items)
  const createCompetenceMode = Boolean(createClass?.competenceAccess);
  const createTerms = useMemo(() => {
    if (createCompetenceMode) return NURSERY_TERMS;
    return classBulletinConfig?.terms || DEFAULT_TERMS;
  }, [createCompetenceMode, classBulletinConfig]);

  const assessmentOptions = useMemo(() => {
    if (isBulletinCourse && bulletinAssessments.length > 0) {
      return bulletinAssessments.map((a) => ({
        value: a.key,
        label: a.key === 'EX' || a.label === 'EX' || a.label === 'Exam'
          ? t('pages.marks.typeExam')
          : periodLabel(a.label || a.key, a.catNumber || a.sortOrder),
      }));
    }
    if (isBulletinCourse) {
      return [
        { value: 'TEST:1', label: t('pages.marks.typePeriod') },
        { value: 'EX', label: t('pages.marks.typeExam') },
      ];
    }
    return [
      { value: 'CAT', label: t('pages.marks.typePeriod') },
      { value: 'Mid-term', label: t('pages.marks.typeMidterm') },
      { value: 'Final', label: t('pages.marks.typeExam') },
    ];
  }, [isBulletinCourse, bulletinAssessments, t, periodLabel]);

  const showAssessmentNumber = Boolean(
    assessment
    && assessment !== 'EX'
    && assessment !== 'Final'
    && assessment !== 'Mid-term'
    && assessment !== 'SCORE',
  );

  const openCreate = (courseId) => {
    const starterClassId = classId || classes[0]?.id;
    if (starterClassId && starterClassId !== classId) setClassId(starterClassId);
    if (courseId) setSubjectId(courseId);
    setMaxScore('');
    setCreateError('');
    setMessage('');
    setCreateOpen(true);
  };

  const handleCreateClassChange = (nextClassId) => {
    setClassId(nextClassId);
    setSubjectId('');
    setAssessment('');
    setMaxScore('');
    const nextClass = classes.find((c) => c.id === nextClassId);
    if (nextClass && usesCompetenceBulletin(nextClass.grade)) {
      setTerm((prev) => (NURSERY_TERMS.includes(prev) ? prev : 'Trimestre 1'));
    }
  };

  const openCompetenceRecorder = (session) => {
    if (!session?.classId) {
      setMessage(t('pages.marks.competenceNeedClass'));
      return;
    }
    setCompetenceSession({
      kind: 'competence',
      classId: session.classId,
      className: session.className || '',
      term: session.term || term || 'Trimestre 1',
      label: session.label || t('pages.marks.nurseryCompetence'),
    });
    setClassId(session.classId);
    if (session.term) setTerm(session.term);
    setCreateOpen(false);
    setViewOpen(false);
    setRecordingOpen(false);
    setCompetenceOpen(true);
  };

  const closeCompetenceRecorder = () => {
    setCompetenceOpen(false);
    setCompetenceSession(null);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateError('');
  };

  const applySessionContext = (session) => {
    if (session.classId) setClassId(session.classId);
    if (session.term) setTerm(session.term);
    setSubjectId(session.subjectId);
    setAssessment(sessionAssessmentKey(session));
    setCatNumber(
      session.assessment === 'CAT' || session.assessment === 'TEST'
        ? session.catNumber
        : session.assessment === 'TEST2'
          ? 2
          : session.assessment === 'TEST1'
            ? 1
            : session.catNumber || 1,
    );
    if (session.maxScore) setMaxScore(session.maxScore);
    if (session.assessedOn) setAssessedOn(session.assessedOn);
  };

  const openViewSession = async (session) => {
    if (session.kind === 'competence') {
      openCompetenceRecorder(session);
      return;
    }
    setViewSession(session);
    setViewOpen(true);
    setViewLoading(true);
    setViewStudents([]);
    setViewRecords({});
    try {
      const data = await api.getMarks(
        session.classId,
        session.subjectId,
        session.term,
        session.assessment,
        session.catNumber,
      );
      setViewStudents(data.students || []);
      const initial = {};
      (data.students || []).forEach((s) => {
        initial[s.id] = {
          score: s.mark?.score ?? '',
          notes: s.mark?.notes ?? '',
        };
      });
      setViewRecords(initial);
      if (!session.maxScore) {
        const firstMax = (data.students || []).find((s) => s.mark?.maxScore)?.mark?.maxScore;
        if (firstMax) {
          setViewSession((prev) => (prev ? { ...prev, maxScore: firstMax } : prev));
        }
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setViewLoading(false);
    }
  };

  const closeViewSession = () => {
    setViewOpen(false);
    setViewSession(null);
    setViewStudents([]);
    setViewRecords({});
  };

  const resumeSession = (session) => {
    if (session.kind === 'competence') {
      openCompetenceRecorder(session);
      return;
    }
    if (!session.subjectId || !session.classId) {
      setMessage(t('pages.marks.resumeNeedSubject'));
      return;
    }
    applySessionContext(session);
    closeViewSession();
    closeCompetenceRecorder();
    setCreateOpen(false);
    setCreateError('');
    setMessage('');
    setMissingOnly(false);
    setStudentSearch('');
    setRecordingOpen(true);
  };

  const continueToRecord = () => {
    if (!classId) {
      setCreateError(t('pages.marks.createNeedClass'));
      return;
    }
    if (createCompetenceMode) {
      if (!term) {
        setCreateError(t('pages.marks.createNeedPeriod'));
        return;
      }
      setCreateError('');
      openCompetenceRecorder({
        kind: 'competence',
        classId,
        className: createClass?.name || '',
        term,
        label: t('pages.marks.nurseryCompetence'),
      });
      return;
    }
    if (!subjectId) {
      setCreateError(t('pages.marks.createNeedSubject'));
      return;
    }
    if (!assessment) {
      setCreateError(t('pages.marks.createNeedType'));
      return;
    }
    if (!assessedOn) {
      setCreateError(t('pages.marks.createNeedDate'));
      return;
    }
    if (!maxScore || Number(maxScore) <= 0) {
      setCreateError(t('pages.marks.createNeedMax'));
      return;
    }
    setCreateError('');
    setCreateOpen(false);
    setRecordingOpen(true);
  };

  const backToCreate = () => {
    setRecordingOpen(false);
    setCreateOpen(true);
    setShowGuide(false);
  };

  const closeRecording = () => {
    setRecordingOpen(false);
    setShowGuide(false);
  };

  const handleCreateAssessmentChange = (value) => {
    setAssessment(value);
    if (value === 'CAT') {
      setCatNumber(nextCatNumber || 1);
      return;
    }
    if (value === 'TEST1') {
      setCatNumber(1);
      return;
    }
    if (value === 'TEST2') {
      setCatNumber(2);
      return;
    }
    if (typeof value === 'string' && value.startsWith('TEST:')) {
      const n = Number(value.split(':')[1]);
      if (Number.isInteger(n) && n > 0) setCatNumber(n);
    }
  };

  const handleMaxScoreChange = (raw) => {
    const cleaned = String(raw).replace(/[^\d.]/g, '');
    if (cleaned === '' || cleaned === '.') {
      setMaxScore('');
      return;
    }
    const parts = cleaned.split('.');
    const normalized = parts.length > 2
      ? `${parts[0]}.${parts.slice(1).join('')}`
      : cleaned;
    setMaxScore(normalized);
  };

  const handleAssessmentNumberChange = (raw) => {
    const digits = String(raw).replace(/[^\d]/g, '');
    if (digits === '') {
      setCatNumber('');
      return;
    }
    const n = Math.max(1, Number(digits) || 1);
    setCatNumber(n);
    if (assessment === 'CAT') return;
    if (assessment === 'TEST1' || assessment === 'TEST2' || (typeof assessment === 'string' && assessment.startsWith('TEST:'))) {
      if (n === 1 && bulletinAssessments.some((a) => a.key === 'TEST1')) {
        setAssessment('TEST1');
      } else if (n === 2 && bulletinAssessments.some((a) => a.key === 'TEST2')) {
        setAssessment('TEST2');
      } else {
        setAssessment(`TEST:${n}`);
      }
    }
  };

  const modalContext = [
    selectedClass?.name,
    selectedCourse?.name,
    currentAssessmentLabel,
    term,
  ].filter(Boolean).join(' · ');

  if (user?.role === 'PARENT') {
    return <Navigate to={`/campus/${campusId}/bulletin-report`} replace />;
  }

  const overviewStats = [
    {
      key: 'sessions',
      value: recordedSummary?.sessions ?? 0,
      label: t('pages.marks.statSessions'),
      icon: BarChart3,
    },
    {
      key: 'entered',
      value: recordedSummary?.enteredMarks ?? 0,
      label: t('pages.marks.statEnteredMarks'),
    },
    {
      key: 'completion',
      value: `${recordedSummary?.avgCompletionPct ?? 0}%`,
      label: t('pages.marks.statAvgCompletion'),
    },
    {
      key: 'avg',
      value: recordedSummary?.avgScorePct != null ? `${recordedSummary.avgScorePct}%` : '—',
      label: t('pages.marks.statAvgScore'),
    },
    {
      key: 'incomplete',
      value: recordedSummary?.incompleteSessions ?? 0,
      label: t('pages.marks.statIncomplete'),
      tone: (recordedSummary?.incompleteSessions ?? 0) > 0 ? 'warn' : undefined,
    },
    {
      key: 'students',
      value: classStudentCount,
      label: t('pages.marks.statStudents'),
    },
  ];

  return (
    <div className="pm-page">
      <PageHeader
        title={isTeacher ? t('pages.marks.titleTeacher') : t('pages.marks.title')}
        description={isTeacher
          ? t('pages.marks.descriptionTeacherView')
          : t('pages.marks.descriptionView')}
        action={(
          <div className="pm-header-actions">
            {!isTeacher && (
              <>
                <Link
                  to={`/campus/${campusId}/midterms`}
                  className="btn-secondary pm-header-btn"
                >
                  <FileText className="w-4 h-4" />
                  <span className="pm-header-btn-label">Périodes</span>
                </Link>
                <Link
                  to={`/campus/${campusId}/bulletin-report`}
                  className="btn-secondary pm-header-btn"
                >
                  <FileText className="w-4 h-4" />
                  <span className="pm-header-btn-label">{t('pages.bulletin.title')}</span>
                </Link>
              </>
            )}
            <button
              type="button"
              className="btn-primary pm-header-btn pm-header-btn-primary disabled:opacity-50"
              disabled={classes.length === 0}
              onClick={() => openCreate()}
            >
              <PencilLine className="w-4 h-4" />
              <span>{t('pages.marks.createAssessment')}</span>
            </button>
          </div>
        )}
      />

      {message && !recordingOpen && !viewOpen && !competenceOpen && (
        <div className={`pm-message ${message.toLowerCase().includes('saved') || message.includes('Next:') || message.includes('setup') || message.includes('Imported') ? 'is-ok' : 'is-error'}`}>
          {message}
        </div>
      )}

      {isTeacher && classes.length === 0 && !recordedLoading && (
        <div className="card empty-state pm-empty-assigned">
          <div className="empty-state-icon"><BookOpen className="w-6 h-6" /></div>
          <p className="text-gray-600 font-medium">{t('pages.marks.noAssignedSubjectsTitle')}</p>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">{t('pages.marks.noAssignedSubjectsBody')}</p>
        </div>
      )}

      <section className="pm-overview-stats" aria-label={t('pages.marks.recordedTitle')}>
        {overviewStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.key} className={`pm-overview-stat card ${stat.tone ? `is-${stat.tone}` : ''}`}>
              {Icon ? <Icon className="pm-overview-stat-icon" aria-hidden /> : null}
              <div className="pm-overview-stat-copy">
                <p className="pm-overview-stat-value">{stat.value}</p>
                <p className="pm-overview-stat-label">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="card pm-sessions-wrap">
        <div className="pm-sessions-toolbar">
          <div className="pm-sessions-toolbar-copy">
            <h2 className="pm-sessions-title">{t('pages.marks.recordedTitle')}</h2>
            <p className="pm-sessions-hint">{t('pages.marks.recordedHintAll')}</p>
          </div>
          <ListSearch
            value={courseQuery}
            onChange={setCourseQuery}
            placeholder={t('pages.marks.searchRecorded')}
            className="pm-list-search pm-sessions-search"
          />
        </div>
        <div className="pm-sessions-filters">
          <label className="pm-sessions-filter">
            <span className="pm-sessions-filter-label">{t('ui.class')}</span>
            <select
              className="pm-sessions-filter-select"
              value={listFilterClassId}
              onChange={(e) => setListFilterClassId(e.target.value)}
            >
              <option value="">{t('ui.allClasses')}</option>
              {listFilterClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}{cls.grade ? ` (${cls.grade})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="pm-sessions-filter">
            <span className="pm-sessions-filter-label">{t('pages.marks.trimestre')}</span>
            <select
              className="pm-sessions-filter-select"
              value={listFilterTerm}
              onChange={(e) => setListFilterTerm(e.target.value)}
            >
              <option value="">{t('pages.reports.allTerms')}</option>
              {listFilterTerms.map((termOption) => (
                <option key={termOption} value={termOption}>{termOption}</option>
              ))}
            </select>
          </label>
          <label className="pm-sessions-filter">
            <span className="pm-sessions-filter-label">{t('pages.marks.sortBy')}</span>
            <select
              className="pm-sessions-filter-select"
              value={listSortBy}
              onChange={(e) => setListSortBy(e.target.value)}
            >
              <option value="recent">{t('pages.marks.sortRecent')}</option>
              <option value="class">{t('pages.marks.sortClass')}</option>
              <option value="term">{t('pages.marks.sortTerm')}</option>
              <option value="subject">{t('pages.marks.sortSubject')}</option>
            </select>
          </label>
          {(listFilterClassId || listFilterTerm || listSortBy !== 'recent' || courseQuery.trim()) && (
            <button
              type="button"
              className="pm-sessions-filter-reset"
              onClick={() => {
                setListFilterClassId('');
                setListFilterTerm('');
                setListSortBy('recent');
                setCourseQuery('');
              }}
            >
              {t('pages.marks.clearFilters')}
            </button>
          )}
        </div>

        {recordedLoading ? (
          <div className="pm-empty">
            <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
            <p>{t('pages.marks.loadingRecorded')}</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="pm-empty">
            <BookOpen className="w-8 h-8 text-gray-300" />
            <p>
              {recordedSessions.length === 0
                ? t('pages.marks.noRecordedYetAll')
                : t('ui.noSearchResults')}
            </p>
            {recordedSessions.length === 0 && classes.length > 0 && (
              <button
                type="button"
                className="btn-primary mt-3"
                onClick={() => openCreate()}
              >
                {t('pages.marks.createAssessment')}
              </button>
            )}
          </div>
        ) : (
          <div className="pm-sessions-list">
            {filteredSessions.map((session) => (
              <article
                key={session.id}
                className={`pm-session-card ${session.complete ? 'is-complete' : 'is-partial'}`}
              >
                <div
                  className="pm-session-ring"
                  style={{ '--pm-pct': `${session.completionPct}%` }}
                  aria-hidden
                >
                  <span>{session.completionPct}%</span>
                </div>
                <div className="pm-session-main">
                  <div className="pm-session-topline">
                    <span className="pm-short-card-code">
                      {session.kind === 'competence' ? 'COMP' : (session.subjectCode || '—')}
                    </span>
                    <span className="pm-session-class">{session.className}</span>
                    {session.kind === 'competence' && (
                      <span className="pm-session-badge is-competence">
                        {t('pages.marks.nurseryCompetence')}
                      </span>
                    )}
                    <span className={`pm-session-badge ${session.complete ? 'is-done' : 'is-open'}`}>
                      {session.complete
                        ? t('pages.marks.statusComplete')
                        : t('pages.marks.statusPartial')}
                    </span>
                  </div>
                  <h3 className="pm-session-name">
                    {session.kind === 'competence'
                      ? `${t('pages.marks.competenceSessionTitle')}${session.subjectName && session.subjectName !== 'Competence' ? ` · ${session.subjectName}` : ''}`
                      : session.subjectName}
                  </h3>
                  <p className="pm-session-label">
                    {[
                      session.kind === 'competence' ? t('pages.marks.competenceGrades') : session.label,
                      session.term,
                      session.maxScore != null ? `/${session.maxScore}` : null,
                      session.assessedOn,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div className="pm-session-progress">
                    <div className="pm-progress-track" aria-hidden>
                      <div className="pm-progress-fill" style={{ width: `${session.completionPct}%` }} />
                    </div>
                    <span className="pm-session-progress-text">
                      {t('pages.marks.enteredCount', { filled: session.entered, total: session.studentCount })}
                      {session.avgPct != null ? ` · ${t('pages.marks.avgPct', { pct: session.avgPct })}` : ''}
                    </span>
                  </div>
                </div>
                <div className="pm-session-actions" role="group" aria-label={t('pages.marks.recordedTitle')}>
                  <button
                    type="button"
                    className="pm-action-btn pm-action-view"
                    onClick={() => openViewSession(session)}
                  >
                    <span className="pm-action-btn-icon" aria-hidden>
                      <Eye className="w-4 h-4" />
                    </span>
                    <span className="pm-action-btn-copy">
                      <span className="pm-action-btn-label">{t('pages.marks.viewMarks')}</span>
                      <span className="pm-action-btn-hint">{t('pages.marks.viewMarksHint')}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`pm-action-btn pm-action-primary ${session.complete ? 'is-edit' : 'is-resume'}`}
                    onClick={() => resumeSession(session)}
                  >
                    <span className="pm-action-btn-icon" aria-hidden>
                      {session.complete
                        ? <Pencil className="w-4 h-4" />
                        : <Play className="w-4 h-4" />}
                    </span>
                    <span className="pm-action-btn-copy">
                      <span className="pm-action-btn-label">
                        {session.complete
                          ? t('pages.marks.editMarks')
                          : t('pages.marks.resumeRecording')}
                      </span>
                      <span className="pm-action-btn-hint">
                        {session.complete
                          ? t('pages.marks.editMarksHint')
                          : t('pages.marks.resumeRecordingHint')}
                      </span>
                    </span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ViewRecordedMarksModal
        open={viewOpen}
        onClose={closeViewSession}
        onResume={() => viewSession && resumeSession(viewSession)}
        t={t}
        session={viewSession}
        students={viewStudents}
        records={viewRecords}
        loading={viewLoading}
      />

      <NurseryCompetenceMarks
        open={competenceOpen && Boolean(competenceSession?.classId)}
        onClose={closeCompetenceRecorder}
        onSaved={refreshRecorded}
        classId={competenceSession?.classId || ''}
        className={competenceSession?.className || ''}
        term={competenceSession?.term || 'Trimestre 1'}
        t={t}
      />

      <CreateAssessmentModal
        open={createOpen}
        onClose={closeCreate}
        onContinue={continueToRecord}
        t={t}
        classes={classes}
        classId={classId}
        onClassChange={handleCreateClassChange}
        courses={courses}
        courseGroups={courseGroups}
        coursesLoading={coursesLoading}
        subjectId={subjectId}
        onSubjectChange={setSubjectId}
        terms={createTerms}
        term={term}
        onTermChange={setTerm}
        assessmentOptions={assessmentOptions}
        assessment={assessment}
        onAssessmentChange={handleCreateAssessmentChange}
        showNumber={showAssessmentNumber}
        assessmentNumber={catNumber}
        onAssessmentNumberChange={handleAssessmentNumberChange}
        assessedOn={assessedOn}
        onAssessedOnChange={setAssessedOn}
        maxScore={maxScore}
        onMaxScoreChange={handleMaxScoreChange}
        competenceMode={createCompetenceMode}
        canContinue={createCompetenceMode
          ? Boolean(classId && term)
          : Boolean(
            classId
            && subjectId
            && assessment
            && assessedOn
            && Number(maxScore) > 0
            && (!showAssessmentNumber || Number(catNumber) > 0),
          )}
        error={createError}
      />

      <FormModeModal
        open={recordingOpen}
        mode="edit"
        size="2xl"
        title={t('pages.marks.recorderTitle')}
        subtitle={t('pages.marks.recorderSubtitle')}
        context={modalContext || undefined}
        onClose={closeRecording}
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        formId="marks-recording-form"
        submitLabel={saving ? t('ui.saving') : t('ui.save')}
        submitting={saving}
        submitDisabled={!subjectId || students.length === 0 || !hasSavableMarks(records)}
        cancelLabel={t('ui.close')}
        error={message && !message.toLowerCase().includes('saved') && !message.includes('Next:') && !message.includes('setup') && !message.includes('Imported') ? message : ''}
        headerExtra={(
          <div className="pm-record-toolbar">
            {autoSaveLabel && (
              <span className={`autosave-status autosave-status-${autoSaveStatus}`}>
                <AutoSaveIcon className={`w-3.5 h-3.5 ${autoSaveStatus === 'saving' ? 'animate-spin' : ''}`} />
                <span className="pm-autosave-text">{autoSaveLabel}</span>
              </span>
            )}
            <button
              type="button"
              className="btn-secondary pm-record-tool-btn"
              onClick={backToCreate}
            >
              <span className="pm-record-tool-label">{t('pages.marks.editAssessment')}</span>
            </button>
            <button
              type="button"
              className="btn-secondary pm-record-tool-btn disabled:opacity-50"
              disabled={students.length === 0}
              onClick={handleDownloadMarksTemplate}
              title={t('pages.marks.downloadTemplate')}
            >
              <Download className="w-4 h-4" />
              <span className="pm-record-tool-label">{t('pages.marks.template')}</span>
            </button>
            <button
              type="button"
              className="btn-secondary pm-record-tool-btn disabled:opacity-50"
              disabled={students.length === 0}
              onClick={() => setImportOpen(true)}
              title={t('pages.marks.importExcel')}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="pm-record-tool-label">{t('pages.marks.import')}</span>
            </button>
          </div>
        )}
        footerExtra={(
          <div className="pm-record-footer-progress">
            {students.length > 0 && (
              <>
                <div className="pm-dock-progress">
                  <div className="pm-progress-track" aria-hidden>
                    <div className="pm-progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
                <span className="pm-dock-count">
                  {t('pages.marks.enteredCount', { filled: filledCount, total: students.length })}
                  {missingCount > 0 ? ` · ${t('pages.marks.missingCount', { count: missingCount })}` : ''}
                </span>
              </>
            )}
          </div>
        )}
      >
        {message && (message.toLowerCase().includes('saved') || message.includes('Next:') || message.includes('setup') || message.includes('Imported')) && (
          <div className="pm-message is-ok !mx-0">{message}</div>
        )}

        <div className="pm-record-summary">
          <div className="pm-record-summary-copy">
            <p className="pm-kicker">{t('pages.marks.nowRecording')}</p>
            <p className="pm-record-summary-title">
              {currentAssessmentLabel}
              <span className="pm-session-max">/ {maxScore}</span>
            </p>
            <p className="pm-record-summary-meta">
              {[selectedClass?.name, selectedCourse?.name, term, assessedOn].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="pm-stat pm-record-summary-stat">
            <span className="pm-stat-value">{filledCount}/{students.length || 0}</span>
            <span className="pm-stat-label">{t('pages.marks.enteredShort')}</span>
          </div>
        </div>

        <FormSection
          className="form-section-stack"
          title={t('pages.marks.cardScores')}
          description={t('pages.marks.enterScoresHint')}
        >
          <div className="pm-record-filters form-field-full">
            {students.length > 0 && (
              <>
                <ListSearch
                  value={studentSearch}
                  onChange={setStudentSearch}
                  placeholder={t('ui.searchStudent')}
                  className="pm-list-search pm-record-search"
                />
                <button
                  type="button"
                  className={`pm-filter-btn ${missingOnly ? 'is-on' : ''}`}
                  onClick={() => setMissingOnly((v) => !v)}
                  aria-pressed={missingOnly}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{t('pages.marks.missingCount', { count: missingCount })}</span>
                </button>
                <button
                  type="button"
                  className="pm-help-btn"
                  onClick={() => setShowGuide((v) => !v)}
                  aria-expanded={showGuide}
                  title={t('pages.marks.howToRecord')}
                >
                  <Info className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {showGuide && students.length > 0 && (
            <div className="pm-help-inline form-field-full rounded-xl">
              <p>{t('pages.marks.autoSaveHint')}</p>
              <p>{t('pages.marks.keyboardHint')}</p>
              <p>{t('pages.marks.excelHint')}</p>
            </div>
          )}

          {students.length === 0 ? (
            <div className="pm-empty form-field-full">
              <BookOpen className="w-8 h-8 text-gray-300" />
              <p>{!subjectId ? t('pages.marks.selectClassAndSubject') : t('pages.marks.noStudentsInClass')}</p>
            </div>
          ) : visibleStudents.length === 0 ? (
            <div className="pm-empty form-field-full">
              <Filter className="w-8 h-8 text-gray-300" />
              <p>{missingOnly ? t('pages.marks.noMissingScores') : t('ui.noSearchResults')}</p>
              {missingOnly && (
                <button type="button" className="btn-secondary mt-2" onClick={() => setMissingOnly(false)}>
                  {t('pages.marks.showAllStudents')}
                </button>
              )}
            </div>
          ) : isCompactRecorder ? (
            <div className="pm-mobile-scores form-field-full">
              {sortedStudents.map((s, idx) => {
                const score = records[s.id]?.score;
                const hasScore = studentHasScore(s.id);
                const pct = hasScore ? Math.round((Number(score) / maxScore) * 100) : null;
                const overMax = hasScore && Number(score) > Number(maxScore);
                return (
                  <article
                    key={s.id}
                    className={`pm-mobile-score-card ${hasScore ? 'is-filled' : 'is-empty'} ${overMax ? 'is-over' : ''}`}
                  >
                    <div className="pm-mobile-score-head">
                      <span className="pm-mobile-score-idx">{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="pm-mobile-score-name">{studentFullName(s)}</p>
                        <p className="pm-mobile-score-id">{s.studentId}</p>
                      </div>
                      <ScoreBadge percent={pct} />
                    </div>
                    <div className="pm-mobile-score-fields">
                      <label className="pm-mobile-score-field">
                        <span>{currentAssessmentLabel} / {maxScore}</span>
                        <input
                          className={`pm-score-input ${hasScore ? 'has-value' : ''} ${overMax ? 'is-invalid' : ''}`}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          data-mark-student={s.id}
                          value={records[s.id]?.score ?? ''}
                          onChange={(e) => setScore(s.id, e.target.value)}
                          onKeyDown={(e) => onScoreKeyDown(e, s.id)}
                          onWheel={preventScoreScroll}
                          placeholder="—"
                          aria-label={`${studentFullName(s)} score`}
                        />
                      </label>
                      <label className="pm-mobile-score-field pm-mobile-score-notes">
                        <span>{t('ui.notes')}</span>
                        <input
                          className="pm-notes-input"
                          value={records[s.id]?.notes ?? ''}
                          onChange={(e) => setNotes(s.id, e.target.value)}
                          placeholder={t('pages.marks.optionalNote')}
                        />
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="pm-grid-scroll form-field-full rounded-xl border border-gray-100">
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
                    const hasScore = studentHasScore(s.id);
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
                          {studentFullName(s)}
                        </td>
                        <td className="pm-col-score text-center">
                          <input
                            className={`pm-score-input ${hasScore ? 'has-value' : ''} ${overMax ? 'is-invalid' : ''}`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            data-mark-student={s.id}
                            value={records[s.id]?.score ?? ''}
                            onChange={(e) => setScore(s.id, e.target.value)}
                            onKeyDown={(e) => onScoreKeyDown(e, s.id)}
                            onWheel={preventScoreScroll}
                            placeholder="—"
                            aria-label={`${studentFullName(s)} score`}
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
        </FormSection>
      </FormModeModal>

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
