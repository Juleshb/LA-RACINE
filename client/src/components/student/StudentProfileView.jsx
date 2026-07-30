import { Link } from 'react-router-dom';
import { GraduationCap, Building2, Calendar, User, Mail } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import AppIcon from '../icons/AppIcon';
import StudentAvatar from './StudentAvatar';

function formatDate(value, locale = 'en-GB') {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function StudentProfileView({
  profile,
  campusName,
  form,
  setForm,
  saving,
  profileMessage,
  profileError,
  onSave,
  passwordForm,
  setPasswordForm,
  passwordSaving,
  passwordMessage,
  passwordError,
  onChangePassword,
  campusId,
  photoUrl,
}) {
  const { t } = useTranslation();
  const student = profile?.student;
  const classLabel = student?.class
    ? `${student.class.name} (${student.class.grade} · ${student.class.section})`
    : t('profile.notAssigned');

  return (
    <div className="student-profile-page max-w-3xl mx-auto space-y-5">
      <div className="student-profile-hero">
        <StudentAvatar
          photoUrl={photoUrl}
          firstName={profile?.firstName}
          lastName={profile?.lastName}
          variant="profileHero"
        />
        <div className="min-w-0 flex-1">
          <p className="student-profile-hero-kicker">
            <AppIcon name="star" className="w-4 h-4" />
            {t('profile.myProfile')}
          </p>
          <h1 className="student-profile-hero-name">{profile?.firstName}</h1>
          <p className="student-profile-hero-email">{profile?.email}</p>
          {student?.class?.name && (
            <p className="student-profile-hero-class">
              <GraduationCap className="w-4 h-4 shrink-0" />
              {student.class.name}
            </p>
          )}
        </div>
      </div>

      <section className="student-profile-card">
        <h2 className="student-profile-card-title">{t('profile.languagePreference')}</h2>
        <p className="student-profile-card-hint">{t('profile.languageHint')}</p>
        <LanguageSwitcher variant="panel" />
      </section>

      <section className="student-profile-card">
        <h2 className="student-profile-card-title">{t('profile.schoolInfo')}</h2>
        <div className="student-profile-info-grid">
          <div className="student-profile-info-item">
            <span className="student-profile-info-label">{t('profile.studentId')}</span>
            <span className="student-profile-info-value">{student?.studentId || '—'}</span>
          </div>
          <div className="student-profile-info-item">
            <span className="student-profile-info-label">{t('profile.myClass')}</span>
            <span className="student-profile-info-value">{classLabel}</span>
          </div>
          <div className="student-profile-info-item">
            <span className="student-profile-info-label flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              Campus
            </span>
            <span className="student-profile-info-value">{campusName}</span>
          </div>
          <div className="student-profile-info-item">
            <span className="student-profile-info-label flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {t('profile.memberSince')}
            </span>
            <span className="student-profile-info-value">{formatDate(profile?.createdAt)}</span>
          </div>
        </div>
      </section>

      <form onSubmit={onSave} className="student-profile-card">
        <h2 className="student-profile-card-title flex items-center gap-2">
          <User className="w-5 h-5 text-violet-600" />
          {t('profile.personalInfo')}
        </h2>

        {profileMessage && (
          <div className="student-profile-alert student-profile-alert-success">{profileMessage}</div>
        )}
        {profileError && (
          <div className="student-profile-alert student-profile-alert-error">{profileError}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="student-profile-label">First name</label>
            <input
              className="student-profile-input"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div>
            <label className="student-profile-label">Last name</label>
            <input
              className="student-profile-input"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="student-profile-label flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            Email
          </label>
          <input className="student-profile-input student-profile-input-readonly" value={profile?.email || ''} readOnly />
        </div>

        <button type="submit" disabled={saving} className="student-profile-btn mt-4">
          {saving ? '…' : t('profile.saveChanges')}
        </button>
      </form>

      <form onSubmit={onChangePassword} className="student-profile-card">
        <h2 className="student-profile-card-title">{t('profile.security')}</h2>

        {passwordMessage && (
          <div className="student-profile-alert student-profile-alert-success">{passwordMessage}</div>
        )}
        {passwordError && (
          <div className="student-profile-alert student-profile-alert-error">{passwordError}</div>
        )}

        <div className="space-y-3 mt-4">
          <div>
            <label className="student-profile-label">Current password</label>
            <input
              className="student-profile-input"
              type="password"
              required
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            />
          </div>
          <div>
            <label className="student-profile-label">New password</label>
            <input
              className="student-profile-input"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">At least 8 characters with uppercase, lowercase, a number, and a special character.</p>
          </div>
          <div>
            <label className="student-profile-label">Confirm password</label>
            <input
              className="student-profile-input"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
          </div>
        </div>

        <button type="submit" disabled={passwordSaving} className="student-profile-btn student-profile-btn-secondary mt-4">
          {passwordSaving ? '…' : t('profile.security')}
        </button>
      </form>

      <Link to={`/campus/${campusId}`} className="student-profile-back">
        ← {t('common.backHome')}
      </Link>
    </div>
  );
}
