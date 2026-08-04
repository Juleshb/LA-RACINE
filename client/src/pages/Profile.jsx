import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User, Mail, Shield, KeyRound, Save, GraduationCap, Users, BookOpen, Building2,
  Calendar, Phone, Eye, EyeOff, CheckCircle2, Languages, Link2,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import StudentProfileView from '../components/student/StudentProfileView';
import { useStudentPhotoUrl } from '../hooks/useStudentPhotoUrl';
import { ROLE_LABELS } from '../config/permissions';
import { PASSWORD_POLICY_HINT, passwordStrengthLabel, validateStrongPassword } from '../lib/passwordPolicy';

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
    <div className="profile-info-row">
      <span className="profile-info-label">{label}</span>
      <span className="profile-info-value">{value || '—'}</span>
    </div>
  );
}

const SECTIONS = [
  { id: 'account', icon: User },
  { id: 'security', icon: KeyRound },
  { id: 'language', icon: Languages },
  { id: 'linked', icon: Link2 },
];

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
  const [section, setSection] = useState('account');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  const needsPhone = user?.role && user.role !== 'STUDENT';

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await api.getMe();
      setProfile(data.user);
      setForm({
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        phone: data.user.phone || data.user.parent?.phone || '',
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

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
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
      if (needsPhone) {
        payload.phone = form.phone.trim();
      }
      const data = await api.updateMe(payload);
      setProfile(data.user);
      await refreshUser();
      setProfileMessage(t('ui.profileUpdated'));
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
      setPasswordError(t('ui.passwordsDoNotMatch'));
      return;
    }
    const strength = validateStrongPassword(passwordForm.newPassword);
    if (!strength.ok) {
      setPasswordError(strength.error);
      return;
    }
    setPasswordSaving(true);
    try {
      const result = await api.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
        passwordForm.confirmPassword,
      );
      setPasswordMessage(result.message || t('ui.passwordUpdated'));
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const passwordStrength = passwordStrengthLabel(passwordForm.newPassword);
  const passwordsMatch = !passwordForm.confirmPassword
    || passwordForm.newPassword === passwordForm.confirmPassword;

  const displayRole = roleLabel || ROLE_LABELS[user?.role] || user?.role;
  const isSchoolManager = user?.role === 'SCHOOL_MANAGER' || user?.role === 'SCHOOL_ADMIN';
  const campusName = isSchoolManager
    ? t('ui.allCampuses')
    : (campus?.name || user?.campus?.name || t('ui.allCampuses'));
  const initials = `${(form.firstName?.[0] || profile?.firstName?.[0] || '').toUpperCase()}${(form.lastName?.[0] || profile?.lastName?.[0] || '').toUpperCase()}`;

  const dirtyAccount = useMemo(() => {
    if (!profile) return false;
    const phoneNow = profile.phone || profile.parent?.phone || '';
    return (
      form.firstName !== (profile.firstName || '')
      || form.lastName !== (profile.lastName || '')
      || (needsPhone && form.phone !== phoneNow)
    );
  }, [form, profile, needsPhone]);

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="profile-loading-spinner" />
      </div>
    );
  }

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
    <div className={`profile-page ${mounted ? 'profile-page-ready' : ''}`}>
      <section className="profile-hero">
        <div className="profile-hero-glow" />
        <div className="profile-hero-inner">
          <div className="profile-avatar" aria-hidden>
            {initials || <User className="w-8 h-8" />}
          </div>
          <div className="profile-hero-copy">
            <p className="profile-hero-kicker">{t('app.profileTitle')}</p>
            <h1 className="profile-hero-name">
              {profile?.firstName} {profile?.lastName}
            </h1>
            <p className="profile-hero-email">
              <Mail className="w-3.5 h-3.5" aria-hidden />
              {profile?.email}
            </p>
            <p className="profile-hero-meta">
              <span>{displayRole}</span>
              {!isSchoolManager && (
                <>
                  <span className="profile-hero-dot" aria-hidden />
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" aria-hidden />
                    {campusName}
                  </span>
                </>
              )}
              <span className="profile-hero-dot" aria-hidden />
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" aria-hidden />
                {t('ui.memberSince', { date: formatDate(profile?.createdAt) })}
              </span>
            </p>
          </div>
        </div>
      </section>

      <nav className="profile-tabs" aria-label={t('app.profileTitle')}>
        {SECTIONS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`profile-tab ${section === id ? 'profile-tab-active' : ''}`}
            onClick={() => setSection(id)}
            aria-selected={section === id}
          >
            <Icon className="w-4 h-4" aria-hidden />
            {t(`ui.profileSection.${id}`)}
          </button>
        ))}
      </nav>

      <div className="profile-panel" key={section}>
        {section === 'account' && (
          <form onSubmit={handleSaveProfile} className="profile-section">
            <header className="profile-section-header">
              <h2>{t('ui.personalInfo')}</h2>
              <p>{t('ui.profileAccountHint')}</p>
            </header>

            {profileMessage && (
              <div className="profile-alert profile-alert-success" role="status">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
                {profileMessage}
              </div>
            )}
            {profileError && (
              <div className="profile-alert profile-alert-error" role="alert">
                {profileError}
              </div>
            )}

            <div className="profile-fields">
              <div className="profile-field-grid">
                <div>
                  <label className="label" htmlFor="profile-first">{t('ui.firstName')}</label>
                  <input
                    id="profile-first"
                    className="input"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="profile-last">{t('ui.lastName')}</label>
                  <input
                    id="profile-last"
                    className="input"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="profile-email">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" aria-hidden />
                    {t('ui.email')}
                  </span>
                </label>
                <input id="profile-email" className="input bg-gray-50 text-gray-600" value={profile?.email || ''} readOnly />
                <p className="field-hint mt-1">{t('ui.emailReadonlyHint')}</p>
              </div>

              {needsPhone && (
                <div>
                  <label className="label" htmlFor="profile-phone">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-400" aria-hidden />
                      {t('ui.phone')} *
                    </span>
                  </label>
                  <input
                    id="profile-phone"
                    className="input"
                    type="tel"
                    required
                    minLength={8}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="078XXXXXXX"
                  />
                </div>
              )}
            </div>

            <div className="profile-actions">
              <button type="submit" disabled={saving || !dirtyAccount} className="btn-primary inline-flex items-center gap-2">
                <Save className="w-4 h-4" aria-hidden />
                {saving ? t('ui.saving') : t('ui.saveChanges')}
              </button>
              {dirtyAccount && !saving && (
                <span className="profile-unsaved">{t('ui.unsavedChanges')}</span>
              )}
            </div>
          </form>
        )}

        {section === 'security' && (
          <form onSubmit={handleChangePassword} className="profile-section">
            <header className="profile-section-header">
              <h2>{t('ui.security')}</h2>
              <p>{t('ui.profileSecurityHint')}</p>
            </header>

            {passwordMessage && (
              <div className="profile-alert profile-alert-success" role="status">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
                {passwordMessage}
              </div>
            )}
            {passwordError && (
              <div className="profile-alert profile-alert-error" role="alert">
                {passwordError}
              </div>
            )}

            <div className="profile-fields">
              <div>
                <label className="label" htmlFor="profile-current">{t('ui.currentPassword')}</label>
                <div className="profile-password-wrap">
                  <input
                    id="profile-current"
                    className="input"
                    type={showCurrent ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  />
                  <button type="button" className="profile-eye" onClick={() => setShowCurrent((v) => !v)} aria-label={showCurrent ? 'Hide' : 'Show'}>
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="profile-new">{t('ui.newPassword')}</label>
                <div className="profile-password-wrap">
                  <input
                    id="profile-new"
                    className="input"
                    type={showNew ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  />
                  <button type="button" className="profile-eye" onClick={() => setShowNew((v) => !v)} aria-label={showNew ? 'Hide' : 'Show'}>
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordForm.newPassword && (
                  <div className="profile-strength">
                    <div className="profile-strength-bars" aria-hidden>
                      <span className={passwordStrength.level >= 1 ? 'on' : ''} />
                      <span className={passwordStrength.level >= 2 ? 'on' : ''} />
                      <span className={passwordStrength.level >= 3 ? 'on' : ''} />
                    </div>
                    <span className={`profile-strength-label level-${passwordStrength.level}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">{PASSWORD_POLICY_HINT}</p>
              </div>

              <div>
                <label className="label" htmlFor="profile-confirm">{t('ui.confirmPassword')}</label>
                <div className="profile-password-wrap">
                  <input
                    id="profile-confirm"
                    className="input"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  />
                  <button type="button" className="profile-eye" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? 'Hide' : 'Show'}>
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordForm.confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-red-600 mt-1">{t('ui.passwordsDoNotMatch')}</p>
                )}
              </div>
            </div>

            <div className="profile-actions">
              <button type="submit" disabled={passwordSaving || !passwordsMatch} className="btn-primary inline-flex items-center gap-2">
                <Shield className="w-4 h-4" aria-hidden />
                {passwordSaving ? t('ui.updating') : t('ui.updatePassword')}
              </button>
            </div>
          </form>
        )}

        {section === 'language' && (
          <div className="profile-section">
            <header className="profile-section-header">
              <h2>{t('app.languagePreference')}</h2>
              <p>{t('ui.profileLanguageHint')}</p>
            </header>
            <LanguageSwitcher variant="panel" tone="app" />
          </div>
        )}

        {section === 'linked' && (
          <div className="profile-section">
            <header className="profile-section-header">
              <h2>{t('ui.schoolLinked')}</h2>
              <p>{t('ui.schoolLinkedHint')}</p>
            </header>

            {user?.role === 'TEACHER' && profile?.teacher && (
              <div className="profile-linked-block">
                <InfoRow label={t('ui.teacherProfile')} value={profile.teacher.name} />
                <InfoRow label={t('ui.mainSubject')} value={profile.teacher.subject} />
                <InfoRow label={t('ui.staffEmail')} value={profile.teacher.email} />
                <InfoRow label={t('ui.staffPhone')} value={profile.teacher.phone || profile.phone} />
              </div>
            )}

            {user?.role === 'PARENT' && profile?.parent && (
              <div className="space-y-4">
                <div className="profile-linked-block">
                  <InfoRow label={t('ui.phone')} value={profile.phone || profile.parent.phone} />
                  <InfoRow label={t('ui.registeredChildren')} value={profile.parent.students?.length || 0} />
                </div>
                {profile.parent.students?.length > 0 && (
                  <ul className="profile-children">
                    {profile.parent.students.map((child) => (
                      <li key={child.id} className="profile-child">
                        <div className="profile-child-avatar" aria-hidden>
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="profile-child-name">{child.firstName} {child.lastName}</p>
                          <p className="profile-child-meta">{child.studentId}</p>
                        </div>
                        <span className="profile-child-class">{child.class?.name || t('ui.noClass')}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {campusId && (
                  <Link to={`/campus/${campusId}/my-registrations`} className="profile-family-link">
                    <Users className="w-4 h-4" aria-hidden />
                    {t('ui.openFamilyPortal')}
                  </Link>
                )}
              </div>
            )}

            {isSchoolManager && (
              <div className="profile-linked-block">
                <InfoRow label={t('ui.accessLevel')} value={t('ui.allCampuses')} />
                <InfoRow label={t('ui.accountType')} value={displayRole} />
                <div className="profile-quick-links">
                  <Link to="/campuses">{t('ui.manageCampuses')}</Link>
                  {campusId && <Link to={`/campus/${campusId}/users`}>{t('ui.userAccounts')}</Link>}
                </div>
              </div>
            )}

            {!['TEACHER', 'PARENT', 'SCHOOL_MANAGER', 'SCHOOL_ADMIN'].includes(user?.role) && (
              <div className="profile-linked-block">
                <InfoRow label={t('ui.role')} value={displayRole} />
                <InfoRow label={t('ui.campus')} value={campusName} />
                <InfoRow label={t('ui.status')} value={profile?.isActive ? t('ui.active') : t('ui.inactive')} />
                {profile?.phone && <InfoRow label={t('ui.phone')} value={profile.phone} />}
              </div>
            )}

            {!profile?.teacher && !profile?.parent && !isSchoolManager && ['TEACHER', 'PARENT'].includes(user?.role) && (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <BookOpen className="w-4 h-4" aria-hidden />
                {t('ui.noLinkedRecord')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
