import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, KeyRound, Mail, Shield, UserPlus, AlertCircle, CheckCircle, PauseCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';

function ChildAccountCard({ child, campusId, onUpdated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const clearForm = () => {
    setPassword('');
    setNewPassword('');
    setError('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api.createParentChildAccount(child.id, { email, password });
      setMessage(result.message || 'Student account created.');
      clearForm();
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api.resetParentChildPassword(child.id, newPassword);
      setMessage(result.message || 'Password updated.');
      setNewPassword('');
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!child.login) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api.setParentChildAccountStatus(child.id, !child.login.isActive);
      setMessage(result.message);
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card border-brand-100">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900">
            {child.firstName} {child.lastName}
          </h2>
          <p className="text-sm text-brand-600 font-medium">{child.studentCode}</p>
          {child.class?.name && (
            <p className="text-sm text-gray-500 mt-0.5">{child.class.name}</p>
          )}
        </div>
        {child.hasLogin ? (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${child.login.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            <CheckCircle className="w-3.5 h-3.5" />
            {child.login.isActive ? 'Portal active' : 'Portal paused'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 shrink-0">
            <AlertCircle className="w-3.5 h-3.5" />
            No login yet
          </span>
        )}
      </div>

      {message && (
        <p className="mt-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{message}</p>
      )}
      {error && (
        <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {child.hasLogin ? (
        <div className="mt-5 space-y-4">
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm">
            <p className="text-gray-500">Sign-in email</p>
            <p className="font-semibold text-gray-900 mt-0.5">{child.login.email}</p>
            {child.managedBy && (
              <p className="text-xs text-gray-500 mt-2">
                Account managed by {child.managedBy === 'PARENT' ? 'parent' : 'school office'}
              </p>
            )}
          </div>

          <form onSubmit={handleResetPassword} className="space-y-3">
            <label className="label flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" />
              New password for your child
            </label>
            <input
              className="input"
              type="password"
              minLength={6}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
            <button type="submit" disabled={busy} className="btn-secondary">
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </form>

          <button
            type="button"
            onClick={toggleActive}
            disabled={busy}
            className={`btn-secondary flex items-center gap-2 ${!child.login.isActive ? 'text-green-700' : 'text-amber-700'}`}
          >
            <PauseCircle className="w-4 h-4" />
            {child.login.isActive ? 'Pause portal access' : 'Enable portal access'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="mt-5 space-y-3">
          <p className="text-sm text-gray-600">
            Create a student portal login so your child can access homework, live classes, e-library, and e-learning.
          </p>
          <div>
            <label className="label flex items-center gap-1.5">
              <Mail className="w-4 h-4" />
              Email for student login
            </label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="child@example.com"
            />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" />
              Password
            </label>
            <input
              className="input"
              type="password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password for your child"
            />
          </div>
          <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            {busy ? 'Creating…' : 'Create student portal account'}
          </button>
        </form>
      )}
    </article>
  );
}

export default function ParentChildAccounts() {
  const { campusId } = useCampus();
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getParentChildAccounts()
      .then(setAccounts)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const pendingApproval = accounts.length === 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title={t('pages.childAccounts.title')}
        description={t('pages.childAccounts.description')}
      />

      <div className="card border-violet-200 bg-violet-50/50">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
          <div className="text-sm text-violet-900 space-y-2">
            <p className="font-semibold">How it works</p>
            <ol className="list-decimal list-inside space-y-1 text-violet-800">
              <li>Submit a child application via <Link to={`/campus/${campusId}/register-child`} className="font-semibold underline">Register child</Link></li>
              <li>School reviews and approves enrollment</li>
              <li>You create the student login here (email + password)</li>
              <li>Your child signs in at the login page with those credentials</li>
            </ol>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
        </div>
      ) : pendingApproval ? (
        <div className="card flex items-start gap-3 border-amber-200 bg-amber-50/80">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">No approved children yet</p>
            <p className="text-sm text-amber-800 mt-1">
              Student portal accounts can only be created after the school approves your child&apos;s enrollment.
              Check <Link to={`/campus/${campusId}/my-registrations`} className="font-semibold underline">My applications</Link> for status.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((child) => (
            <ChildAccountCard key={child.id} child={child} campusId={campusId} onUpdated={load} />
          ))}
        </div>
      )}
    </div>
  );
}
