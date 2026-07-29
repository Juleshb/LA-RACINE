import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';

const EMPTY_FORM = { name: '', email: '', phone: '', subject: '' };

export default function Teachers() {
  const { t } = useTranslation();
  const [teachers, setTeachers] = useState([]);
  const [formMode, setFormMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEditing = formMode === 'edit';

  const loadTeachers = () => api.getTeachers().then(setTeachers).catch(console.error);

  useEffect(() => { loadTeachers(); }, []);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormMode('create');
    setError('');
  };

  const openEdit = (teacher) => {
    setForm({
      name: teacher.name,
      email: teacher.email || '',
      phone: teacher.phone || '',
      subject: teacher.subject || '',
    });
    setEditingId(teacher.id);
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
    try {
      if (isEditing) {
        await api.updateTeacher(editingId, form);
      } else {
        await api.createTeacher(form);
      }
      closeForm();
      loadTeachers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('pageBody.teachers.deleteConfirm'))) return;
    try {
      await api.deleteTeacher(id);
      if (editingId === id) closeForm();
      loadTeachers();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('pages.teachers.title')}
        description={t('pages.teachers.description')}
        action={(
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('pages.teachers.add')}
          </button>
        )}
      />

      <FormModeModal
        open={Boolean(formMode)}
        mode={isEditing ? 'edit' : 'create'}
        title={isEditing ? t('pageBody.teachers.editTitle') : t('pageBody.teachers.newTitle')}
        subtitle={isEditing ? t('pageBody.teachers.editSubtitle') : t('pageBody.teachers.newSubtitle')}
        onClose={closeForm}
        onSubmit={handleSubmit}
        formId="teacher-form"
        submitLabel={isEditing ? t('ui.saveChanges') : t('pageBody.teachers.addSubmit')}
        submitting={submitting}
        error={error}
      >
        <FormSection title={t('ui.personalDetails')}>
          <div>
            <label className="label">{t('ui.fullName')} *</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('ui.subjectSpecialty')}</label>
            <input
              className="input"
              placeholder={t('pageBody.teachers.subjectPlaceholder')}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
        </FormSection>
        <FormSection title={t('ui.contact')}>
          <div>
            <label className="label">{t('ui.email')}</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('ui.phone')}</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </FormSection>
      </FormModeModal>

      <div className="card p-0 overflow-hidden">
        {teachers.length === 0 ? (
          <div className="empty-state py-16">
            <p className="text-gray-600 font-medium">{t('pageBody.teachers.empty')}</p>
            <button onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> {t('pageBody.teachers.addFirst')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th>{t('ui.name')}</th>
                  <th>{t('ui.subject')}</th>
                  <th>{t('ui.email')}</th>
                  <th>{t('ui.phone')}</th>
                  <th>{t('ui.classes')}</th>
                  <th className="text-right">{t('ui.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => {
                  const isActive = editingId === teacher.id;
                  return (
                    <tr key={teacher.id} className={isActive ? 'table-row-active' : ''}>
                      <td className="font-medium text-gray-900">
                        {teacher.name}
                        {isActive && (
                          <span className="ml-2 text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            {t('ui.editing')}
                          </span>
                        )}
                      </td>
                      <td className="text-gray-500">{teacher.subject || '—'}</td>
                      <td className="text-gray-500">{teacher.email || '—'}</td>
                      <td className="text-gray-500">{teacher.phone || '—'}</td>
                      <td>{teacher._count?.classes || 0}</td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => (isActive ? closeForm() : openEdit(teacher))}
                            className={`p-2 rounded-lg transition-colors ${isActive ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:text-brand-600 hover:bg-brand-50'}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(teacher.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
