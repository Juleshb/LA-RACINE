import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { ROLE_LABELS, getLoginRedirect } from '../config/permissions';
import { setActiveCampus, api } from '../lib/api';
import Logo, { MottoBanner } from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';

const demoAccounts = [
  { email: 'manager@laracineschool.rw', role: 'SCHOOL_MANAGER' },
  { email: 'head.studies@laracineschool.rw', role: 'HEAD_OF_STUDIES' },
  { email: 'head.discipline@laracineschool.rw', role: 'HEAD_OF_DISCIPLINE' },
  { email: 'secretary@laracineschool.rw', role: 'SECRETARY' },
  { email: 'accountant@laracineschool.rw', role: 'ACCOUNTANT' },
  { email: 'librarian@laracineschool.rw', role: 'LIBRARIAN' },
  { email: 'teacher@laracineschool.rw', role: 'TEACHER' },
  { email: 'parent@laracineschool.rw', role: 'PARENT' },
  { email: 'student@laracineschool.rw', role: 'STUDENT' },
];

export default function Login() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.defaultCampusId) setActiveCampus(data.defaultCampusId);
      navigate(getLoginRedirect(data.user, data.defaultCampusId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotMessage('');
    setResetToken('');
    try {
      const result = await api.forgotPassword(forgotEmail);
      setForgotMessage(result.message);
      if (result.resetToken) {
        setResetToken(result.resetToken);
      }
    } catch (err) {
      setForgotMessage(err.message);
    }
  };

  const quickLogin = (accountEmail) => {
    setEmail(accountEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 bg-white border-r border-gray-200">
        <Logo size="xl" showMotto />
        <p className="text-center text-gray-500 mt-8 max-w-sm leading-relaxed">
          {t('app.login.tagline')}
        </p>
        <div className="mt-10 grid grid-cols-2 gap-2 w-full max-w-sm">
          {Object.values(ROLE_LABELS).map((label) => (
            <div key={label} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center text-gray-600">
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size="lg" showMotto />
          </div>

          <div className="mb-4 flex items-center justify-between gap-3">
            <Link to="/" className="text-sm text-brand-700 hover:underline">{t('app.login.backWebsite')}</Link>
            <LanguageSwitcher tone="app" />
          </div>

          <div className="card">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">{t('app.login.signIn')}</h2>
            <p className="text-gray-500 mb-6 text-sm">{t('app.login.accessAccount')}</p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            {!showForgot ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">{t('app.login.email')}</label>
                  <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@laracineschool.rw" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">{t('app.login.password')}</label>
                    <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-brand-600 hover:underline">
                      {t('app.login.forgot')}
                    </button>
                  </div>
                  <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                  <LogIn className="w-4 h-4" />
                  {loading ? t('app.login.signingIn') : t('app.login.signInBtn')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-sm text-gray-500">{t('app.login.forgotHint')}</p>
                <div>
                  <label className="label">{t('app.login.email')}</label>
                  <input className="input" type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                </div>
                {forgotMessage && (
                  <div className="p-3 bg-brand-50 border border-brand-200 text-brand-700 rounded-lg text-sm">
                    {forgotMessage}
                    {resetToken && (
                      <p className="mt-2">
                        <Link to={`/reset-password?token=${resetToken}`} className="underline font-medium">
                          {t('app.login.resetLink')}
                        </Link>
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary flex-1">{t('app.login.sendReset')}</button>
                  <button type="button" onClick={() => setShowForgot(false)} className="btn-secondary">{t('app.login.back')}</button>
                </div>
              </form>
            )}
          </div>

          <div className="mt-6">
            <MottoBanner className="mb-4" />
            <p className="text-xs text-gray-400 mb-3 text-center">
              Demo accounts · password: <span className="text-brand-600 font-medium">password123</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => quickLogin(acc.email)}
                  className="text-left px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-xs hover:border-brand-400 hover:bg-brand-50 transition-colors"
                >
                  <span className="text-brand-700 block font-medium">{ROLE_LABELS[acc.role]}</span>
                  <span className="text-gray-400 truncate block mt-0.5">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
