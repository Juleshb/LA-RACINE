import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { getLoginRedirect } from '../config/permissions';
import { setActiveCampus, api } from '../lib/api';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Login() {
  const { login, verifyLoginOtp } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelKey, setPanelKey] = useState(0);
  const [otpChallengeId, setOtpChallengeId] = useState('');
  const [otpEmailMasked, setOtpEmailMasked] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpInfo, setOtpInfo] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;
    let targetId = 'login-email';
    if (showForgot) targetId = forgotSent ? null : 'forgot-email';
    else if (otpChallengeId) targetId = 'login-otp';
    if (!targetId) return undefined;
    const el = document.getElementById(targetId);
    if (!el) return undefined;
    const timer = window.setTimeout(() => el.focus(), 220);
    return () => window.clearTimeout(timer);
  }, [showForgot, forgotSent, mounted, panelKey, otpChallengeId]);

  const finishLogin = (data) => {
    if (data.user?.mustChangePassword) {
      navigate('/set-new-password', { replace: true });
      return;
    }
    if (data.defaultCampusId) setActiveCampus(data.defaultCampusId);
    navigate(getLoginRedirect(data.user, data.defaultCampusId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOtpInfo('');
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.requiresOtp) {
        setOtpChallengeId(data.challengeId);
        setOtpEmailMasked(data.emailMasked || '');
        setOtpCode('');
        setPanelKey((k) => k + 1);
        return;
      }
      finishLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setOtpInfo('');
    setLoading(true);
    try {
      const data = await verifyLoginOtp(otpChallengeId, otpCode.trim());
      finishLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setOtpInfo('');
    setResendLoading(true);
    try {
      const data = await api.resendLoginOtp(otpChallengeId);
      setOtpChallengeId(data.challengeId);
      setOtpEmailMasked(data.emailMasked || otpEmailMasked);
      setOtpCode('');
      setOtpInfo(data.message || 'A new code was sent.');
    } catch (err) {
      setError(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  const backFromOtp = () => {
    setOtpChallengeId('');
    setOtpCode('');
    setOtpEmailMasked('');
    setOtpInfo('');
    setError('');
    setPanelKey((k) => k + 1);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotMessage('');
    setForgotError(false);
    setForgotLoading(true);
    try {
      const result = await api.forgotPassword(forgotEmail);
      setForgotMessage(result.message);
      setForgotSent(true);
      if (forgotEmail) setEmail(forgotEmail);
    } catch (err) {
      setForgotError(true);
      setForgotSent(false);
      setForgotMessage(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgot = () => {
    setForgotEmail(email);
    setForgotMessage('');
    setForgotError(false);
    setForgotSent(false);
    setShowForgot(true);
    setPanelKey((k) => k + 1);
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotMessage('');
    setForgotError(false);
    setForgotSent(false);
    setPanelKey((k) => k + 1);
  };

  return (
    <div className={`login-page ${mounted ? 'login-page-ready' : ''}`}>
      <section className="login-visual">
        <div className="login-visual-glow login-visual-glow-a" />
        <div className="login-visual-glow login-visual-glow-b" />
        <div className="login-visual-grain" />
        <div className="login-visual-inner">
          <p className="login-motto">{t('app.login.motto')}</p>
          <img src="/logo.png" alt="" className="login-visual-logo" />
          <h1 className="login-brand">École La RACINE</h1>
          <p className="login-tagline">{t('app.login.tagline')}</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel-top">
          <Link to="/" className="login-back-link">
            <ArrowLeft className="w-4 h-4" aria-hidden />
            {t('app.login.backWebsite')}
          </Link>
          <LanguageSwitcher tone="app" />
        </div>

        <div className="login-mobile-brand lg:hidden">
          <img src="/logo.png" alt="École La RACINE" className="login-mobile-logo" />
          <p className="login-brand login-brand-mobile">École La RACINE</p>
        </div>

        <div className="login-form-shell">
          {!showForgot ? (
            otpChallengeId ? (
              <div className="login-form-pane login-form-pane-active" key={`otp-${panelKey}`}>
                <button type="button" className="login-forgot-back" onClick={backFromOtp}>
                  <ArrowLeft className="w-4 h-4" aria-hidden />
                  {t('app.login.back')}
                </button>
                <header className="login-form-header">
                  <h2>Enter verification code</h2>
                  <p>
                    We sent a 6-digit code to{' '}
                    <strong>{otpEmailMasked || 'your email'}</strong>. Enter it to finish signing in.
                  </p>
                </header>

                {error && (
                  <div className="login-alert login-alert-error" role="alert">
                    {error}
                  </div>
                )}
                {otpInfo && !error && (
                  <div className="login-alert" role="status" style={{ background: '#ecfdf5', color: '#065f46' }}>
                    {otpInfo}
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="login-form" noValidate>
                  <div className="login-field">
                    <label htmlFor="login-otp">Verification code</label>
                    <div className="login-input-wrap">
                      <input
                        id="login-otp"
                        className="login-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        required
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading || otpCode.length < 6} className="login-submit">
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                        Verifying…
                      </>
                    ) : (
                      <>
                        Verify and sign in
                        <ArrowRight className="w-4 h-4 login-submit-arrow" aria-hidden />
                      </>
                    )}
                  </button>
                </form>

                <p className="login-forgot-next" style={{ marginTop: '1rem' }}>
                  Didn’t get the code?{' '}
                  <button
                    type="button"
                    className="login-text-btn"
                    onClick={handleResendOtp}
                    disabled={resendLoading}
                  >
                    {resendLoading ? 'Sending…' : 'Resend code'}
                  </button>
                </p>
              </div>
            ) : (
              <div className="login-form-pane login-form-pane-active" key={`signin-${panelKey}`}>
                <header className="login-form-header">
                  <h2>{t('app.login.signIn')}</h2>
                  <p>{t('app.login.accessAccount')}</p>
                </header>

                {error && (
                  <div className="login-alert login-alert-error" role="alert">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="login-form" noValidate>
                  <div className="login-field">
                    <label htmlFor="login-email">{t('app.login.email')}</label>
                    <div className="login-input-wrap">
                      <Mail className="login-input-icon" aria-hidden />
                      <input
                        id="login-email"
                        className="login-input"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@laracineschool.rw"
                      />
                    </div>
                  </div>

                  <div className="login-field">
                    <div className="login-field-row">
                      <label htmlFor="login-password">{t('app.login.password')}</label>
                      <button type="button" className="login-text-btn" onClick={openForgot}>
                        {t('app.login.forgot')}
                      </button>
                    </div>
                    <div className="login-input-wrap">
                      <input
                        id="login-password"
                        className="login-input login-input-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        className="login-eye-btn"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="login-submit">
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                        {t('app.login.signingIn')}
                      </>
                    ) : (
                      <>
                        {t('app.login.signInBtn')}
                        <ArrowRight className="w-4 h-4 login-submit-arrow" aria-hidden />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )
          ) : (
            <div className="login-form-pane login-form-pane-active" key={`forgot-${panelKey}-${forgotSent ? 'sent' : 'form'}`}>
              <button type="button" className="login-forgot-back" onClick={closeForgot}>
                <ArrowLeft className="w-4 h-4" aria-hidden />
                {t('app.login.back')}
              </button>

              {!forgotSent ? (
                <>
                  <header className="login-form-header">
                    <h2>{t('app.login.resetTitle')}</h2>
                    <p>{t('app.login.forgotHint')}</p>
                  </header>

                  {forgotMessage && forgotError && (
                    <div className="login-alert login-alert-error" role="alert">
                      {forgotMessage}
                    </div>
                  )}

                  <form onSubmit={handleForgot} className="login-form">
                    <div className="login-field">
                      <label htmlFor="forgot-email">{t('app.login.email')}</label>
                      <div className="login-input-wrap">
                        <Mail className="login-input-icon" aria-hidden />
                        <input
                          id="forgot-email"
                          className="login-input"
                          type="email"
                          autoComplete="email"
                          required
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="you@laracineschool.rw"
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={forgotLoading} className="login-submit">
                      {forgotLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                          {t('app.login.sendingReset')}
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" aria-hidden />
                          {t('app.login.sendReset')}
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="login-forgot-success">
                  <div className="login-forgot-success-icon" aria-hidden>
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <header className="login-form-header">
                    <h2>{t('app.login.resetSentTitle')}</h2>
                    <p>{forgotMessage || t('app.login.resetSentBody')}</p>
                  </header>
                  <p className="login-forgot-email-chip">{forgotEmail}</p>
                  <p className="login-forgot-next">{t('app.login.resetSentNext')}</p>
                  <button type="button" className="login-submit" onClick={closeForgot}>
                    {t('app.login.backToSignIn')}
                    <ArrowRight className="w-4 h-4 login-submit-arrow" aria-hidden />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="login-footer-motto">Discipline · Intelligence · Innovation</p>
      </section>
    </div>
  );
}
