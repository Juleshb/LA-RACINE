import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import { useTranslation } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';

const ROLE_LABELS = {
  SCHOOL_MANAGER: 'School Manager',
  TEACHER: 'Teacher',
  HEAD_OF_STUDIES: 'Head of Studies',
  HEAD_OF_DISCIPLINE: 'Head of Discipline',
  SECRETARY: 'Secretary',
  ACCOUNTANT: 'Accountant',
  ACTIVITIES_MANAGER: 'Activities Manager',
  LIBRARIAN: 'Librarian',
  INVENTORY_MANAGER: 'Inventory Manager',
};

const ACTION_LABELS = {
  VIEW: 'View',
  CREATE: 'Add',
  UPDATE: 'Edit',
  DELETE: 'Delete',
  VALIDATE: 'Validate',
  PUBLISH: 'Publish',
  EXPORT: 'Export',
  PRINT: 'Print',
  ASSIGN: 'Assign',
  MANAGE: 'Administer',
};

const RULES = [
  'Rights belong to the role. Every user with that role inherits them on this campus.',
  'A right that is off is refused.',
  'The server checks the role, the campus, and the action on every request.',
  'Each campus keeps its own matrix. One campus cannot read another campus through this screen.',
  'School Admin accounts stay outside the matrix and keep full access, so the school cannot be locked out.',
  'Saving replaces the rights for that role on this campus immediately.',
];

export default function AccessControl() {
  const { campus, campusId } = useCampus();
  const { t } = useTranslation();
  const [tab, setTab] = useState('permissions');
  const [role, setRole] = useState('TEACHER');
  const [matrix, setMatrix] = useState(null);
  const [grants, setGrants] = useState({});
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = (nextRole = role) => {
    setError('');
    api.getAccessMatrix(nextRole)
      .then((data) => {
        setMatrix(data);
        setGrants(data.grants || {});
      })
      .catch((err) => setError(err.message));
  };

  useEffect(() => { load(role); }, [role, campusId]);

  useEffect(() => {
    if (tab !== 'audit') return;
    api.getAccessAudit().then(setAudit).catch((err) => setError(err.message));
  }, [tab, campusId, notice]);

  const activeCount = useMemo(
    () => Object.values(grants).filter(Boolean).length,
    [grants],
  );

  const toggle = (moduleId, action) => {
    const key = `${moduleId}:${action}`;
    setGrants((current) => ({ ...current, [key]: !current[key] }));
  };

  const save = async () => {
    setSaving(true);
    setNotice('');
    setError('');
    try {
      await api.saveAccessMatrix(role, grants);
      setNotice(t('pageBody.access.saved'));
      load(role);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setError('');
    try {
      const data = await api.resetAccessMatrix(role);
      setGrants(data.grants || {});
      setNotice(t('pageBody.access.resetDone'));
      load(role);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!window.confirm(t('pageBody.access.clearConfirm'))) return;
    setSaving(true);
    setError('');
    try {
      const data = await api.clearAccessMatrix(role);
      setGrants(data.grants || {});
      setNotice(t('pageBody.access.cleared'));
      load(role);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    const others = (matrix?.campuses || []).filter((item) => item.id !== campusId);
    if (!others.length) {
      setError(t('pageBody.access.noOtherCampus'));
      return;
    }
    const target = others[0];
    if (!window.confirm(t('pageBody.access.copyConfirm', { campus: target.name }))) return;
    setSaving(true);
    setError('');
    try {
      await api.copyAccessMatrix(role, target.id);
      setNotice(t('pageBody.access.copied', { campus: target.name }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const exportAudit = () => {
    const lines = ['Date,Event,Detail', ...audit.map((item) => (
      [item.createdAt, item.title, item.detail].map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(',')
    ))];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'permission-audit.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title={t('pageBody.access.title')}
        description={t('pageBody.access.subtitle', { campus: campus?.name || '' })}
        action={(
          <Link to={`/campus/${campusId}/users`} className="btn-secondary">
            {t('pageBody.access.manageUsers')}
          </Link>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label={t('pageBody.access.statUsers')} value={matrix?.users?.length ?? '—'} />
        <Stat label={t('pageBody.access.statActive')} value={matrix?.users?.filter((user) => user.isActive).length ?? '—'} />
        <Stat label={t('pageBody.access.statRoles')} value="8" />
        <Stat label={t('pageBody.access.statRights')} value={activeCount} />
      </div>

      <div className="users-tabs mb-4" role="tablist">
        {['permissions', 'roles', 'audit', 'security'].map((id) => (
          <button
            key={id}
            type="button"
            className={`users-tab ${tab === id ? 'users-tab-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {t(`pageBody.access.tabs.${id}`)}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {notice && <p className="text-sm text-emerald-700 mb-3">{notice}</p>}

      {tab === 'permissions' && matrix && (
        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4">
          <section className="card p-4">
            <h2 className="font-bold text-gray-900">{t('pageBody.access.configure')}</h2>
            <p className="text-xs text-gray-500 mt-1 mb-3">{t('pageBody.access.configureHint')}</p>
            <label className="label">{t('ui.role')}</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {(matrix.roles || []).map((item) => (
                <option key={item} value={item}>{ROLE_LABELS[item] || item}</option>
              ))}
            </select>
            <p className="label mt-4">{t('pageBody.access.affected')}</p>
            <div className="space-y-1">
              {(matrix.users || []).length === 0 && (
                <p className="text-xs text-gray-500">{t('pageBody.access.noUsers')}</p>
              )}
              {(matrix.users || []).map((user) => (
                <p key={user.id} className="text-sm text-gray-700">
                  {user.firstName} {user.lastName}
                  <span className={`ml-2 text-[10px] font-bold ${user.isActive ? 'text-emerald-700' : 'text-gray-400'}`}>
                    {user.isActive ? t('ui.active') : t('ui.inactive')}
                  </span>
                </p>
              ))}
            </div>
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3 mt-4">
              {matrix.customized ? t('pageBody.access.savedNote') : t('pageBody.access.unsavedNote')}
            </p>
          </section>

          <section className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-gray-900">{t('pageBody.access.matrix')}</h2>
                <p className="text-xs text-gray-500">{campus?.name} · {activeCount} {t('pageBody.access.rights')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={reset} disabled={saving}>{t('pageBody.access.reset')}</button>
                <button type="button" className="btn-secondary text-xs" onClick={copy} disabled={saving}>{t('pageBody.access.copy')}</button>
                <button type="button" className="btn-secondary text-xs" onClick={clear} disabled={saving}>{t('pageBody.access.clear')}</button>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 bg-gray-50">
                    <th className="px-4 py-3">{t('pageBody.access.module')}</th>
                    {['VIEW', 'CREATE', 'UPDATE', 'DELETE'].map((action) => (
                      <th key={action} className="px-3 py-3 text-center">{ACTION_LABELS[action]}</th>
                    ))}
                    <th className="px-3 py-3">{t('pageBody.access.extra')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(matrix.modules || []).map((moduleDef) => (
                    <tr key={moduleDef.id} className="border-t border-gray-100">
                      <td className="px-4 py-3">
                        <b className="block text-gray-900">{moduleDef.label}</b>
                        <span className="text-[11px] text-gray-500">{moduleDef.description}</span>
                      </td>
                      {['VIEW', 'CREATE', 'UPDATE', 'DELETE'].map((action) => (
                        <td key={action} className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-sky-700"
                            checked={Boolean(grants[`${moduleDef.id}:${action}`])}
                            onChange={() => toggle(moduleDef.id, action)}
                            aria-label={`${ACTION_LABELS[action]} ${moduleDef.label}`}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {(moduleDef.extras || []).map((action) => (
                            <label key={action} className="inline-flex items-center gap-1 text-[11px] text-gray-600 bg-gray-50 px-2 py-1 rounded-md">
                              <input
                                type="checkbox"
                                className="accent-sky-700"
                                checked={Boolean(grants[`${moduleDef.id}:${action}`])}
                                onChange={() => toggle(moduleDef.id, action)}
                              />
                              {ACTION_LABELS[action] || action}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex justify-end">
              <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                {saving ? t('ui.saving') : t('pageBody.access.save')}
              </button>
            </div>
          </section>
        </div>
      )}

      {tab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(matrix?.roles || []).map((item, index) => (
            <button
              key={item}
              type="button"
              className={`card p-4 text-left ${role === item ? 'ring-2 ring-sky-600' : ''}`}
              onClick={() => { setRole(item); setTab('permissions'); }}
            >
              <p className="text-[10px] font-bold text-sky-700">0{index + 1}</p>
              <h3 className="font-bold text-gray-900">{ROLE_LABELS[item] || item}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('pageBody.access.roleHint')}</p>
            </button>
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <section className="card">
          <div className="p-4 border-b border-gray-100 flex justify-between gap-2">
            <h2 className="font-bold text-gray-900">{t('pageBody.access.tabs.audit')}</h2>
            <button type="button" className="btn-secondary text-xs" onClick={exportAudit} disabled={!audit.length}>
              {t('pageBody.access.exportAudit')}
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {audit.length === 0 && <p className="p-4 text-sm text-gray-500">{t('pageBody.access.noAudit')}</p>}
            {audit.map((item) => (
              <article key={item.id} className="p-4">
                <b className="text-sm text-gray-900">{item.title}</b>
                <p className="text-sm text-gray-600">{item.detail}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {item.actorName} · {new Date(item.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'security' && (
        <section className="card p-4 space-y-3">
          {RULES.map((rule) => (
            <p key={rule} className="text-sm text-gray-700 border-b border-gray-100 pb-3">{rule}</p>
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
