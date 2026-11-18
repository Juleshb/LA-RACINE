import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';

const ROLE_FILTERS = [
  { id: 'all', roles: null },
  { id: 'teacher', roles: ['TEACHER'] },
  { id: 'parent', roles: ['PARENT'] },
  { id: 'student', roles: ['STUDENT'] },
  { id: 'accountant', roles: ['ACCOUNTANT'] },
  { id: 'librarian', roles: ['LIBRARIAN'] },
  { id: 'activities', roles: ['ACTIVITIES_MANAGER'] },
  { id: 'inventory', roles: ['INVENTORY_MANAGER'] },
  { id: 'staff', roles: ['SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE'] },
];

function copyFor(item, language) {
  return language === 'fr' ? item.fr : item.en;
}

function formatDate(value, language) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Updates() {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [payload, setPayload] = useState({ updates: [], canSeeAll: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [kind, setKind] = useState('change');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getProductUpdates()
      .then((data) => {
        if (!cancelled) setPayload(data || { updates: [], canSeeAll: false });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const updates = useMemo(() => {
    const list = payload.updates || [];
    if (!payload.canSeeAll || roleFilter === 'all') return list;
    const roles = ROLE_FILTERS.find((item) => item.id === roleFilter)?.roles || [];
    return list.filter((item) => item.roles.some((role) => roles.includes(role)));
  }, [payload, roleFilter]);

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSent(false);
    setSending(true);
    try {
      await api.requestProductChange({ kind, subject, message });
      setSubject('');
      setMessage('');
      setSent(true);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('pageBody.updates.title')}
        description={payload.canSeeAll
          ? t('pageBody.updates.adminHint')
          : t('pageBody.updates.roleHint')}
      />

      {payload.canSeeAll && (
        <div className="card mb-4 p-4">
          <label className="label">{t('pageBody.updates.filterRole')}</label>
          <select className="input max-w-xs" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            {ROLE_FILTERS.map((item) => (
              <option key={item.id} value={item.id}>{t(`pageBody.updates.filters.${item.id}`)}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 mb-6">{t('ui.loading')}</p>
      ) : error ? (
        <p className="text-sm text-red-600 mb-6">{error}</p>
      ) : (
        <div className="space-y-3 mb-8">
          {updates.map((item) => {
            const text = copyFor(item, language);
            return (
              <article key={item.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                      <Megaphone className="w-4 h-4" />
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">{text.title}</h2>
                      <p className="text-xs font-semibold text-sky-700 mt-0.5">
                        {item.commit
                          ? t('pageBody.updates.committed', { date: formatDate(item.date, language), commit: item.commit })
                          : t('pageBody.updates.notCommitted', { date: formatDate(item.date, language) })}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mt-3">{text.summary}</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc pl-5">
                  {text.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </article>
            );
          })}
          {updates.length === 0 && (
            <p className="text-sm text-gray-500">{t('pageBody.updates.empty')}</p>
          )}
        </div>
      )}

      <section className="card p-4">
        <h2 className="text-base font-bold text-gray-900">{t('pageBody.updates.requestTitle')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('pageBody.updates.requestHint', { name: user?.firstName || '' })}</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="kind" checked={kind === 'change'} onChange={() => setKind('change')} />
              {t('pageBody.updates.kindChange')}
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="kind" checked={kind === 'support'} onChange={() => setKind('support')} />
              {t('pageBody.updates.kindSupport')}
            </label>
          </div>
          <div>
            <label className="label">{t('pageBody.updates.subject')}</label>
            <input className="input" required value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('pageBody.updates.message')}</label>
            <textarea className="input min-h-[120px]" required minLength={10} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          {sent && <p className="text-sm text-emerald-700">{t('pageBody.updates.sent')}</p>}
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={sending}>
            <Send className="w-4 h-4" />
            {sending ? t('pageBody.updates.sending') : t('pageBody.updates.send')}
          </button>
        </form>
      </section>
    </div>
  );
}
