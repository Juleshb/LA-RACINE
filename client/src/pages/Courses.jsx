import { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, BookOpen, Layers, BookMarked, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { groupCoursesByCategory, formatGradingScale } from '../lib/curriculum';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';
import BulletinLayoutPanel from '../components/bulletin/BulletinLayoutPanel';
import FormModeModal from '../components/form/FormModeModal';
import SegmentedControl from '../components/form/SegmentedControl';
import CourseFormFields from '../components/courses/CourseFormFields';

const EMPTY_FORM = {
  entryMode: 'template',
  domainIndex: '',
  subjectIndex: '',
  domainChoice: '',
  customDomain: '',
  name: '',
  code: '',
  teacherId: '',
  periodsPerWeek: 1,
  test1Max: '',
  test2Max: '',
};

function buildDomainOptions(curriculumDomains, grouped) {
  const options = [];
  const seen = new Set();

  for (const d of curriculumDomains) {
    if (!seen.has(d.name)) {
      seen.add(d.name);
      options.push({ value: `tpl:${d.name}`, label: d.name, order: d.order, source: 'template' });
    }
  }
  for (const g of grouped) {
    if (g.category && g.category !== 'OTHER' && !seen.has(g.category)) {
      seen.add(g.category);
      options.push({
        value: `cls:${g.category}`,
        label: g.category,
        order: g.categoryOrder,
        source: 'class',
      });
    }
  }
  return options.sort((a, b) => a.order - b.order);
}

function resolveDomain(form, curriculumDomains, domainOptions) {
  if (form.entryMode === 'template') {
    const domain = curriculumDomains[Number(form.domainIndex)];
    if (!domain) return null;
    return { name: domain.name, order: domain.order };
  }

  if (form.domainChoice === '__new__') {
    const name = form.customDomain.trim();
    if (!name) return null;
    const maxOrder = domainOptions.reduce((m, o) => Math.max(m, o.order || 0), 0);
    return { name, order: maxOrder + 1 };
  }

  const selected = domainOptions.find((o) => o.value === form.domainChoice);
  if (selected) return { name: selected.label, order: selected.order };

  return null;
}

const ENTRY_OPTIONS = [
  { value: 'template', label: 'From bulletin', icon: BookOpen },
  { value: 'custom', label: 'Custom', icon: Sparkles },
];

export default function Courses() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isTeacher = user?.role === 'TEACHER';
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [curriculumDomains, setCurriculumDomains] = useState([]);
  const [classId, setClassId] = useState('');
  const [courses, setCourses] = useState([]);
  const [formMode, setFormMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
  const [bulletinPresets, setBulletinPresets] = useState([]);
  const [bulletinConfig, setBulletinConfig] = useState(null);
  const [bulletinPreset, setBulletinPreset] = useState('STANDARD');
  const [customAssessments, setCustomAssessments] = useState([
    { key: 'TEST1', label: 'TEST 1', maxField: 'test1Max', fallbackMax: 10 },
    { key: 'TEST2', label: 'TEST 2', maxField: 'test2Max', fallbackMax: 10 },
    { key: 'EX', label: 'EX', maxField: 'examMax', fallbackMax: 20 },
  ]);
  const [bulletinSaving, setBulletinSaving] = useState(false);
  const [bulletinMessage, setBulletinMessage] = useState('');

  const isEditing = formMode === 'edit';
  const selectedClass = classes.find((c) => c.id === classId);
  const template = templates.find((t) => t.grade === selectedClass?.grade);
  const grouped = groupCoursesByCategory(courses);
  const grandTotal = courses.reduce((sum, c) => sum + (c.totalMax || 0), 0);
  const editingCourse = courses.find((c) => c.id === editingId);
  const domainOptions = useMemo(
    () => buildDomainOptions(curriculumDomains, grouped),
    [curriculumDomains, grouped],
  );

  const selectedDomain = useMemo(() => {
    if (form.domainIndex === '') return null;
    return curriculumDomains[Number(form.domainIndex)] || null;
  }, [form.domainIndex, curriculumDomains]);

  useEffect(() => {
    api.getClasses().then((data) => {
      setClasses(data);
      if (data.length > 0) setClassId(data[0].id);
    }).catch(console.error);
    if (!isTeacher) {
      api.getTeachers().then(setTeachers).catch(console.error);
      api.getCourseCurricula().then(setTemplates).catch(console.error);
      api.getBulletinPresets().then(setBulletinPresets).catch(console.error);
    }
  }, [isTeacher]);

  const loadCourses = () => {
    if (!classId) return;
    api.getCourses(classId).then(setCourses).catch(console.error);
  };

  useEffect(() => {
    loadCourses();
    setMessage('');
    closeForm();
  }, [classId]);

  useEffect(() => {
    if (!selectedClass?.grade) {
      setCurriculumDomains([]);
      return;
    }
    api.getCurriculumForGrade(selectedClass.grade)
      .then((data) => setCurriculumDomains(data.domains || []))
      .catch(() => setCurriculumDomains([]));
  }, [selectedClass?.grade]);

  useEffect(() => {
    if (!classId) {
      setBulletinConfig(null);
      return;
    }
    api.getClassBulletinConfig(classId).then((data) => {
      setBulletinConfig(data.config);
      const stored = data.stored?.preset || data.config?.preset || 'STANDARD';
      setBulletinPreset(stored);
      if (stored === 'CUSTOM' && data.stored?.assessments) {
        setCustomAssessments(data.stored.assessments);
      }
    }).catch(console.error);
  }, [classId]);

  const saveBulletinConfig = async () => {
    if (!classId) return;
    setBulletinSaving(true);
    setBulletinMessage('');
    try {
      const payload = bulletinPreset === 'CUSTOM'
        ? { preset: 'CUSTOM', assessments: customAssessments }
        : { preset: bulletinPreset };
      const data = await api.updateClassBulletinConfig(classId, payload);
      setBulletinConfig(data.config);
      setBulletinMessage('Bulletin layout saved for this class.');
    } catch (err) {
      setBulletinMessage(err.message);
    } finally {
      setBulletinSaving(false);
    }
  };

  const openCreateForm = (entryMode = 'template', domainPrefill = null) => {
    setForm({
      ...EMPTY_FORM,
      entryMode,
      ...(domainPrefill || {}),
    });
    setEditingId(null);
    setFormMode('create');
    setError('');
  };

  const openEditForm = (course) => {
    const match = domainOptions.find((o) => o.label === course.category);
    setForm({
      entryMode: 'custom',
      domainIndex: '',
      subjectIndex: '',
      domainChoice: match?.value || '__new__',
      customDomain: match ? '' : (course.category || ''),
      name: course.name,
      code: course.code,
      teacherId: course.teacherId || '',
      periodsPerWeek: course.periodsPerWeek || 1,
      test1Max: course.test1Max ?? '',
      test2Max: course.test2Max ?? '',
    });
    setEditingId(course.id);
    setFormMode('edit');
    setError('');
  };

  const closeForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormMode(null);
    setError('');
    setSubmitting(false);
  };

  const pickTemplateSubject = (domainIndex, subjectIndex) => {
    const domain = curriculumDomains[Number(domainIndex)];
    const sub = domain?.subjects?.[Number(subjectIndex)];
    if (!sub) return;
    setForm((f) => ({
      ...f,
      domainIndex,
      subjectIndex,
      name: sub.name,
      code: sub.code,
      test1Max: sub.test1Max,
      test2Max: sub.test2Max,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!classId) return setError('Select a class first');
    if (!form.name.trim() || !form.code.trim()) {
      return setError('Sub-subject name and code are required.');
    }

    const domain = resolveDomain(form, curriculumDomains, domainOptions);
    if (!domain?.name) {
      return setError('Domain / Domaine is required.');
    }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      classId,
      teacherId: form.teacherId || null,
      periodsPerWeek: Number(form.periodsPerWeek) || 1,
      category: domain.name,
      categoryOrder: domain.order,
      sortOrder: form.entryMode === 'template' && form.subjectIndex !== '' ? Number(form.subjectIndex) + 1 : 0,
      test1Max: form.test1Max !== '' ? Number(form.test1Max) : null,
      test2Max: form.test2Max !== '' ? Number(form.test2Max) : null,
    };

    setSubmitting(true);
    try {
      if (isEditing) {
        await api.updateCourse(editingId, payload);
        setMessage(`Updated "${payload.name}" successfully.`);
      } else {
        await api.createCourse(payload);
        setMessage(`Added "${payload.name}" to ${selectedClass?.name || 'class'}.`);
      }
      closeForm();
      loadCourses();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this sub-subject from the class bulletin?')) return;
    try {
      await api.deleteCourse(id);
      if (editingId === id) closeForm();
      loadCourses();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApplyCurriculum = async () => {
    if (!classId || !selectedClass) return;
    const tpl = template;
    if (!confirm(`Load bulletin courses for ${selectedClass.name}?\n${tpl ? `${tpl.subjectCount} sub-subjects · ${tpl.grandTotalMax} pts max` : ''}`)) return;
    setApplying(true);
    setMessage('');
    try {
      const result = await api.applyCourseCurriculum(classId, selectedClass.grade);
      setMessage(result.message);
      loadCourses();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setApplying(false);
    }
  };

  const handleApplyAll = async () => {
    if (!confirm('Load bulletin courses for ALL classes in this academic year?\n(Primary P1–P6: 21 sub-subjects · Nursery/Crèche: 12 sub-subjects)')) return;
    setApplyingAll(true);
    setMessage('');
    try {
      const result = await api.applyCourseCurriculumAll();
      setMessage(result.message);
      loadCourses();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setApplyingAll(false);
    }
  };

  const exMax = form.test1Max && form.test2Max
    ? Number(form.test1Max) + Number(form.test2Max)
    : null;

  const formFieldsProps = {
    form,
    setForm,
    isEditing,
    curriculumDomains,
    domainOptions,
    selectedDomain,
    teachers,
    onPickTemplate: pickTemplateSubject,
    exMax,
  };

  return (
    <div>
      <PageHeader
        title={isTeacher ? t('pages.courses.titleTeacher') : t('pages.courses.title')}
        description={isTeacher
          ? t('pages.courses.descriptionTeacher')
          : t('pages.courses.description')}
        action={!isTeacher && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleApplyAll}
              disabled={applyingAll || classes.length === 0}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <Layers className="w-4 h-4" />
              {applyingAll ? t('ui.loading') : t('pages.courses.loadAllClasses')}
            </button>
            <button
              onClick={handleApplyCurriculum}
              disabled={!classId || applying || !template}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <BookOpen className="w-4 h-4" />
              {applying ? t('ui.loading') : t('pages.courses.loadBulletin')}
            </button>
            <button
              onClick={() => openCreateForm('custom')}
              disabled={!classId}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {t('pages.courses.customSubSubject')}
            </button>
            <button
              onClick={() => openCreateForm('template')}
              disabled={!classId}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {t('pages.courses.addSubSubject')}
            </button>
          </div>
        )}
      />

      <div className="filter-panel">
        <p className="filter-panel-title">{t('pages.courses.selectClass')}</p>
        <div className="flex gap-4 flex-wrap items-end">
          <div className="min-w-[280px] flex-1 max-w-md">
            <label className="label">{t('pages.courses.classLabel')}</label>
            <select
              className="input"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>
              ))}
            </select>
          </div>
          {selectedClass && template && (
            <div className="flex flex-wrap gap-2 pb-1">
              <span className="layout-flow-chip layout-flow-chip-lg">{t('pages.courses.studentsChip', { count: selectedClass._count?.students || 0 })}</span>
              <span className="layout-flow-chip">{t('pages.courses.templateChip', { count: template.subjectCount })}</span>
              <span className="layout-flow-chip">{t('pages.courses.ptsMaxChip', { count: template.grandTotalMax })}</span>
              {grandTotal > 0 && (
                <span className="layout-flow-chip layout-flow-chip-lg bg-emerald-50 text-emerald-700">
                  {t('pages.courses.loadedPtsChip', { count: grandTotal })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {classId && bulletinConfig && !isTeacher && (
        <BulletinLayoutPanel
          className={selectedClass?.name}
          bulletinConfig={bulletinConfig}
          bulletinPresets={bulletinPresets}
          bulletinPreset={bulletinPreset}
          onPresetChange={setBulletinPreset}
          customAssessments={customAssessments}
          onCustomAssessmentsChange={setCustomAssessments}
          onSave={saveBulletinConfig}
          saving={bulletinSaving}
          message={bulletinMessage}
        />
      )}

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm border ${message.includes('Added') || message.includes('Updated') || message.includes('Loaded') || message.includes('already') || message.includes('saved') ? 'bg-brand-50 text-brand-700 border-brand-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
          {message}
        </div>
      )}

      <FormModeModal
        open={Boolean(formMode)}
        mode={isEditing ? 'edit' : 'create'}
        title={isEditing ? 'Edit sub-subject' : 'Add sub-subject'}
        subtitle={
          isEditing
            ? 'Update domain, grading scale, or teacher assignment'
            : form.entryMode === 'template'
              ? 'Pick from the grade bulletin template'
              : 'Create a custom domain and sub-subject'
        }
        context={isEditing ? editingCourse?.code : selectedClass?.grade}
        onClose={closeForm}
        onSubmit={handleSubmit}
        formId={isEditing ? 'course-form-edit' : 'course-form-create'}
        submitLabel={isEditing ? 'Save changes' : 'Add sub-subject'}
        submitting={submitting}
        error={error}
        size="lg"
        headerExtra={!isEditing ? (
          <SegmentedControl
            value={form.entryMode}
            onChange={(v) => setForm({ ...EMPTY_FORM, entryMode: v })}
            options={ENTRY_OPTIONS}
          />
        ) : null}
      >
        <CourseFormFields {...formFieldsProps} />
      </FormModeModal>

      <div className="card p-0 overflow-hidden">
        {courses.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon"><BookMarked className="w-6 h-6" /></div>
            <p className="text-gray-600 font-medium">{t('pages.courses.emptyNoCourses', { className: selectedClass?.name || t('ui.thisCampus') })}</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">{t('pages.courses.emptyNoCoursesHint')}</p>
            <div className="flex gap-3 justify-center flex-wrap">
              {template && (
                <button onClick={handleApplyCurriculum} disabled={applying} className="btn-primary inline-flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Load {selectedClass?.grade} bulletin
                </button>
              )}
              <button onClick={() => openCreateForm('custom')} className="btn-secondary inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Add custom
              </button>
            </div>
          </div>
        ) : (
          <div>
            {grouped.map((group) => (
              <div key={group.category} className="domain-block border-0 rounded-none mb-0 border-b border-gray-200 last:border-b-0">
                <div className="domain-block-header flex items-center justify-between gap-2">
                  <span>{group.category}</span>
                  <div className="flex items-center gap-2">
                    {group.domainTotalMax > 0 && (
                      <span className="text-xs font-normal text-brand-600">{group.domainTotalMax} pts max</span>
                    )}
                    {!isTeacher && (!formMode || formMode === 'edit') ? (
                      <button
                        type="button"
                        onClick={() => openCreateForm('custom', {
                          domainChoice: domainOptions.find((o) => o.label === group.category)?.value || '__new__',
                          customDomain: domainOptions.find((o) => o.label === group.category) ? '' : group.category,
                        })}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-1 rounded hover:bg-brand-50"
                      >
                        + Add here
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-report">
                    <thead>
                      <tr>
                        <th>{t('pages.courses.colSubSubject')}</th>
                        <th>{t('pages.courses.colCode')}</th>
                        <th>{t('pages.courses.colGradingScale')}</th>
                        <th>{t('pages.courses.colTeacher')}</th>
                        {!isTeacher && <th className="text-right">{t('pages.courses.colActions')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {group.courses.map((course) => {
                        const isActive = editingId === course.id;
                        return (
                          <tr key={course.id} className={isActive ? 'table-row-active' : ''}>
                            <td className="font-medium text-gray-800">
                              {course.name}
                              {isActive && (
                                <span className="ml-2 text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                  Editing
                                </span>
                              )}
                            </td>
                            <td className="text-gray-500 font-mono text-xs">{course.code}</td>
                            <td className="text-gray-600 text-sm">{formatGradingScale(course) || '—'}</td>
                            <td className="text-sm">{course.teacher?.name || '—'}</td>
                            {!isTeacher && (
                            <td className="text-right">
                              <div className="flex gap-1 justify-end">
                                <button
                                  type="button"
                                  onClick={() => openEditForm(course)}
                                  className={`p-2 rounded-lg transition-colors ${isActive ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:text-brand-600 hover:bg-brand-50'}`}
                                  title="Edit sub-subject"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(course.id)}
                                  disabled={Boolean(formMode)}
                                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
