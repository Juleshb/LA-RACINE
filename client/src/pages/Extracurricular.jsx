import { useEffect, useState, useMemo } from 'react';
import {
  Plus, Trash2, Pencil, Users, Sparkles, Check, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { PRIMARY_GRADES, PRIMARY_GRADE_LABELS } from '../config/grades';
import { useTranslation } from '../context/LanguageContext';

const EMPTY_FORM = {
  name: '',
  description: '',
  category: '',
  schedule: '',
  location: '',
  instructorKind: 'TEACHER',
  instructorTeacherId: '',
  externalInstructorId: '',
  registerExternal: false,
  externalName: '',
  externalPhone: '',
  externalEmail: '',
  externalSpecialty: '',
  maxStudents: '',
  allowedGrades: [...PRIMARY_GRADES],
  isActive: true,
};

const CATEGORIES = ['Sport', 'Arts', 'Music', 'Science Club', 'Language', 'Other'];

export default function Extracurricular() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const canManage = [
    'SCHOOL_MANAGER',
    'SCHOOL_ADMIN',
    'SECRETARY',
    'HEAD_OF_STUDIES',
    'HEAD_OF_DISCIPLINE',
    'ACTIVITIES_MANAGER',
  ].includes(user?.role);
  const isTeacher = user?.role === 'TEACHER';
  const isStudent = user?.role === 'STUDENT';
  const isChooser = ['PARENT', 'STUDENT'].includes(user?.role);

  const [activities, setActivities] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [externalInstructors, setExternalInstructors] = useState([]);
  const [primaryClasses, setPrimaryClasses] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [enrollClassId, setEnrollClassId] = useState('');
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [formMode, setFormMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const forStudentId = isChooser
    ? (user?.role === 'STUDENT' ? user?.studentId : selectedStudentId)
    : undefined;

  const load = () => {
    api.getExtracurricular(forStudentId || undefined).then((data) => {
      setActivities(data.activities || []);
      setPrimaryClasses(data.primaryClasses || []);
      setTeachers(data.teachers || []);
      setExternalInstructors(data.externalInstructors || []);
    }).catch(console.error);
  };

  useEffect(() => {
    if (user?.role === 'PARENT') {
      api.getExtracurricularEligibleStudents().then((list) => {
        setChildren(list || []);
        if (list?.length && !selectedStudentId) {
          setSelectedStudentId(list[0].id);
        }
      }).catch(console.error);
    }
  }, [user?.role]);

  useEffect(() => { load(); }, [forStudentId]);

  const loadDetail = async (id) => {
    try {
      const data = await api.getExtracurricularActivity(id);
      setDetail(data);
      setExpandedId(id);
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleExpand = (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    loadDetail(id);
  };

  useEffect(() => {
    if (!expandedId || !canManage) return;
    api.getExtracurricularEligibleStudents({
      classId: enrollClassId || undefined,
      activityId: expandedId,
    }).then(setEligibleStudents).catch(console.error);
  }, [expandedId, enrollClassId, canManage]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, allowedGrades: [...PRIMARY_GRADES] });
    setEditingId(null);
    setFormMode('create');
    setError('');
  };

  const openEdit = (activity) => {
    setForm({
      name: activity.name,
      description: activity.description || '',
      category: activity.category || '',
      schedule: activity.schedule || '',
      location: activity.location || '',
      instructorKind: activity.instructorKind === 'EXTERNAL' ? 'EXTERNAL' : 'TEACHER',
      instructorTeacherId: activity.instructorTeacherId || '',
      externalInstructorId: activity.externalInstructorId || '',
      registerExternal: false,
      externalName: '',
      externalPhone: '',
      externalEmail: '',
      externalSpecialty: '',
      maxStudents: activity.maxStudents ?? '',
      allowedGrades: activity.allowedGrades?.length ? activity.allowedGrades : [...PRIMARY_GRADES],
      isActive: activity.isActive !== false,
    });
    setEditingId(activity.id);
    setFormMode('edit');
    setError('');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setError('');
    setSubmitting(false);
  };

  const toggleGrade = (grade) => {
    setForm((prev) => {
      const has = prev.allowedGrades.includes(grade);
      const allowedGrades = has
        ? prev.allowedGrades.filter((g) => g !== grade)
        : [...prev.allowedGrades, grade];
      return { ...prev, allowedGrades };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      schedule: form.schedule,
      location: form.location,
      maxStudents: form.maxStudents ? Number(form.maxStudents) : null,
      allowedGrades: form.allowedGrades,
      isActive: form.isActive,
      instructorKind: form.instructorKind,
      instructorTeacherId: form.instructorKind === 'TEACHER' ? (form.instructorTeacherId || null) : null,
      externalInstructorId: form.instructorKind === 'EXTERNAL' && !form.registerExternal
        ? (form.externalInstructorId || null)
        : null,
      externalInstructor: form.instructorKind === 'EXTERNAL' && form.registerExternal
        ? {
          name: form.externalName,
          phone: form.externalPhone,
          email: form.externalEmail,
          specialty: form.externalSpecialty,
        }
        : undefined,
    };
    try {
      if (editingId) {
        await api.updateExtracurricularActivity(editingId, payload);
      } else {
        await api.createExtracurricularActivity(payload);
      }
      closeForm();
      load();
      if (expandedId) loadDetail(expandedId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('pageBody.activities.deleteConfirm'))) return;
    try {
      await api.deleteExtracurricularActivity(id);
      if (expandedId === id) {
        setExpandedId(null);
        setDetail(null);
      }
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEnroll = async (activityId, studentId) => {
    try {
      await api.enrollExtracurricular(activityId, studentId);
      load();
      if (expandedId === activityId) loadDetail(activityId);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUnenroll = async (activityId, studentId) => {
    if (!confirm(t('pageBody.activities.unenrollConfirm'))) return;
    try {
      await api.unenrollExtracurricular(activityId, studentId);
      load();
      if (expandedId === activityId) loadDetail(activityId);
    } catch (err) {
      alert(err.message);
    }
  };

  const enrolledInDetail = useMemo(() => {
    if (!detail?.enrollmentsByClass) return new Set();
    const ids = new Set();
    for (const group of detail.enrollmentsByClass) {
      for (const s of group.students) ids.add(s.id);
    }
    return ids;
  }, [detail]);

  return (
    <div>
      <PageHeader
        title={isStudent
          ? t('pages.activities.titleStudent')
          : isChooser && user?.role === 'PARENT'
            ? t('pages.activities.titleShort')
            : isTeacher
              ? t('pages.activities.titleShort')
              : t('pages.activities.title')}
        description={isStudent
          ? t('pages.activities.descriptionStudent')
          : isChooser && user?.role === 'PARENT'
            ? t('pages.activities.descriptionParent')
            : isTeacher
              ? t('pages.activities.descriptionTeacher')
              : t('pages.activities.description')}
        action={canManage && (
          <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('pages.activities.add')}
          </button>
        )}
      />

      {isChooser && user?.role === 'PARENT' && (
        <div className="filter-panel mb-6">
          <p className="filter-panel-title">{t('pageBody.activities.parentFilterTitle')}</p>
          {children.length === 0 ? (
            <p className="text-sm text-gray-500">{t('pageBody.activities.noPrimaryChildren')}</p>
          ) : (
            <div>
              <label className="label">{t('pageBody.activities.childPrimaryOnly')}</label>
              <select
                className="input max-w-md"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.className || t('pageBody.activities.noClass')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {isChooser && (
        <div className="card mb-6 p-4 border-l-4 border-l-brand-500">
          <p className="text-sm text-gray-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-600 shrink-0" />
            {t('pageBody.activities.chooserHint')}
          </p>
        </div>
      )}

      {canManage && primaryClasses.length > 0 && (
        <div className="card mb-6 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{t('pageBody.activities.primaryClassesLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {primaryClasses.map((c) => (
              <span key={c.id} className="timetable-stat-chip">{c.name}</span>
            ))}
          </div>
          <p className="field-hint mt-2">{t('pageBody.activities.primaryOnlyHint')}</p>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="card empty-state py-16">
          <Sparkles className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">{t('pageBody.activities.empty')}</p>
          {canManage && <p className="text-sm text-gray-400 mt-1">{t('pageBody.activities.emptyHint')}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="card overflow-hidden">
              <div className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {activity.category && (
                      <span className="form-mode-badge form-mode-badge-create">{activity.category}</span>
                    )}
                    {!activity.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">{t('ui.inactive')}</span>
                    )}
                    {activity.isEnrolled && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">{t('ui.enrolled')}</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{activity.name}</h3>
                  {activity.description && (
                    <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                    {activity.schedule && <span>📅 {activity.schedule}</span>}
                    {activity.location && <span>📍 {activity.location}</span>}
                    {activity.instructor && <span>👤 {activity.instructor}</span>}
                    <span>
                      <Users className="w-3 h-3 inline mr-0.5" />
                      {activity.enrollmentCount}
                      {activity.maxStudents ? ` / ${activity.maxStudents}` : ''} {t('pageBody.activities.enrolledSuffix')}
                    </span>
                    <span>{t('pageBody.activities.gradesPrefix')} {activity.allowedGrades?.join(', ')}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {isChooser && forStudentId && (
                    activity.isEnrolled ? (
                      <button
                        type="button"
                        className="btn-secondary text-sm flex items-center gap-1"
                        onClick={() => handleUnenroll(activity.id, forStudentId)}
                      >
                        <X className="w-4 h-4" />
                        {t('ui.withdraw')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50"
                        disabled={activity.isFull}
                        onClick={() => handleEnroll(activity.id, forStudentId)}
                      >
                        <Check className="w-4 h-4" />
                        {activity.isFull ? t('ui.full') : t('ui.choose')}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    className="btn-secondary text-sm flex items-center gap-1"
                    onClick={() => toggleExpand(activity.id)}
                  >
                    {expandedId === activity.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {t('ui.byClass')}
                  </button>
                  {canManage && (
                    <>
                      <button type="button" className="btn-secondary text-sm" onClick={() => openEdit(activity)}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" className="btn-secondary text-sm text-red-600" onClick={() => handleDelete(activity.id)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {expandedId === activity.id && detail && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                    {t('pageBody.activities.studentsByClass')}
                  </p>

                  {detail.enrollmentsByClass?.length === 0 ? (
                    <p className="text-sm text-gray-500">{t('pageBody.activities.noEnrollments')}</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                      {detail.enrollmentsByClass.map((group) => (
                        <div key={group.classId || group.className} className="rounded-lg border border-gray-200 bg-white p-3">
                          <p className="font-semibold text-sm text-gray-900 mb-2">{group.className}</p>
                          <ul className="space-y-1">
                            {group.students.map((s) => (
                              <li key={s.id} className="text-sm text-gray-600 flex items-center justify-between gap-2">
                                <span>{s.name}</span>
                                {canManage && (
                                  <button
                                    type="button"
                                    className="text-red-500 hover:text-red-700 text-xs"
                                    onClick={() => handleUnenroll(activity.id, s.id)}
                                  >
                                    {t('ui.remove')}
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {canManage && (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
                      <p className="text-sm font-medium text-gray-700 mb-3">{t('pageBody.activities.addStudentTitle')}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="label">{t('ui.class')}</label>
                          <select
                            className="input"
                            value={enrollClassId}
                            onChange={(e) => setEnrollClassId(e.target.value)}
                          >
                            <option value="">{t('pageBody.activities.allPrimaryClasses')}</option>
                            {primaryClasses.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {eligibleStudents
                          .filter((s) => !enrolledInDetail.has(s.id))
                          .map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="text-xs px-2 py-1 rounded-full border border-gray-200 hover:border-brand-300 hover:bg-brand-50"
                              onClick={() => handleEnroll(activity.id, s.id)}
                            >
                              + {s.name} ({s.className})
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FormModeModal
        open={Boolean(formMode)}
        mode={formMode === 'edit' ? 'edit' : 'create'}
        title={formMode === 'edit' ? t('pageBody.activities.editTitle') : t('pageBody.activities.newTitle')}
        subtitle={t('pageBody.activities.formSubtitle')}
        onClose={closeForm}
        onSubmit={handleSubmit}
        formId="activity-form"
        submitLabel={formMode === 'edit' ? t('ui.saveChanges') : t('pageBody.activities.createSubmit')}
        submitting={submitting}
        error={error}
        size="lg"
      >
        <FormSection title={t('ui.activityDetails')}>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('ui.name')} *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('pageBody.activities.namePlaceholder')} />
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('ui.description')}</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('ui.category')}</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">{t('pageBody.activities.selectCategory')}</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('ui.maxStudents')}</label>
            <input className="input" type="number" min={1} value={form.maxStudents} onChange={(e) => setForm({ ...form, maxStudents: e.target.value })} placeholder={t('ui.noLimit')} />
          </div>
          <div>
            <label className="label">{t('ui.schedule')}</label>
            <input className="input" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder={t('pageBody.activities.schedulePlaceholder')} />
          </div>
          <div>
            <label className="label">{t('ui.location')}</label>
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t('pageBody.activities.locationPlaceholder')} />
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('ui.instructor')}</label>
            <div className="flex flex-wrap gap-3 mb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="instructorKind"
                  checked={form.instructorKind === 'TEACHER'}
                  onChange={() => setForm({
                    ...form,
                    instructorKind: 'TEACHER',
                    registerExternal: false,
                    externalInstructorId: '',
                  })}
                />
                {t('pageBody.activities.instructorFromTeachers')}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="instructorKind"
                  checked={form.instructorKind === 'EXTERNAL'}
                  onChange={() => setForm({ ...form, instructorKind: 'EXTERNAL', instructorTeacherId: '' })}
                />
                {t('pageBody.activities.instructorExternal')}
              </label>
            </div>
            {form.instructorKind === 'TEACHER' ? (
              <select
                className="input"
                value={form.instructorTeacherId}
                onChange={(e) => setForm({ ...form, instructorTeacherId: e.target.value })}
              >
                <option value="">{t('pageBody.activities.selectTeacher')}</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}{teacher.subject ? ` — ${teacher.subject}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                {!form.registerExternal && (
                  <select
                    className="input"
                    value={form.externalInstructorId}
                    onChange={(e) => setForm({ ...form, externalInstructorId: e.target.value })}
                  >
                    <option value="">{t('pageBody.activities.selectExternal')}</option>
                    {externalInstructors.map((ext) => (
                      <option key={ext.id} value={ext.id}>
                        {ext.name}{ext.specialty ? ` — ${ext.specialty}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.registerExternal}
                    onChange={(e) => setForm({
                      ...form,
                      registerExternal: e.target.checked,
                      externalInstructorId: e.target.checked ? '' : form.externalInstructorId,
                    })}
                  />
                  {t('pageBody.activities.registerExternal')}
                </label>
                {form.registerExternal && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="md:col-span-2">
                      <label className="label">{t('ui.name')} *</label>
                      <input
                        className="input"
                        required
                        value={form.externalName}
                        onChange={(e) => setForm({ ...form, externalName: e.target.value })}
                        placeholder={t('pageBody.activities.externalNamePlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="label">{t('ui.phone')}</label>
                      <input
                        className="input"
                        value={form.externalPhone}
                        onChange={(e) => setForm({ ...form, externalPhone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">{t('ui.email')}</label>
                      <input
                        className="input"
                        type="email"
                        value={form.externalEmail}
                        onChange={(e) => setForm({ ...form, externalEmail: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">{t('pageBody.activities.specialty')}</label>
                      <input
                        className="input"
                        value={form.externalSpecialty}
                        onChange={(e) => setForm({ ...form, externalSpecialty: e.target.value })}
                        placeholder={t('pageBody.activities.specialtyPlaceholder')}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('pageBody.activities.openToGrades')}</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {PRIMARY_GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGrade(g)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.allowedGrades.includes(g)
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {PRIMARY_GRADE_LABELS[g]}
                </button>
              ))}
            </div>
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span className="text-sm text-gray-700">{t('pageBody.activities.openForEnrollment')}</span>
            </label>
          </div>
        </FormSection>
      </FormModeModal>
    </div>
  );
}
