import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';

const EMPTY_FORM = { name: '', grade: '', section: '', teacherId: '' };

export default function Classes() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isTeacher = user?.role === 'TEACHER';
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [formMode, setFormMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEditing = formMode === 'edit';
  const editingClass = classes.find((c) => c.id === editingId);

  const loadClasses = () => api.getClasses().then(setClasses).catch(console.error);

  useEffect(() => {
    loadClasses();
    if (!isTeacher) {
      api.getTeachers().then(setTeachers).catch(console.error);
    }
  }, [isTeacher]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormMode('create');
    setError('');
  };

  const openEdit = (cls) => {
    setForm({ name: cls.name, grade: cls.grade, section: cls.section, teacherId: cls.teacherId || '' });
    setEditingId(cls.id);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const payload = { ...form, teacherId: form.teacherId || null };
    try {
      if (isEditing) {
        await api.updateClass(editingId, payload);
      } else {
        await api.createClass(payload);
      }
      closeForm();
      loadClasses();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('pageBody.classes.deleteConfirm'))) return;
    try {
      await api.deleteClass(id);
      if (editingId === id) closeForm();
      loadClasses();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title={isTeacher ? t('pages.classes.titleTeacher') : t('pages.classes.title')}
        description={isTeacher
          ? t('pages.classes.descriptionTeacher')
          : t('pages.classes.description')}
        action={!isTeacher && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('pages.classes.add')}
          </button>
        )}
      />

      <FormModeModal
        open={Boolean(formMode)}
        mode={isEditing ? 'edit' : 'create'}
        title={isEditing ? t('pageBody.classes.editTitle') : t('pageBody.classes.newTitle')}
        subtitle={isEditing ? t('pageBody.classes.editSubtitle') : t('pageBody.classes.newSubtitle')}
        context={isEditing ? `${editingClass?.grade}-${editingClass?.section}` : undefined}
        onClose={closeForm}
        onSubmit={handleSubmit}
        formId="class-form"
        submitLabel={isEditing ? t('ui.saveChanges') : t('pageBody.classes.createSubmit')}
        submitting={submitting}
        error={error}
      >
        <FormSection title={t('ui.classInformation')}>
          <div>
            <label className="label">{t('ui.class')} *</label>
            <input
              className="input"
              required
              placeholder={t('pageBody.classes.namePlaceholder')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('ui.homeroomTeacher')}</label>
            <select className="input" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">{t('ui.none')}</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('ui.grade')} *</label>
            <input
              className="input"
              required
              placeholder={t('pageBody.classes.gradePlaceholder')}
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="label">{t('ui.section')} *</label>
            <input
              className="input"
              required
              placeholder={t('pageBody.classes.sectionPlaceholder')}
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })}
            />
          </div>
        </FormSection>
      </FormModeModal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.length === 0 ? (
          <div className="col-span-full empty-state py-16 card">
            <p className="text-gray-600 font-medium">
              {isTeacher ? t('pageBody.classes.emptyTeacher') : t('pageBody.classes.emptyStaff')}
            </p>
            {!isTeacher && (
              <button onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t('pageBody.classes.addFirst')}
              </button>
            )}
          </div>
        ) : (
          classes.map((cls) => {
            const isActive = editingId === cls.id;
            return (
              <div
                key={cls.id}
                className={`card transition-all ${isActive ? 'ring-2 ring-amber-200 border-amber-200 bg-amber-50/30' : 'hover:border-brand-200'}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{cls.name}</h3>
                      {isActive && (
                        <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                          {t('ui.editing')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{t('pageBody.classes.gradeSection', { grade: cls.grade, section: cls.section })}</p>
                  </div>
                  {!isTeacher && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => (isActive ? closeForm() : openEdit(cls))}
                        className={`p-2 rounded-lg transition-colors ${isActive ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:text-brand-600 hover:bg-brand-50'}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cls.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('ui.classTeacher')}</span>
                    <span>{cls.teacher?.name || t('ui.notAssigned')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('ui.students')}</span>
                    <span className="text-brand-600 font-medium">{cls._count?.students || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('ui.subjects')}</span>
                    <span>{cls._count?.subjects || 0}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
