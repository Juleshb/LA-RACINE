import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Plus, Save, ChevronDown, ChevronUp, Info, FileText, Users, BookOpen, Calendar, Award,
  CheckCircle2, Loader2, Cloud,
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
import ScoreBadge from '../components/bulletin/ScoreBadge';
import { formatGradingScale, groupCoursesByCategory } from '../lib/curriculum';
import { isNurseryGrade } from '../lib/grades';
import {
  getMaxForAssessment,
  courseUsesBulletinScale,
  getAssessmentsForCourse,
  parseAssessmentStepId,
  DEFAULT_TERMS,
} from '../lib/bulletin';

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

  const selectedCourse = courses.find((c) => c.id === subjectId);
  const selectedClass = classes.find((c) => c.id === classId);
  const courseWithTests = selectedCourse
    ? {
      ...selectedCourse,
      assessments: subjectTests,
      testsMarkMax: testsMarkMax || selectedCourse.testsMarkMax,
      examMax: examMax || selectedCourse.examMax,
      totalMax: totalMax || selectedCourse.totalMax,
    }
    : null;
  const isBulletinCourse = courseUsesBulletinScale(courseWithTests);
  const bulletinAssessments = getAssessmentsForCourse(courseWithTests, classBulletinConfig);
  const usesFlexibleTests = subjectTests.length > 0;
  const activeAssessment = parseAssessmentStepId(assessment);
  const assessmentTypes = isBulletinCourse
    ? bulletinAssessments.map((a) => a.key)
    : LEGACY_ASSESSMENTS;
  const terms = isBulletinCourse
    ? (classBulletinConfig?.terms || DEFAULT_TERMS)
    : [...DEFAULT_TERMS, ...LEGACY_TERMS];
  const courseGroups = useMemo(() => groupCoursesByCategory(courses), [courses]);
  const subjectInClass = Boolean(subjectId && courses.some((c) => c.id === subjectId));

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
      if (usesFlexibleTests) {
        const saved = bulletinAssessments
          .filter((a) => {
            if (a.assessment === 'EX') {
              return (data.others || []).some((o) => o.assessment === 'EX');
            }
            return (data.others || []).some((o) => o.assessment === 'TEST' && o.catNumber === a.catNumber);
          })
          .map((a) => a.key);
        setSavedAssessments(saved);
      } else {
        const keys = bulletinAssessments.map((a) => a.key);
        const bulletinSaved = keys.filter((a) =>
          (data.others || []).some((o) => o.assessment === a),
        );
        setSavedAssessments(bulletinSaved);
      }

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
  }, [subjectId, term, assessment, bulletinAssessments, subjectInClass, usesFlexibleTests]);

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
    if (isBulletinCourse && !assessmentTypes.includes(assessment)) {
      setAssessment(assessmentTypes[0]?.key || assessmentTypes[0] || 'TEST:1');
    }
    if (!isBulletinCourse && !LEGACY_ASSESSMENTS.includes(assessment)) {
      setAssessment('CAT');
    }
  }, [subjectId, courseWithTests, isBulletinCourse, assessmentTypes, assessment]);

  useEffect(() => {
    if (!courseWithTests) return;
    const def = bulletinAssessments.find((a) => a.key === assessment);
    if (def) setMaxScore(getMaxForAssessment(courseWithTests, def));
  }, [assessment, courseWithTests, bulletinAssessments]);

  const refreshSavedAssessments = useCallback(async () => {
    if (!subjectId) return;
    const data = await api.getMarkAssessments(subjectId, term);
    if (usesFlexibleTests) {
      const saved = bulletinAssessments
        .filter((a) => {
          if (a.assessment === 'EX') {
            return (data.others || []).some((o) => o.assessment === 'EX');
          }
          return (data.others || []).some((o) => o.assessment === 'TEST' && o.catNumber === a.catNumber);
        })
        .map((a) => a.key);
      setSavedAssessments(saved);
      return saved;
    }

    const keys = bulletinAssessments.map((a) => a.key);
    const bulletinSaved = keys.filter((a) =>
      (data.others || []).some((o) => o.assessment === a),
    );
    setSavedAssessments(bulletinSaved);

    if (assessment === 'CAT') {
      setCatOptions(data.cats || []);
      setNextCatNumber(data.nextCatNumber || 1);
    }
    return bulletinSaved;
  }, [subjectId, term, assessment, bulletinAssessments, usesFlexibleTests]);

  const performSave = useCallback(async ({ auto = false } = {}) => {
    if (!subjectId || students.length === 0 || savingRef.current) return false;
    if (!hasSavableMarks(records)) return false;

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
        records: students.map((s) => ({
          studentId: s.id,
          score: records[s.id]?.score,
          maxScore,
          notes: records[s.id]?.notes || null,
        })),
      };
      const result = await api.saveMarks(payload);
      lastSavedRef.current = serializeRecords(records);

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
    students,
    records,
    term,
    assessment,
    activeAssessment.assessment,
    activeAssessment.catNumber,
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

  const filledCount = students.filter((s) => records[s.id]?.score !== '' && records[s.id]?.score != null).length;
  const currentAssessmentLabel = bulletinAssessments.find((a) => a.key === assessment)?.label || assessment;

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

  if (user?.role === 'PARENT') {
    return <Navigate to={`/campus/${campusId}/bulletin-report`} replace />;
  }

  if (isNurseryGrade(selectedClass?.grade)) {
    return (
      <NurseryCompetenceMarks
        campusId={campusId}
        classes={classes}
        classId={classId}
        onClassChange={setClassId}
        t={t}
        isTeacher={isTeacher}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={isTeacher ? t('pages.marks.titleTeacher') : t('pages.marks.title')}
        description={isTeacher
          ? t('pages.marks.descriptionTeacher')
          : t('pages.marks.description')}
        action={(
          <div className="flex gap-2 flex-wrap items-center">
            {autoSaveLabel && students.length > 0 && (
              <span className={`autosave-status autosave-status-${autoSaveStatus}`}>
                <AutoSaveIcon className={`w-3.5 h-3.5 ${autoSaveStatus === 'saving' ? 'animate-spin' : ''}`} />
                {autoSaveLabel}
              </span>
            )}
            {!isTeacher && (
              <Link to={`/campus/${campusId}/bulletin-report`} className="btn-secondary flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t('pages.bulletin.title')}
              </Link>
            )}
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

      {classBulletinConfig && (
        <div className="bulletin-context-bar">
          <span className="bulletin-context-chip">
            <BookOpen className="w-4 h-4" />
            {selectedClass?.name || 'Class'}
          </span>
          <span className="bulletin-context-chip">
            <Award className="w-4 h-4" />
            {classBulletinConfig.label}
          </span>
          <span className="text-sm text-gray-400 hidden sm:inline">→</span>
          {classBulletinConfig.assessments.map((a) => (
            <span key={a.key} className="layout-flow-chip layout-flow-chip-lg">{a.label || a.key}</span>
          ))}
        </div>
      )}

      <div className="filter-panel">
        <p className="filter-panel-title">{t('pages.marks.selectWhatToRecord')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-gray-400" /> {t('ui.class')}
            </label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={classes.length === 0}>
              {classes.length === 0 ? (
                <option value="">{t('pages.marks.noClasses')}</option>
              ) : (
                classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="label flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-gray-400" /> {t('pages.marks.subSubject')}
            </label>
            <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={coursesLoading || courses.length === 0}>
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
            <select className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
              {terms.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
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
      </div>

      {isBulletinCourse && selectedCourse && (
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
        />
      )}

      {isBulletinCourse && selectedCourse && !testsLoading && (
        <div className="marks-context-card">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-1">{t('pages.marks.nowRecording')}</p>
              <h2 className="text-lg font-bold text-gray-900">
                {currentAssessmentLabel}
                <span className="text-gray-400 font-normal"> · </span>
                {selectedCourse.name}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {selectedCourse.category} · {formatGradingScale(selectedCourse)} · {term}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <span className="layout-flow-chip layout-flow-chip-lg">{t('pages.marks.maxPts', { max: maxScore })}</span>
              <span className="layout-flow-chip layout-flow-chip-lg">{t('pages.marks.enteredCount', { filled: filledCount, total: students.length })}</span>
              {autoSaveLabel && (
                <span className={`autosave-status autosave-status-${autoSaveStatus} text-xs`}>
                  <AutoSaveIcon className={`w-3 h-3 ${autoSaveStatus === 'saving' ? 'animate-spin' : ''}`} />
                  {autoSaveLabel}
                </span>
              )}
            </div>
          </div>
          <BulletinSteps
            assessments={bulletinAssessments}
            savedAssessments={savedAssessments}
            current={assessment}
            onSelect={setAssessment}
            course={courseWithTests}
          />
        </div>
      )}

      {selectedCourse && !isBulletinCourse && (
        <div className="bulletin-context-bar mb-6">
          <span className="text-sm text-gray-500">{t('pages.marks.recording')}</span>
          <span className="bulletin-context-chip">{term}</span>
          <span className="bulletin-context-chip">{assessment === 'CAT' ? `CAT ${catNumber}` : assessment}</span>
          <span className="bulletin-context-chip">Max {maxScore}</span>
        </div>
      )}

      <div className="card mb-6 border-brand-100">
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2 text-brand-700 font-semibold text-sm">
            <Info className="w-4 h-4" />
            {t('pages.marks.howToRecord')}
          </div>
          {showGuide ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showGuide && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600 space-y-3">
            <p>{t('pages.marks.autoSaveHint')}</p>
            {isBulletinCourse && (
              <p>{t('pages.marks.bulletinRecordHint')}</p>
            )}
            {isTeacher && (
              <p className="text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-xs">
                {t('pages.marks.teachersOnlyHint')}
              </p>
            )}
          </div>
        )}
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm border ${message.toLowerCase().includes('saved') || message.includes('Next:') ? 'bg-brand-50 text-brand-700 border-brand-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
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

      <div className="card p-0 overflow-hidden">
        {students.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon"><Users className="w-6 h-6" /></div>
            <p className="text-gray-600 font-medium">
              {!subjectId ? t('pages.marks.selectClassAndSubject') : t('pages.marks.noStudentsInClass')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th>{t('pages.marks.studentId')}</th>
                  <th>{t('ui.name')}</th>
                  <th className="text-center">{currentAssessmentLabel} / {maxScore}</th>
                  <th className="text-center">%</th>
                  <th>{t('ui.notes')}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => {
                  const score = records[s.id]?.score;
                  const pct = score !== '' && score !== undefined && !Number.isNaN(Number(score))
                    ? Math.round((Number(score) / maxScore) * 100)
                    : null;
                  return (
                    <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                      <td className="text-gray-500 font-mono text-xs">{s.studentId}</td>
                      <td className="font-medium text-gray-900">{s.firstName} {s.lastName}</td>
                      <td className="text-center">
                        <input
                          className="marks-table-input mx-auto"
                          type="number"
                          min="0"
                          max={maxScore}
                          step="0.5"
                          value={records[s.id]?.score ?? ''}
                          onChange={(e) => setScore(s.id, e.target.value)}
                          placeholder="—"
                        />
                      </td>
                      <td className="text-center">
                        <ScoreBadge percent={pct} />
                      </td>
                      <td>
                        <input
                          className="input input-sm"
                          value={records[s.id]?.notes ?? ''}
                          onChange={(e) => setNotes(s.id, e.target.value)}
                          placeholder="Optional note"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
