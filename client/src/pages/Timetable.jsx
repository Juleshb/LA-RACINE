import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Printer, CalendarDays, Settings2, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import TimetableGrid, { TimetableSummaryBar } from '../components/timetable/TimetableGrid';
import TimetablePeriodEditor from '../components/timetable/TimetablePeriodEditor';
import ParentChildFilter from '../components/parent/ParentChildFilter';
import { useTranslation } from '../context/LanguageContext';
import {
  SCHOOL_DAYS,
  FALLBACK_PERIOD_DEFINITIONS,
  resolvePeriods,
  buildTimetableGrid,
  countWeeklyPeriods,
  weeklyHours,
  countTeachingPeriods,
  countBreaks,
  templateScopeLabel,
  detectTeacherConflicts,
} from '../lib/timetable';

const EMPTY_FORM = {
  classId: '', subjectId: '', dayOfWeek: 0, startTime: '08:00', endTime: '08:50', room: '',
};

function periodOptionsFromGrid(periods) {
  return periods.filter((p) => !p.isBreak);
}

export default function Timetable() {
  const { user } = useAuth();
  const { campusId, academicYear } = useCampus();
  const { t } = useTranslation();
  const isParent = user?.role === 'PARENT';
  const isTeacher = user?.role === 'TEACHER';
  const isStudent = user?.role === 'STUDENT';
  const isFamily = isParent || isStudent;
  const canEdit = !['PARENT', 'STUDENT', 'TEACHER'].includes(user?.role);
  const canCustomizeStructure = canEdit && user?.role !== 'TEACHER';
  const canDelete = canEdit && user?.role !== 'TEACHER';

  const [teacherView, setTeacherView] = useState('mine');
  const isTeacherMineView = isTeacher && teacherView === 'mine';

  const [slots, setSlots] = useState([]);
  const [allSlots, setAllSlots] = useState([]);
  const [template, setTemplate] = useState(null);
  const [apiPeriods, setApiPeriods] = useState([]);
  const [classes, setClasses] = useState([]);
  const [children, setChildren] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(isParent);
  const [childrenError, setChildrenError] = useState('');
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableError, setTimetableError] = useState('');
  const [selectedChildId, setSelectedChildId] = useState('');
  const [courses, setCourses] = useState([]);
  const [classId, setClassId] = useState('');
  const [formMode, setFormMode] = useState(null);
  const [structureOpen, setStructureOpen] = useState(false);
  const [structureScope, setStructureScope] = useState('class');
  const [dayStartTime, setDayStartTime] = useState('07:30');
  const [periodDefs, setPeriodDefs] = useState(FALLBACK_PERIOD_DEFINITIONS);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [structureError, setStructureError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);

  const selectedChild = isParent
    ? children.find((c) => c.id === selectedChildId)
    : null;

  const selectedClass = isParent
    ? (selectedChild?.class || (selectedChild?.classId
      ? { id: selectedChild.classId, name: 'Your child\'s class' }
      : null))
    : isStudent
      ? (studentProfile?.class || (classId ? { id: classId, name: studentProfile?.class?.name || 'My class' } : null))
      : classes.find((c) => c.id === classId);
  const isEditing = formMode === 'edit';

  const gridPeriods = template?.gridPeriods?.length
    ? template.gridPeriods
    : (apiPeriods.length ? apiPeriods : resolvePeriods([], slots));

  const periods = useMemo(
    () => resolvePeriods(gridPeriods, slots),
    [gridPeriods, slots],
  );

  const lessonPeriods = useMemo(() => periodOptionsFromGrid(periods), [periods]);

  const { grid, days } = useMemo(
    () => buildTimetableGrid(slots, periods, SCHOOL_DAYS),
    [slots, periods],
  );

  const { conflictSlotIds, conflictInfo } = useMemo(
    () => detectTeacherConflicts(allSlots),
    [allSlots],
  );

  const classConflictCount = useMemo(
    () => slots.filter((s) => conflictSlotIds.has(s.id)).length,
    [slots, conflictSlotIds],
  );

  useEffect(() => {
    if (isParent) {
      setChildrenLoading(true);
      setChildrenError('');
      api.getParentChildren()
        .then((list) => {
          setChildren(list);
          if (list.length) {
            setSelectedChildId(list[0].id);
            setClassId(list[0].classId || '');
          } else {
            setSelectedChildId('');
            setClassId('');
          }
        })
        .catch((err) => setChildrenError(err.message || 'Failed to load children'))
        .finally(() => setChildrenLoading(false));
      return;
    }
    if (isStudent) {
      setChildrenLoading(true);
      api.getMe()
        .then((data) => {
          const student = data.user?.student;
          setStudentProfile(student || null);
          if (student?.classId) {
            setClassId(student.classId);
          } else {
            setClassId('');
          }
        })
        .catch((err) => setChildrenError(err.message || 'Failed to load your class'))
        .finally(() => setChildrenLoading(false));
      return;
    }
    api.getClasses().then((data) => {
      setClasses(data);
      if (data.length && !classId) setClassId(data[0].id);
    }).catch(console.error);
  }, [isParent, isStudent, academicYear?.id]);

  useEffect(() => {
    if (!isParent || !selectedChildId) return;
    const child = children.find((c) => c.id === selectedChildId);
    setClassId(child?.classId || '');
  }, [isParent, selectedChildId, children]);

  const reload = useCallback(() => {
    if (isTeacherMineView) {
      setTimetableLoading(true);
      setTimetableError('');
      api.getMyTimetable()
        .then((data) => {
          setSlots(data.slots || []);
          setTemplate(data.template || null);
          setApiPeriods(data.periods || data.template?.gridPeriods || []);
        })
        .catch((err) => setTimetableError(err.message || 'Failed to load your schedule'))
        .finally(() => setTimetableLoading(false));
      return;
    }

    if (!classId) return;
    setTimetableLoading(true);
    setTimetableError('');

    const requests = [
      api.getTimetable(classId).then((data) => {
        setSlots(data.slots || []);
        setTemplate(data.template || null);
        setApiPeriods(data.periods || data.template?.gridPeriods || []);
      }),
    ];

    if (canEdit) {
      requests.push(api.getTimetable().then((data) => setAllSlots(data.slots || [])).catch(() => {}));
    }

    Promise.all(requests)
      .catch((err) => setTimetableError(err.message || 'Failed to load timetable'))
      .finally(() => setTimetableLoading(false));
  }, [classId, canEdit, isTeacherMineView]);

  useEffect(() => {
    if (isTeacherMineView) {
      reload();
      return;
    }
    if (!classId) {
      setSlots([]);
      setTemplate(null);
      setApiPeriods([]);
      setTimetableError('');
      return;
    }
    if (isParent && childrenLoading) return;
    if (isStudent && childrenLoading) return;
    reload();
  }, [classId, isParent, isStudent, childrenLoading, academicYear?.id, reload, isTeacherMineView, teacherView]);

  useEffect(() => {
    if (form.classId) {
      api.getCourses(form.classId).then(setCourses).catch(console.error);
    } else {
      setCourses([]);
    }
  }, [form.classId]);

  const openStructureEditor = async (scope = 'class') => {
    setStructureError('');
    setStructureScope(scope);
    try {
      const data = await api.getTimetableTemplate(scope === 'campus' ? null : classId);
      setDayStartTime(data.dayStartTime || '07:30');
      setPeriodDefs(
        (data.periods || FALLBACK_PERIOD_DEFINITIONS).map(({ label, durationMinutes, isBreak }) => ({
          label,
          durationMinutes,
          isBreak,
        })),
      );
      setStructureOpen(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const closeStructureEditor = () => {
    setStructureOpen(false);
    setStructureError('');
    setSavingStructure(false);
  };

  const handleSaveStructure = async (e) => {
    e.preventDefault();
    setStructureError('');
    setSavingStructure(true);
    try {
      const saved = await api.saveTimetableTemplate({
        classId: structureScope === 'campus' ? null : classId,
        dayStartTime,
        periods: periodDefs,
      });
      setTemplate(saved);
      closeStructureEditor();
      reload();
    } catch (err) {
      setStructureError(err.message);
    } finally {
      setSavingStructure(false);
    }
  };

  const handleResetClassStructure = async () => {
    if (!confirm('Reset this class to the campus default day structure?')) return;
    try {
      const saved = await api.resetClassTimetableTemplate(classId);
      setTemplate(saved);
      closeStructureEditor();
      reload();
    } catch (err) {
      alert(err.message);
    }
  };

  const openCreate = (prefill = {}) => {
    setForm({
      ...EMPTY_FORM,
      classId: classId || '',
      ...prefill,
    });
    setEditingId(null);
    setFormMode('create');
    setError('');
  };

  const openEdit = (slot) => {
    setForm({
      classId: slot.classId || classId,
      subjectId: slot.subjectId || '',
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime?.slice(0, 5) || '08:00',
      endTime: slot.endTime?.slice(0, 5) || '08:50',
      room: slot.room || '',
    });
    setEditingId(slot.id);
    setFormMode('edit');
    setError('');
  };

  const openCell = ({ dayIndex, period }) => {
    if (period.isBreak) return;
    openCreate({
      classId,
      dayOfWeek: dayIndex,
      startTime: period.start,
      endTime: period.end,
    });
  };

  const closeForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormMode(null);
    setError('');
    setSubmitting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const payload = { ...form, subjectId: form.subjectId || null };
    try {
      if (isEditing) {
        await api.updateTimetableSlot(editingId, payload);
      } else {
        await api.createTimetableSlot(payload);
      }
      closeForm();
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this lesson from the timetable?')) return;
    try {
      await api.deleteTimetableSlot(id);
      if (editingId === id) closeForm();
      reload();
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePrint = () => window.print();

  const structureContext = structureScope === 'campus'
    ? 'Campus default (all classes)'
    : selectedClass?.name;

  return (
    <div className="timetable-page">
      <PageHeader
        title={isStudent
          ? t('pages.timetable.titleStudent')
          : isParent
            ? t('pages.timetable.titleParent')
            : isTeacher
              ? t('pages.timetable.titleTeacher')
              : t('pages.timetable.title')}
        description={isStudent
          ? t('pages.timetable.descriptionStudent')
          : isParent
            ? t('pages.timetable.descriptionParent')
            : isTeacher
              ? teacherView === 'mine'
                ? t('pages.timetable.descriptionTeacherMine')
                : t('pages.timetable.descriptionTeacherClass')
              : t('pages.timetable.description')}
        action={(
          <div className="flex flex-wrap gap-2 print:hidden">
            {canCustomizeStructure && (
              <>
                <button
                  type="button"
                  onClick={() => openStructureEditor('class')}
                  disabled={!classId}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  <Settings2 className="w-4 h-4" />
                  {t('pages.timetable.customizeDay')}
                </button>
                <button
                  type="button"
                  onClick={() => openStructureEditor('campus')}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Settings2 className="w-4 h-4" />
                  {t('pages.timetable.campusDefault')}
                </button>
              </>
            )}
            <button type="button" onClick={handlePrint} className="btn-secondary flex items-center gap-2">
              <Printer className="w-4 h-4" />
              {t('ui.print')}
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => openCreate({ classId })}
                disabled={!classId}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {t('pages.timetable.addLesson')}
              </button>
            )}
          </div>
        )}
      />

      {isParent && (
        <ParentChildFilter
          children={children}
          value={selectedChildId}
          onChange={setSelectedChildId}
        />
      )}

      {isTeacher && (
        <div className="filter-panel print:hidden mb-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTeacherView('mine')}
              className={teacherView === 'mine' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            >
              {t('pages.timetable.myLessons')}
            </button>
            <button
              type="button"
              onClick={() => setTeacherView('class')}
              className={teacherView === 'class' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            >
              {t('pages.timetable.classSchedule')}
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {teacherView === 'mine'
              ? t('pages.timetable.teacherMineHint')
              : t('pages.timetable.teacherClassHint')}
          </p>
        </div>
      )}

      <div className="filter-panel print:hidden">
        <p className="filter-panel-title">
          {isParent ? t('pages.timetable.filterWeekly') : isTeacherMineView ? t('pages.timetable.filterMyWeekly') : t('pages.timetable.filterClassSchedule')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          {!isParent && !isTeacherMineView && (
          <div>
            <label className="label flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
              {t('pages.timetable.selectClassRequired')}
            </label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.grade} · {c.section})</option>
              ))}
            </select>
            <p className="field-hint mt-1">
              Day structure: {templateScopeLabel(template)}
              {template && (
                <> · {countTeachingPeriods(gridPeriods)} lessons, {countBreaks(gridPeriods)} breaks, starts {template.dayStartTime}</>
              )}
            </p>
          </div>
          )}
          {isParent && selectedClass && (
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900">{selectedClass.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {countTeachingPeriods(gridPeriods)} lessons per week
                {template?.dayStartTime ? ` · School starts ${template.dayStartTime}` : ''}
              </p>
            </div>
          )}
          {isTeacherMineView && (
            <div className="text-sm text-gray-600 md:col-span-2">
              <p className="font-medium text-gray-900">{t('pages.timetable.personalSchedule')}</p>
              <p className="text-xs text-gray-500 mt-1">
                {classes.length
                  ? `Across ${classes.length} class${classes.length > 1 ? 'es' : ''} · ${countWeeklyPeriods(slots, periods)} lesson${countWeeklyPeriods(slots, periods) === 1 ? '' : 's'} per week`
                  : 'No classes linked to your account yet'}
                {template?.dayStartTime ? ` · School starts ${template.dayStartTime}` : ''}
              </p>
            </div>
          )}
          {isStudent && selectedClass && (
            <div className="text-sm text-gray-600 md:col-span-2">
              <p className="font-medium text-gray-900">{selectedClass.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {countTeachingPeriods(gridPeriods)} lessons per week
                {template?.dayStartTime ? ` · School starts ${template.dayStartTime}` : ''}
              </p>
            </div>
          )}
          {!isParent && !isTeacher && !isStudent && selectedClass && (
            <div className="timetable-legend">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{t('pages.timetable.customizableTitle')}</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>{t('pages.timetable.customTip1')}</li>
                <li>{t('pages.timetable.customTip2')}</li>
                <li>{t('pages.timetable.customTip3')}</li>
                <li>{t('pages.timetable.customTip4')}</li>
                <li className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded bg-orange-300 border border-orange-400" />
                  Orange = teacher scheduled in another class at the same time
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {(selectedClass || isTeacherMineView) && (
        <TimetableSummaryBar
          className={isTeacherMineView ? 'My teaching schedule' : selectedClass.name}
          slotCount={countWeeklyPeriods(slots, periods)}
          hoursLabel={weeklyHours(slots)}
          lessonPeriods={countTeachingPeriods(periods)}
          breakCount={countBreaks(periods)}
          scopeLabel={isTeacherMineView ? 'All assigned classes' : templateScopeLabel(template)}
          conflictCount={isTeacherMineView ? 0 : classConflictCount}
        />
      )}

      {childrenError && (
        <div className="card mb-4 p-4 text-sm text-red-700 bg-red-50 border border-red-100">
          {childrenError}
        </div>
      )}

      {timetableError && (
        <div className="card mb-4 p-4 text-sm text-red-700 bg-red-50 border border-red-100">
          {timetableError}
        </div>
      )}

      {isStudent && childrenLoading ? (
        <div className="card empty-state py-16">
          <p className="text-gray-600 font-medium">{t('pages.timetable.loadingTimetable')}</p>
        </div>
      ) : isStudent && !classId ? (
        <div className="card empty-state py-16 text-center max-w-lg mx-auto">
          <p className="text-gray-900 font-medium">{t('pages.timetable.classNotAssigned')}</p>
          <p className="text-sm text-gray-600 mt-2">
            Your class has not been set yet. The weekly timetable will appear here once the school assigns you to a class.
          </p>
        </div>
      ) : isParent && childrenLoading ? (
        <div className="card empty-state py-16">
          <p className="text-gray-600 font-medium">{t('pages.timetable.loadingChildrenTimetable')}</p>
        </div>
      ) : isParent && !children.length ? (
        <div className="card empty-state py-16 text-center max-w-lg mx-auto">
          <p className="text-gray-900 font-medium">{t('pages.timetable.noChildren')}</p>
          <p className="text-sm text-gray-600 mt-2">
            Once the school approves your registration, your child&apos;s class timetable will appear here.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <Link to={`/campus/${campusId}/register-child`} className="btn-primary text-sm">
              Register a child
            </Link>
            <Link to={`/campus/${campusId}/my-registrations`} className="btn-secondary text-sm">
              My applications
            </Link>
          </div>
        </div>
      ) : isParent && selectedChild && !selectedChild.classId ? (
        <div className="card empty-state py-16 text-center max-w-lg mx-auto">
          <p className="text-gray-900 font-medium">{t('pages.timetable.classNotAssigned')}</p>
          <p className="text-sm text-gray-600 mt-2">
            {selectedChild.firstName} {selectedChild.lastName} is enrolled, but the school has not assigned a class yet.
            The weekly timetable will show here once a class is set.
          </p>
        </div>
      ) : isTeacher && !classes.length ? (
        <div className="card empty-state py-16 text-center max-w-lg mx-auto">
          <p className="text-gray-900 font-medium">{t('pages.timetable.noClassesAssigned')}</p>
          <p className="text-sm text-gray-600 mt-2">
            Your account is not linked to any classes yet. Contact the school office to be assigned as a homeroom or subject teacher.
          </p>
        </div>
      ) : isTeacherMineView && !timetableLoading && !slots.length ? (
        <div className="card empty-state py-16 text-center max-w-lg mx-auto">
          <p className="text-gray-900 font-medium">{t('pages.timetable.noLessonsScheduled')}</p>
          <p className="text-sm text-gray-600 mt-2">
            You have no timetable slots assigned to you yet. Switch to &quot;Class schedule&quot; to view a full class timetable, or ask the school to add your lessons.
          </p>
        </div>
      ) : !isTeacherMineView && !classId ? (
        <div className="card empty-state py-16">
          <p className="text-gray-600 font-medium">{t('pages.timetable.selectClassToView')}</p>
        </div>
      ) : timetableLoading && !grid.length ? (
        <div className="card empty-state py-16">
          <p className="text-gray-600 font-medium">{t('pages.timetable.loadingGeneric')}</p>
        </div>
      ) : (
        <TimetableGrid
          grid={grid}
          days={days}
          canEdit={canEdit}
          onAddCell={openCell}
          onEditSlot={openEdit}
          onDeleteSlot={canDelete ? handleDelete : undefined}
          showClassInCell={isTeacherMineView}
          conflictSlotIds={conflictSlotIds}
          conflictInfo={conflictInfo}
        />
      )}

      <FormModeModal
        open={Boolean(formMode)}
        mode={isEditing ? 'edit' : 'create'}
        title={isEditing ? 'Edit lesson' : 'Add lesson'}
        subtitle={
          isEditing
            ? 'Update subject, time, or room for this period'
            : `Schedule a subject on ${SCHOOL_DAYS.find((d) => d.index === form.dayOfWeek)?.label || 'selected day'}`
        }
        context={selectedClass?.name}
        onClose={closeForm}
        onSubmit={handleSubmit}
        formId="timetable-form"
        submitLabel={isEditing ? 'Save changes' : 'Add to timetable'}
        submitting={submitting}
        error={error}
        size="lg"
      >
        <FormSection title="Lesson details">
          <div>
            <label className="label">{t('ui.class')} *</label>
            <select
              className="input"
              required
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value, subjectId: '' })}
            >
              <option value="">{t('pages.courses.selectClass')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('pages.timetable.modalSubject')}</label>
            <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">{t('pages.timetable.freePeriod')}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('pages.timetable.dayRequired')}</label>
            <select className="input" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
              {SCHOOL_DAYS.map((d) => (
                <option key={d.index} value={d.index}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('pages.timetable.periodSlot')}</label>
            <select
              className="input"
              value={`${form.startTime}-${form.endTime}`}
              onChange={(e) => {
                const period = lessonPeriods.find((p) => `${p.start}-${p.end}` === e.target.value);
                if (period) {
                  setForm({ ...form, startTime: period.start, endTime: period.end });
                }
              }}
            >
              {lessonPeriods.map((p) => (
                <option key={`${p.start}-${p.end}`} value={`${p.start}-${p.end}`}>
                  {p.label} ({p.start} – {p.end})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('pages.timetable.startRequired')}</label>
            <input className="input" type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('pages.timetable.endRequired')}</label>
            <input className="input" type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('pages.timetable.roomClassroom')}</label>
            <input className="input" placeholder="e.g. P5-A, Lab" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </div>
        </FormSection>
      </FormModeModal>

      <FormModeModal
        open={structureOpen}
        mode="edit"
        title={structureScope === 'campus' ? 'Campus day structure' : 'Customize class day structure'}
        subtitle="Add lessons and breaks in any order — set duration for each period"
        context={structureContext}
        onClose={closeStructureEditor}
        onSubmit={handleSaveStructure}
        formId="timetable-structure-form"
        submitLabel="Save day structure"
        submitting={savingStructure}
        error={structureError}
        size="xl"
        footerExtra={structureScope === 'class' && template?.classId === classId && !template?.isCampusDefault && (
          <button
            type="button"
            className="btn-ghost text-sm text-amber-700 flex items-center gap-1.5 mr-auto"
            onClick={handleResetClassStructure}
          >
            <RotateCcw className="w-4 h-4" />
            Use campus default
          </button>
        )}
      >
        <TimetablePeriodEditor
          dayStartTime={dayStartTime}
          periods={periodDefs}
          onDayStartChange={setDayStartTime}
          onPeriodsChange={setPeriodDefs}
        />
      </FormModeModal>
    </div>
  );
}
