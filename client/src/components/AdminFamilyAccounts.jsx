import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Copy,
  GraduationCap,
  KeyRound,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';

function generatePassword(length = 10) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function copyText(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text).catch(() => {});
}

export default function AdminFamilyAccounts({ studentId, student, onUpdated }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [credentials, setCredentials] = useState(null);

  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [parentFirstName, setParentFirstName] = useState('');
  const [parentLastName, setParentLastName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [createParent, setCreateParent] = useState(true);
  const [createStudent, setCreateStudent] = useState(true);

  const loadSuggestions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getStudentAccountSuggestions(studentId);
      setSuggestions(data);
      setParentEmail(data.parent?.suggestedEmail || '');
      setParentFirstName(data.parent?.suggestedFirstName || '');
      setParentLastName(data.parent?.suggestedLastName || '');
      setStudentEmail(data.student?.suggestedEmail || '');
      setCreateParent(data.canProvisionParent);
      setCreateStudent(data.canProvisionStudent);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [studentId]);

  const fillGeneratedPassword = () => {
    const pwd = generatePassword();
    setParentPassword(pwd);
    setStudentPassword(pwd);
  };

  const handleProvision = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    setCredentials(null);
    try {
      const result = await api.provisionStudentFamilyAccounts(studentId, {
        createParent,
        createStudent,
        parentEmail,
        parentPassword,
        parentFirstName,
        parentLastName,
        studentEmail,
        studentPassword,
      });
      setMessage(result.message || 'Family accounts created.');
      setCredentials({
        parent: result.parent ? { email: result.parent.email, password: createParent ? parentPassword : null } : null,
        student: result.student ? { email: result.student.email, password: createStudent ? studentPassword : null } : null,
      });
      await loadSuggestions();
      onUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="card mb-6 border-violet-100 bg-violet-50/30">
        <p className="text-sm text-gray-500">Loading family account setup…</p>
      </div>
    );
  }

  if (!suggestions) return null;

  const parentHasLogin = suggestions.parent?.hasLogin || student?.parent?.user;
  const studentHasLogin = suggestions.student?.hasLogin || student?.user;
  const canProvisionAnything = suggestions.canProvisionParent || suggestions.canProvisionStudent;
  const isApproved = student?.registrationStatus === 'APPROVED' || suggestions.registrationStatus === 'APPROVED';

  return (
    <div className="card mb-6 border-violet-100 bg-violet-50/30">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">Family portal accounts</h3>
          <p className="text-sm text-gray-600 mt-1">
            Create parent and student logins linked to this enrollment in one step. Parent login connects to the
            family record; student login opens the child portal.
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white border border-gray-100 text-sm">
              <p className="font-medium text-gray-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-violet-600" />
                Parent account
              </p>
              {parentHasLogin ? (
                <p className="mt-2 text-green-700 font-medium flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {(student?.parent?.user || suggestions.parent?.login)?.email}
                </p>
              ) : suggestions.parent?.hasRecord === false ? (
                <p className="mt-2 text-amber-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  No parent record linked
                </p>
              ) : (
                <p className="mt-2 text-amber-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  No parent login yet
                </p>
              )}
              {student?.parent?.phone && (
                <p className="text-gray-500 mt-1">Record · {student.parent.phone}</p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-white border border-gray-100 text-sm">
              <p className="font-medium text-gray-900 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-sky-600" />
                Student account
              </p>
              {studentHasLogin ? (
                <>
                  <p className="mt-2 text-green-700 font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    {(student?.user || suggestions.student?.login)?.email}
                  </p>
                  {student?.studentAccountCreatedBy && (
                    <p className="text-gray-500 mt-1">
                      Created by {student.studentAccountCreatedBy === 'PARENT' ? 'parent' : 'school office'}
                    </p>
                  )}
                </>
              ) : isApproved ? (
                <p className="mt-2 text-amber-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  No student login yet
                </p>
              ) : (
                <p className="mt-2 text-gray-500">Available after enrollment is approved</p>
              )}
            </div>
          </div>

          {message && (
            <p className="mt-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{message}</p>
          )}
          {error && (
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          {credentials && (credentials.parent || credentials.student) && (
            <div className="mt-4 p-4 rounded-xl bg-white border border-green-200 text-sm space-y-3">
              <p className="font-semibold text-gray-900">Share these credentials with the family</p>
              {credentials.parent?.password && (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-gray-500">Parent</p>
                    <p className="font-medium">{credentials.parent.email}</p>
                    <p className="text-gray-700">Password: {credentials.parent.password}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(`Parent login\nEmail: ${credentials.parent.email}\nPassword: ${credentials.parent.password}`)}
                    className="btn-secondary text-xs shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {credentials.student?.password && (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-gray-500">Student</p>
                    <p className="font-medium">{credentials.student.email}</p>
                    <p className="text-gray-700">Password: {credentials.student.password}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(`Student login\nEmail: ${credentials.student.email}\nPassword: ${credentials.student.password}`)}
                    className="btn-secondary text-xs shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {isApproved && canProvisionAnything && (
            <form onSubmit={handleProvision} className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={fillGeneratedPassword} className="btn-secondary text-sm inline-flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" />
                  Generate password
                </button>
                <button type="button" onClick={loadSuggestions} className="btn-secondary text-sm inline-flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4" />
                  Refresh suggestions
                </button>
              </div>

              {suggestions.canProvisionParent && (
                <fieldset className="p-4 rounded-xl bg-white border border-gray-100 space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <input
                      type="checkbox"
                      checked={createParent}
                      onChange={(e) => setCreateParent(e.target.checked)}
                      className="rounded border-gray-300 text-brand-600"
                    />
                    Create parent login
                  </label>
                  {createParent && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Parent email</label>
                        <input
                          type="email"
                          className="input"
                          value={parentEmail}
                          onChange={(e) => setParentEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Parent password</label>
                        <input
                          type="text"
                          className="input"
                          value={parentPassword}
                          onChange={(e) => setParentPassword(e.target.value)}
                          minLength={6}
                          required
                        />
                      </div>
                      <div>
                        <label className="label">First name</label>
                        <input
                          type="text"
                          className="input"
                          value={parentFirstName}
                          onChange={(e) => setParentFirstName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Last name</label>
                        <input
                          type="text"
                          className="input"
                          value={parentLastName}
                          onChange={(e) => setParentLastName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}
                </fieldset>
              )}

              {suggestions.canProvisionStudent && (
                <fieldset className="p-4 rounded-xl bg-white border border-gray-100 space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <input
                      type="checkbox"
                      checked={createStudent}
                      onChange={(e) => setCreateStudent(e.target.checked)}
                      className="rounded border-gray-300 text-brand-600"
                    />
                    Create student login
                  </label>
                  {createStudent && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Student email</label>
                        <input
                          type="email"
                          className="input"
                          value={studentEmail}
                          onChange={(e) => setStudentEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Student password</label>
                        <input
                          type="text"
                          className="input"
                          value={studentPassword}
                          onChange={(e) => setStudentPassword(e.target.value)}
                          minLength={6}
                          required
                        />
                      </div>
                    </div>
                  )}
                </fieldset>
              )}

              <button
                type="submit"
                disabled={busy || (!createParent && !createStudent)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {busy ? 'Creating accounts…' : 'Create family portal accounts'}
              </button>
            </form>
          )}

          {isApproved && !canProvisionAnything && parentHasLogin && studentHasLogin && (
            <p className="mt-4 text-sm text-green-700 font-medium">Both family portal accounts are already set up.</p>
          )}
        </div>
      </div>
    </div>
  );
}
