import { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, X } from 'lucide-react';
import Modal from '../form/Modal';
import { api } from '../../lib/api';

const ROLE_LABEL = {
  father: 'Père',
  mother: 'Mère',
  portal: 'Compte parent',
};

export default function PeriodMarksEmailModal({
  periodWindow,
  classes,
  defaultClassId,
  onClose,
  onResult,
}) {
  const [scope, setScope] = useState(defaultClassId ? 'class' : 'all');
  const [classId, setClassId] = useState(defaultClassId || '');
  const [pickParents, setPickParents] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (scope !== 'class' || !classId || !periodWindow?.id) {
      setContacts([]);
      setSelected(new Set());
      return undefined;
    }
    let cancelled = false;
    setLoadingContacts(true);
    setError('');
    api.getMidtermParentContacts(periodWindow.id, classId)
      .then((data) => {
        if (cancelled) return;
        const list = data.contacts || [];
        setContacts(list);
        setSelected(new Set(list.map((row) => row.key)));
      })
      .catch((err) => {
        if (!cancelled) {
          setContacts([]);
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingContacts(false);
      });
    return () => { cancelled = true; };
  }, [scope, classId, periodWindow?.id]);

  const selectedCount = useMemo(
    () => contacts.filter((row) => selected.has(row.key)).length,
    [contacts, selected],
  );

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSend = async () => {
    if (scope === 'class' && !classId) {
      setError('Choisissez une classe.');
      return;
    }
    if (scope === 'class' && pickParents && selectedCount === 0) {
      setError('Choisissez au moins un parent.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const payload = {};
      if (scope === 'class') {
        payload.classId = classId;
        if (pickParents) {
          payload.recipients = contacts
            .filter((row) => selected.has(row.key))
            .map((row) => ({ studentId: row.studentId, email: row.email }));
        }
      }
      const result = await api.emailMidtermParents(periodWindow.id, payload);
      const email = result.email || {};
      const parts = [`${email.sent || 0} email(s) envoyé(s)`];
      if (email.failed) parts.push(`${email.failed} échec(s)`);
      if (email.studentsWithoutEmail) parts.push(`${email.studentsWithoutEmail} élève(s) sans email parent`);
      if (email.studentsWithoutMarks) parts.push(`${email.studentsWithoutMarks} sans notes`);
      onResult(`${periodWindow.title} : ${parts.join(' · ')}. Chaque message contient le lien du bulletin PDF.`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!periodWindow) return null;

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Envoyer les notes aux parents</h2>
            <p className="mt-1 text-sm text-slate-500">
              {periodWindow.title} · {periodWindow.term}. Le message est en français, anglais, kinyarwanda et kiswahili, avec le lien pour télécharger le bulletin en PDF.
            </p>
          </div>
          <button type="button" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" onClick={onClose} aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-slate-700">Qui reçoit l’email</legend>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input type="radio" name="email-scope" checked={scope === 'all'} onChange={() => setScope('all')} />
            Tout le primaire
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input type="radio" name="email-scope" checked={scope === 'class'} onChange={() => setScope('class')} />
            Une classe
          </label>
        </fieldset>

        {scope === 'class' && (
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Classe</span>
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Choisir une classe…</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={pickParents}
                onChange={(e) => setPickParents(e.target.checked)}
                disabled={!classId}
              />
              Choisir les parents de cette classe
            </label>

            {pickParents && (
              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2 text-xs text-slate-500">
                  <span>{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}</span>
                  <button
                    type="button"
                    className="font-medium text-sky-700"
                    onClick={() => {
                      if (selectedCount === contacts.length) setSelected(new Set());
                      else setSelected(new Set(contacts.map((row) => row.key)));
                    }}
                  >
                    {selectedCount === contacts.length ? 'Tout retirer' : 'Tout sélectionner'}
                  </button>
                </div>
                {loadingContacts && (
                  <p className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement des parents…
                  </p>
                )}
                {!loadingContacts && contacts.length === 0 && (
                  <p className="px-3 py-4 text-sm text-slate-500">Aucun email de parent dans cette classe.</p>
                )}
                {!loadingContacts && contacts.map((row) => (
                  <label key={row.key} className="flex items-start gap-2 border-b border-slate-50 px-3 py-2 text-sm last:border-0">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(row.key)}
                      onChange={() => toggle(row.key)}
                    />
                    <span>
                      <span className="font-medium text-slate-900">{row.name || ROLE_LABEL[row.role] || 'Parent'}</span>
                      <span className="text-slate-500"> · {ROLE_LABEL[row.role] || row.role} · {row.studentName}</span>
                      <span className="block text-xs text-slate-400">{row.email}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={sending}>Annuler</button>
          <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Envoyer
          </button>
        </div>
      </div>
    </Modal>
  );
}
