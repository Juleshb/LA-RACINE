import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User, Mail, Shield, KeyRound, Save, GraduationCap, Users, BookOpen, Building2, Calendar,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';
import FormSection from '../components/form/FormSection';
import LanguageSwitcher from '../components/LanguageSwitcher';
import StudentProfileView from '../components/student/StudentProfileView';
import { useStudentPhotoUrl } from '../hooks/useStudentPhotoUrl';
import { ROLE_LABELS } from '../config/permissions';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value || '—'}</span>
    </div>
  );
}

export default function Profile() {
  const { user, roleLabel, refreshUser, campuses, defaultCampusId } = useAuth();
  const { t } = useTranslation();
  const campusId = user?.campusId || defaultCampusId || localStorage.getItem('campusId');
  const campus = user?.campus || campuses?.find((c) => c.id === campusId);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const studentPhotoUrl = useStudentPhotoUrl(user?.role === 'STUDENT');

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await api.getMe();
      setProfile(data.user);
      setForm({
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        phone: data.user.parent?.phone || '',
      });
    } catch (err) {
      setProfileError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setProfileMessage('');
    setProfileError('');
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      };
      if (user?.role === 'PARENT') {
        payload.phone = form.phone.trim();
      }
      const data = await api.updateMe(payload);
      setProfile(data.user);
      await refreshUser();
      setProfileMessage('Profile updated successfully.');
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordError('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setPasswordSaving(true);
    try {
      const result = await api.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
      );
      setPasswordMessage(result.message || 'Password updated successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const displayRole = roleLabel || ROLE_LABELS[user?.role] || user?.role;
  const campusName = campus?.name || user?.campus?.name || 'All campuses';
  const initials = `${(form.firstName?.[0] || '').toUpperCase()}${(form.lastName?.[0] || '').toUpperCase()}`;

  if (user?.role === 'STUDENT') {
    return (
      <StudentProfileView
        profile={profile}
        campusName={campusName}
        form={form}
        setForm={setForm}
        saving={saving}
        profileMessage={profileMessage}
        profileError={profileError}
        onSave={handleSaveProfile}
        passwordForm={passwordForm}
        setPasswordForm={setPasswordForm}
        passwordSaving={passwordSaving}
        passwordMessage={passwordMessage}
        passwordError={passwordError}
        onChangePassword={handleChangePassword}
        campusId={campusId}
        photoUrl={studentPhotoUrl}
      />
    );
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t('app.profileTitle')}
        description={t('app.profileDescription')}
      />

      <div className="card mb-6 p-6 bg-gradient-to-br from-brand-50 via-white to-sky-50 border-brand-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-xl font-bold shadow-sm">
            {initials || <User className="w-7 h-7" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900">
              {profile?.firstName} {profile?.lastName}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">{profile?.email}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="role-badge">{displayRole}</span>
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600">
                <Building2 className="w-3 h-3" />
                {campusName}
              </span>
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600">
                <Calendar className="w-3 h-3" />
                {t('ui.memberSince', { date: formatDate(profile?.createdAt) })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSaveProfile} className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-gray-900">{t('ui.personalInfo')}</h2>
          </div>

          {profileMessage && (
            <div className="mb-4 p-3 rounded-lg text-sm bg-brand-50 text-brand-700 border border-brand-100">
              {profileMessage}
            </div>
          )}
          {profileError && (
            <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-100">
              {profileError}
            </div>
          )}

          <FormSection title={t('ui.displayName')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('ui.firstName')}</label>
                <input
                  className="input"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t('ui.lastName')}</label>
                <input
                  className="input"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title={t('ui.account')}>
            <div>
              <label className="label flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                {t('ui.email')}
              </label>
              <input className="input bg-gray-50 text-gray-600" value={profile?.email || ''} readOnly />
              <p className="field-hint mt-1">{t('ui.emailReadonlyHint')}</p>
            </div>
            {user?.role === 'PARENT' && (
              <div>
                <label className="label">{t('ui.phone')}</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0788 000 000"
                />
              </div>
            )}
          </FormSection>

          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 mt-2">
            <Save className="w-4 h-4" />
            {saving ? t('ui.saving') : t('ui.saveChanges')}
          </button>
        </form>

        <form onSubmit={handleChangePassword} className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <KeyRound className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-gray-900">{t('ui.security')}</h2>
          </div>

          {passwordMessage && (
            <div className="mb-4 p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-100">
              {passwordMessage}
            </div>
          )}
          {passwordError && (
            <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-100">
              {passwordError}
            </div>
          )}

          <FormSection title={t('ui.changePassword')}>
            <div>
              <label className="label">{t('ui.currentPassword')}</label>
              <input
                className="input"
                type="password"
                required
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t('ui.newPassword')}</label>
              <input
                className="input"
                type="password"
                required
                minLength={6}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t('ui.confirmPassword')}</label>
              <input
                className="input"
                type="password"
                required
                minLength={6}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              />
            </div>
          </FormSection>

          <button type="submit" disabled={passwordSaving} className="btn-secondary flex items-center gap-2 mt-2">
            <Shield className="w-4 h-4" />
            {passwordSaving ? t('ui.updating') : t('ui.updatePassword')}
          </button>
        </form>
      </div>

      <div className="card p-6 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold text-gray-900">{t('app.languagePreference')}</h2>
        </div>
        <LanguageSwitcher variant="panel" tone="app" />
      </div>

      <div className="card p-6 mt-6">
        <div className="flex items-center gap-2 mb-5">
          <BookOpen className="w-5 h-5 text-brand-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('ui.schoolLinked')}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {t('ui.schoolLinkedHint')}
        </p>

        {user?.role === 'TEACHER' && profile?.teacher && (
          <div className="space-y-1">
            <InfoRow label="Teacher profile" value={profile.teacher.name} />
            <InfoRow label="Main subject" value={profile.teacher.subject} />
            <InfoRow label="Staff email" value={profile.teacher.email} />
            <InfoRow label="Staff phone" value={profile.teacher.phone} />
          </div>
        )}

        {user?.role === 'STUDENT' && profile?.student && (
          <div className="space-y-1">
            <InfoRow label="Student ID" value={profile.student.studentId} />
            <InfoRow
              label="Class"
              value={profile.student.class
                ? `${profile.student.class.name} (${profile.student.class.grade} · ${profile.student.class.section})`
                : 'Not assigned'}
            />
            <InfoRow label="Campus" value={campusName} />
          </div>
        )}

        {user?.role === 'PARENT' && profile?.parent && (
          <div>
            <div className="space-y-1 mb-4">
              <InfoRow label="Parent phone" value={profile.parent.phone} />
              <InfoRow label="Registered children" value={profile.parent.students?.length || 0} />
            </div>
            {profile.parent.students?.length > 0 && (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Children
                </div>
                <ul className="divide-y divide-gray-100">
                  {profile.parent.students.map((child) => (
                    <li key={child.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {child.firstName} {child.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{child.studentId}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        {child.class?.name || 'No class'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {user?.role === 'SCHOOL_MANAGER' && (
          <div className="space-y-1">
            <InfoRow label="Access level" value="All campuses" />
            <InfoRow label="Account type" value="School manager" />
            {campusId && (
              <p className="text-sm text-gray-500 pt-2">
                <Link to="/campuses" className="text-brand-600 hover:underline">Manage campuses</Link>
                {' · '}
                <Link to={`/campus/${campusId}/users`} className="text-brand-600 hover:underline">User accounts</Link>
              </p>
            )}
          </div>
        )}

        {!['TEACHER', 'STUDENT', 'PARENT', 'SCHOOL_MANAGER'].includes(user?.role) && (
          <div className="space-y-1">
            <InfoRow label="Role" value={displayRole} />
            <InfoRow label="Campus" value={campusName} />
            <InfoRow label="Account status" value={profile?.isActive ? 'Active' : 'Inactive'} />
          </div>
        )}
      </div>

      {user?.role === 'PARENT' && campusId && (
        <div className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600 flex items-start gap-3">
          <Users className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-gray-900">Family portal</p>
            <p className="mt-1">
              View registrations and children from the{' '}
              <Link to={`/campus/${campusId}/my-registrations`} className="text-brand-600 hover:underline">
                My registrations
              </Link>
              {' '}page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
