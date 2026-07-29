import { useEffect, useState } from 'react';
import { Plus, Trash2, UserCheck, UserX, KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import { ROLE_LABELS } from '../config/permissions';
import PageHeader from '../components/PageHeader';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { useTranslation } from '../context/LanguageContext';

const EMPTY_FORM = {
  email: '', password: '', firstName: '', lastName: '', role: 'TEACHER',
  teacherId: '', studentId: '', parentId: '',
};

export default function Users() {
  const { campusId, campus } = useCampus();
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = () => api.getUsers(campusId).then(setUsers).catch(console.error);

  useEffect(() => {
    if (!campusId) return;
    loadUsers();
    api.getTeachers().then(setTeachers).catch(console.error);
    api.getStudents().then(setStudents).catch(console.error);
    api.getParents(campusId).then(setParents).catch(console.error);
  }, [campusId]);

  const closeCreate = () => {
    setShowForm(false);
    setForm({ ...EMPTY_FORM });
    setError('');
    setSubmitting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.createUser({
        ...form,
        campusId: form.role === 'SCHOOL_MANAGER' ? null : campusId,
        teacherId: form.teacherId || null,
        studentId: form.studentId || null,
        parentId: form.parentId || null,
      });
      closeCreate();
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const closeReset = () => {
    setResetUserId(null);
    setNewPassword('');
    setError('');
    setSubmitting(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.resetUserPassword(resetUserId, newPassword);
      closeReset();
      alert(t('pageBody.users.passwordUpdated'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id, isActive) => {
    try {
      await api.toggleUserStatus(id, !isActive);
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('pageBody.users.deleteConfirm'))) return;
    try {
      await api.deleteUser(id);
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('pages.users.title')}
        description={t('pages.users.description', { campus: campus?.name || t('ui.thisCampus') })}
        action={(
          <button onClick={() => { setShowForm(true); setError(''); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('pages.users.newUser')}
          </button>
        )}
      />

      <FormModeModal
        open={showForm}
        mode="create"
        title={t('pages.users.newUserTitle')}
        subtitle={t('pages.users.newUserSubtitle')}
        onClose={closeCreate}
        onSubmit={handleSubmit}
        formId="user-form"
        submitLabel={t('ui.createUser')}
        submitting={submitting}
        error={error}
        size="lg"
      >
        <FormSection title={t('ui.accountDetails')}>
          <div>
            <label className="label">{t('ui.firstName')} *</label>
            <input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('ui.lastName')} *</label>
            <input className="input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('ui.email')} *</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('ui.password')} *</label>
            <input className="input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('ui.role')} *</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {form.role === 'TEACHER' && (
            <div className="form-field-full md:col-span-2">
              <label className="label">{t('ui.linkTeacherProfile')}</label>
              <select className="input" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
                <option value="">{t('ui.none')}</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
            </div>
          )}
          {form.role === 'STUDENT' && (
            <div className="form-field-full md:col-span-2">
              <label className="label">{t('ui.linkStudentRecord')}</label>
              <select className="input" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                <option value="">{t('ui.none')}</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.studentId} — {s.firstName} {s.lastName}</option>)}
              </select>
            </div>
          )}
          {form.role === 'PARENT' && (
            <>
              <div className="form-field-full md:col-span-2 rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-sm text-brand-900">
                <p className="font-semibold mb-1">When to create a parent account</p>
                <ul className="list-disc list-inside space-y-1 text-brand-800">
                  <li>Parent <strong>record</strong> — created automatically at student registration (from guardian phone)</li>
                  <li>Parent <strong>login</strong> — create here after enrollment is approved</li>
                  <li>Link the login to the matching parent record so the family sees their children on the parent dashboard</li>
                </ul>
              </div>
              <div className="form-field-full md:col-span-2">
                <label className="label">{t('ui.selectParentRecord')} *</label>
                <select className="input" required value={form.parentId || ''} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                  <option value="">{t('ui.selectParentRecord')}</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id} disabled={Boolean(p.user)}>
                      {p.phone || p.id.slice(0, 8)} — {p.students.map((s) => s.firstName).join(', ') || 'No children'}
                      {p.user ? ` (login: ${p.user.email})` : ' — no login yet'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Parents without a login cannot access Communication, fees, marks, or the parent dashboard.
                </p>
              </div>
            </>
          )}
        </FormSection>
      </FormModeModal>

      <FormModeModal
        open={Boolean(resetUserId)}
        mode="edit"
        title={t('pages.users.resetTitle')}
        subtitle={t('pages.users.resetSubtitle')}
        onClose={closeReset}
        onSubmit={handleResetPassword}
        formId="reset-password-form"
        submitLabel={t('ui.updatePassword')}
        submitting={submitting}
        error={error}
        size="md"
      >
        <div>
          <label className="label">{t('ui.newPassword')} *</label>
          <input
            className="input"
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
      </FormModeModal>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="pb-3 font-medium">{t('ui.name')}</th>
                <th className="pb-3 font-medium">{t('ui.email')}</th>
                <th className="pb-3 font-medium">{t('ui.role')}</th>
                <th className="pb-3 font-medium">{t('ui.status')}</th>
                <th className="pb-3 font-medium">{t('ui.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 font-medium">{u.firstName} {u.lastName}</td>
                  <td className="py-3 text-gray-400">{u.email}</td>
                  <td className="py-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-600">
                      {ROLE_LABELS[u.role]}
                    </span>
                    {u.role === 'PARENT' && u.parent && (
                      <p className="text-[10px] text-gray-400 mt-1">{u.parent.phone || t('ui.parentRecord')}</p>
                    )}
                  </td>
                  <td className="py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.isActive ? 'bg-brand-50 text-brand-600' : 'bg-red-600/20 text-red-400'}`}>
                      {u.isActive ? t('ui.active') : t('ui.inactive')}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setResetUserId(u.id); setError(''); }} className="p-1.5 text-gray-400 hover:text-brand-600" title={t('ui.resetPassword')}>
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleStatus(u.id, u.isActive)} className="p-1.5 text-gray-400 hover:text-brand-600" title={u.isActive ? t('ui.deactivate') : t('ui.activate')}>
                        {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDelete(u.id)} className="p-1.5 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
