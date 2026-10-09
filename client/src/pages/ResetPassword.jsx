import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import Logo from '../components/Logo';
import { PASSWORD_POLICY_HINT, passwordStrengthLabel, validateStrongPassword } from '../lib/passwordPolicy';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = passwordStrengthLabel(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
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
      await api.resetPassword(token, password, confirm);
      setSuccess('Password reset successfully. You can now sign in.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8"><Logo size="lg" showMotto /></div>
        <div className="card">
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Set new password</h2>
          <p className="text-gray-500 mb-6 text-sm">
            Choose a strong password for your École La RACINE account.
          </p>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!searchParams.get('token') && (
              <div>
                <label className="label">Reset token</label>
                <input className="input" required value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste token from email link" />
              </div>
            )}
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
              {loading ? 'Saving…' : 'Save new password'}
            </button>
          </form>

          <p className="text-sm text-gray-400 mt-4 text-center">
            <Link to="/login" className="text-brand-600 hover:underline">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
