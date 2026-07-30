import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, setActiveCampus } from '../lib/api';
import { getLoginRedirect } from '../config/permissions';
import Logo from '../components/Logo';
import { PASSWORD_POLICY_HINT, passwordStrengthLabel, validateStrongPassword } from '../lib/passwordPolicy';

/** Forced password change after temporary password login. */
export default function SetNewPassword() {
  const { user, refreshUser, logout, defaultCampusId } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const strength = passwordStrengthLabel(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    const check = validateStrongPassword(password);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setLoading(true);
    try {
      await api.changePassword('', password, confirm);
      const data = await refreshUser();
      if (data.defaultCampusId) setActiveCampus(data.defaultCampusId);
      navigate(getLoginRedirect(data.user, data.defaultCampusId || defaultCampusId), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="card max-w-md w-full text-center">
          <p className="text-gray-600 mb-4">Please sign in first.</p>
          <Link to="/login" className="btn-primary inline-flex">Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8"><Logo size="lg" showMotto /></div>
        <div className="card">
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Create a new password</h2>
          <p className="text-gray-500 mb-6 text-sm">
            You signed in with a temporary password. Choose a strong password to continue.
          </p>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <input
                className="input"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {password && (
                <p className={`text-xs mt-1 ${strength.level >= 3 ? 'text-brand-700' : strength.level === 2 ? 'text-amber-600' : 'text-red-500'}`}>
                  Strength: {strength.label}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">{PASSWORD_POLICY_HINT}</p>
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input
                className="input"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              <KeyRound className="w-4 h-4" />
              {loading ? 'Saving…' : 'Save and continue'}
            </button>
          </form>

          <button
            type="button"
            className="mt-4 text-sm text-gray-500 hover:text-red-600 w-full text-center"
            onClick={() => { logout(); navigate('/login'); }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
