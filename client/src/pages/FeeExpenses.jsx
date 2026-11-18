import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import FormModeModal from '../components/form/FormModeModal';
import { useTranslation } from '../context/LanguageContext';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const COPY = {
  en: {
    title: 'Fees & expenses',
    description: 'Fees collected are the paid RWF receipts for this campus and academic year, grouped by the month they were paid. Dollar payments are not included. Expenses are entered below. This is a cash summary, not a full accounting profit.',
    summary: 'Monthly summary',
    details: 'Expense details',
    month: 'Month',
    collected: 'Fees collected (RWF)',
    expenses: 'Expenses (RWF)',
    profit: 'Profit / (loss) (RWF)',
    result: 'Result',
    notes: 'Notes',
    save: 'Save',
    saving: 'Saving…',
    total: 'Total for year',
    add: 'Add an expense',
    date: 'Date',
    amount: 'Amount spent (RWF)',
    descriptionLabel: 'Expense description',
    empty: 'No expenses recorded for this year.',
    allMonths: 'All months',
    cancel: 'Cancel',
    saved: 'Month saved.',
    added: 'Expense recorded.',
    removed: 'Expense removed.',
    export: 'CSV',
    PROFIT: 'Profit',
    LOSS: 'Loss',
    'BREAK-EVEN': 'Break-even',
  },
  fr: {
    title: 'Frais et dépenses',
    description: 'Les frais encaissés sont les reçus payés en RWF de ce campus et de cette année scolaire, regroupés par mois de paiement. Les paiements en dollars ne sont pas inclus. Les dépenses se saisissent ci-dessous. C’est un résumé de caisse, pas un bénéfice comptable complet.',
    summary: 'Résumé mensuel',
    details: 'Détail des dépenses',
    month: 'Mois',
    collected: 'Frais encaissés (RWF)',
    expenses: 'Dépenses (RWF)',
    profit: 'Bénéfice / (perte) (RWF)',
    result: 'Résultat',
    notes: 'Notes',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    total: 'Total de l’année',
    add: 'Ajouter une dépense',
    date: 'Date',
    amount: 'Montant dépensé (RWF)',
    descriptionLabel: 'Description',
    empty: 'Aucune dépense pour cette année.',
    allMonths: 'Tous les mois',
    cancel: 'Annuler',
    saved: 'Mois enregistré.',
    added: 'Dépense enregistrée.',
    removed: 'Dépense retirée.',
    export: 'CSV',
    PROFIT: 'Bénéfice',
    LOSS: 'Perte',
    'BREAK-EVEN': 'Équilibre',
  },
};

function money(amount) {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function resultClass(result) {
  if (result === 'PROFIT') return 'text-green-700';
  if (result === 'LOSS') return 'text-red-700';
  return 'text-gray-500';
}

function todayIso() {
  const date = new Date();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export default function FeeExpenses() {
  const { academicYear } = useCampus();
  const { language } = useTranslation();
  const copy = language === 'fr' ? COPY.fr : COPY.en;
  const monthName = (month) => new Date(2026, month - 1, 1).toLocaleString(language === 'fr' ? 'fr' : 'en', { month: 'long' });
  const [tab, setTab] = useState('summary');
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingMonth, setSavingMonth] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ month: String(new Date().getMonth() + 1), spentOn: todayIso(), amount: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await api.getFeeExpenses();
      setData(next);
      setDrafts(Object.fromEntries(next.months.map((row) => [row.month, { notes: row.notes || '' }])));
    } catch (err) {
      setError(err.message || 'Could not load fees and expenses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, academicYear?.id]);

  const visibleExpenses = useMemo(() => {
    const rows = data?.expenses || [];
    if (monthFilter === 'all') return rows;
    return rows.filter((row) => String(row.month) === monthFilter);
  }, [data, monthFilter]);

  const saveMonth = async (month) => {
    const draft = drafts[month] || { notes: '' };
    setSavingMonth(month);
    setError('');
    setMessage('');
    try {
      const next = await api.saveFeeMonth(month, { notes: draft.notes });
      setData(next);
      setMessage(copy.saved);
    } catch (err) {
      setError(err.message || 'Could not save this month.');
    } finally {
      setSavingMonth(null);
    }
  };

  const addExpense = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const next = await api.createSchoolExpense({
        month: Number(form.month),
        spentOn: form.spentOn,
        amount: Number(form.amount),
        description: form.description,
      });
      setData(next);
      setOpen(false);
      setForm({ month: form.month, spentOn: todayIso(), amount: '', description: '' });
      setTab('details');
      setMessage(copy.added);
    } catch (err) {
      setError(err.message || 'Could not record the expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeExpense = async (id) => {
    setError('');
    setMessage('');
    try {
      setData(await api.deleteSchoolExpense(id));
      setMessage(copy.removed);
    } catch (err) {
      setError(err.message || 'Could not remove the expense.');
    }
  };

  const download = () => {
    if (!data) return;
    const lines = [
      [copy.month, copy.collected, copy.expenses, copy.profit, copy.result, copy.notes],
      ...data.months.map((row) => [monthName(row.month), row.feesCollected, row.expenses, row.profit, copy[row.result], row.notes]),
      [copy.total, data.totals.feesCollected, data.totals.expenses, data.totals.profit, copy[data.totals.result], ''],
      [],
      [copy.month, copy.date, copy.amount, copy.descriptionLabel],
      ...data.expenses.map((row) => [monthName(row.month), row.spentOn, row.amount, row.description]),
    ];
    const csv = lines.map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fees-and-expenses.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={copy.description}
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={download} disabled={!data}>
              <Download className="w-4 h-4" /> {copy.export}
            </button>
            <button type="button" className="btn-primary text-sm" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4" /> {copy.add}
            </button>
          </div>
        )}
      />

      {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

      <div className="mb-4 flex gap-2">
        <button type="button" className={tab === 'summary' ? 'btn-primary text-sm' : 'btn-secondary text-sm'} onClick={() => setTab('summary')}>{copy.summary}</button>
        <button type="button" className={tab === 'details' ? 'btn-primary text-sm' : 'btn-secondary text-sm'} onClick={() => setTab('details')}>{copy.details}</button>
      </div>

      {loading && <p className="text-sm text-gray-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />…</p>}

      {data && tab === 'summary' && (
        <div className="stock-table-wrap">
          <table className="stock-table">
            <thead>
              <tr>
                <th>{copy.month}</th>
                <th>{copy.collected}</th>
                <th>{copy.expenses}</th>
                <th>{copy.profit}</th>
                <th>{copy.result}</th>
                <th>{copy.notes}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.months.map((row) => (
                <tr key={row.month}>
                  <td>{monthName(row.month)}</td>
                  <td>{money(row.feesCollected)}</td>
                  <td>{money(row.expenses)}</td>
                  <td className={resultClass(row.result)}>{money(row.profit)}</td>
                  <td className={resultClass(row.result)}>{copy[row.result]}</td>
                  <td>
                    <input
                      className="input"
                      value={drafts[row.month]?.notes ?? ''}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [row.month]: { notes: event.target.value },
                      }))}
                    />
                  </td>
                  <td>
                    <button type="button" className="btn-secondary text-sm" disabled={savingMonth === row.month} onClick={() => saveMonth(row.month)}>
                      {savingMonth === row.month ? copy.saving : copy.save}
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td><strong>{copy.total}</strong></td>
                <td><strong>{money(data.totals.feesCollected)}</strong></td>
                <td><strong>{money(data.totals.expenses)}</strong></td>
                <td className={resultClass(data.totals.result)}><strong>{money(data.totals.profit)}</strong></td>
                <td className={resultClass(data.totals.result)}><strong>{copy[data.totals.result]}</strong></td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {data && tab === 'details' && (
        <div>
          <div className="mb-3">
            <select className="input max-w-xs" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
              <option value="all">{copy.allMonths}</option>
              {MONTHS.map((month) => <option key={month} value={month}>{monthName(month)}</option>)}
            </select>
          </div>
          <div className="stock-table-wrap">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>{copy.month}</th>
                  <th>{copy.date}</th>
                  <th>{copy.amount}</th>
                  <th>{copy.descriptionLabel}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleExpenses.length === 0 && (
                  <tr><td colSpan={5} className="stock-empty">{copy.empty}</td></tr>
                )}
                {visibleExpenses.map((row) => (
                  <tr key={row.id}>
                    <td>{monthName(row.month)}</td>
                    <td>{row.spentOn}</td>
                    <td>{money(row.amount)}</td>
                    <td>{row.description}</td>
                    <td>
                      <button type="button" className="btn-secondary text-sm" onClick={() => removeExpense(row.id)} aria-label={copy.removed}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormModeModal
        open={open}
        mode="create"
        title={copy.add}
        onClose={() => setOpen(false)}
        onSubmit={addExpense}
        formId="school-expense-form"
        submitLabel={copy.add}
        cancelLabel={copy.cancel}
        submitting={submitting}
      >
        <div className="space-y-3">
          <label className="block text-sm">
            {copy.month}
            <select className="input mt-1" value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })}>
              {MONTHS.map((month) => <option key={month} value={month}>{monthName(month)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            {copy.date}
            <input className="input mt-1" type="date" required value={form.spentOn} onChange={(event) => setForm({ ...form, spentOn: event.target.value })} />
          </label>
          <label className="block text-sm">
            {copy.amount}
            <input className="input mt-1" type="number" min="1" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </label>
          <label className="block text-sm">
            {copy.descriptionLabel}
            <input className="input mt-1" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
        </div>
      </FormModeModal>
    </div>
  );
}
