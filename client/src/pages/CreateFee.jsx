import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import StudentSelect from '../components/StudentSelect';
import { studentFullName } from '../lib/studentName';
import {
  OTHER_FEE_LINES,
  TUITION_FEE_LINES,
  splitInstallmentAmount,
  tuitionFeeLine,
} from '../lib/tuitionFeeLines';
import { formatMoney } from '../lib/money';

const FINANCE_ROLES = new Set(['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY', 'ACCOUNTANT']);

export default function CreateFee() {
  const navigate = useNavigate();
  const { campusId } = useCampus();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canSuggest = FINANCE_ROLES.has(user?.role);
  const [students, setStudents] = useState([]);
  const [suggestNote, setSuggestNote] = useState('');
  const [suggestedTotal, setSuggestedTotal] = useState(null);
  const [form, setForm] = useState({
    studentId: '',
    lineId: 't1',
    installment: '1',
    amount: '',
    discountAmount: '',
    discountReason: '',
    dueDate: '',
    notes: '',
    status: 'PENDING',
    structureId: '',
  });
  const line = tuitionFeeLine(form.lineId);
  const currency = line.currency === 'USD' ? 'USD' : 'RWF';

  useEffect(() => {
    api.getStudents().then(setStudents).catch(console.error);
  }, []);

  useEffect(() => {
    if (!canSuggest || !form.studentId || !line.feeType) {
      setSuggestNote('');
      setSuggestedTotal(null);
      return;
    }
    let cancelled = false;
    api.suggestFeeAmount(form.studentId, line.feeType, { term: line.term, label: line.storedLabel })
      .then((result) => {
        if (cancelled) return;
        const match = result?.suggested;
        if (match) {
          const parts = Number(match.installments) > 1 ? Number(match.installments) : line.installments;
          setSuggestedTotal({ amount: match.amount, parts });
          setForm((prev) => ({
            ...prev,
            amount: String(parts > 1 ? splitInstallmentAmount(match.amount, parts, prev.installment) : match.amount),
            structureId: match.id,
            dueDate: prev.dueDate || (match.dueDate ? String(match.dueDate).slice(0, 10) : ''),
          }));
          setSuggestNote(
            match.class?.name
              ? `Suggested from ${match.class.name} structure${match.label ? ` (${match.label})` : ''}: ${formatMoney(match.amount, match.currency || currency)}`
              : `Suggested from school-wide structure${match.label ? ` (${match.label})` : ''}: ${formatMoney(match.amount, match.currency || currency)}`,
          );
        } else {
          setSuggestedTotal(null);
          setSuggestNote('No fee structure found for this line — enter the amount manually.');
          setForm((prev) => ({ ...prev, structureId: '' }));
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestNote('');
      });
    return () => { cancelled = true; };
  }, [canSuggest, form.studentId, line.feeType, line.term, line.storedLabel, line.installments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.studentId) return alert('Please select a student');

    try {
      const notes = [line.notes, form.notes].map((part) => String(part || '').trim()).filter(Boolean).join('\n');
      const fee = await api.createFee({
        studentId: form.studentId,
        feeType: line.feeType,
        term: line.term || null,
        amount: Number(form.amount),
        currency,
        dueDate: form.dueDate,
        notes: notes || null,
        status: form.status,
        discountAmount: Number(form.discountAmount) || 0,
        discountReason: form.discountReason,
        structureId: form.structureId || null,
        installmentIndex: line.installments > 1 ? Number(form.installment) : null,
        installmentTotal: line.installments > 1 ? line.installments : null,
      });
      navigate(`/campus/${campusId}/fees/${fee.id}`);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link to={`/campus/${campusId}/fees`} className="text-gray-400 hover:text-gray-200">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Record Fee Payment</h1>
          <p className="text-gray-400 mt-1">Create a new fee record for a student</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="card space-y-4">
          <div>
            <label className="label">Student *</label>
            <StudentSelect
              required
              students={students}
              value={form.studentId}
              onChange={(studentId) => setForm({ ...form, studentId })}
              emptyLabel="Select student..."
              getLabel={(s) =>
                `${s.studentId} — ${studentFullName(s)}${s.class ? ` (${s.class.name})` : ''}`
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('pageBody.fees.templateLine')} *</label>
              <select
                className="input"
                value={form.lineId}
                onChange={(e) => {
                  const next = tuitionFeeLine(e.target.value);
                  setForm({
                    ...form,
                    lineId: next.id,
                    installment: '1',
                    amount: '',
                    structureId: '',
                  });
                }}
              >
                <optgroup label={t('pageBody.fees.templateGroup')}>
                  {TUITION_FEE_LINES.map((item) => (
                    <option key={item.id} value={item.id}>{t(item.labelKey)}</option>
                  ))}
                </optgroup>
                <optgroup label={t('pageBody.fees.otherGroup')}>
                  {OTHER_FEE_LINES.map((item) => (
                    <option key={item.id} value={item.id}>{t(item.labelKey)}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="label">{t('ui.amount')} ({currency}) *</label>
              <input className="input" type="number" required min="0" step={currency === 'USD' ? '0.01' : '1'} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value, structureId: '' })} />
              {line.installments > 1 && (
                <div className="mt-2">
                  <label className="label">{t('pageBody.finance.installments')}</label>
                  <select
                    className="input"
                    value={form.installment}
                    onChange={(e) => {
                      const installment = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        installment,
                        amount: suggestedTotal
                          ? String(splitInstallmentAmount(suggestedTotal.amount, suggestedTotal.parts, installment))
                          : prev.amount,
                      }));
                    }}
                  >
                    <option value="1">{t('pageBody.tuition.col.inst1')}</option>
                    <option value="2">{t('pageBody.tuition.col.inst2')}</option>
                  </select>
                </div>
              )}
              {suggestNote && <p className="text-xs text-brand-700 mt-1">{suggestNote}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('pageBody.finance.discountAmount').replace('(RWF)', `(${currency})`)}</label>
              <input className="input" type="number" min="0" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} />
            </div>
            <div>
              <label className="label">Discount reason</label>
              <input className="input" value={form.discountReason} onChange={(e) => setForm({ ...form, discountReason: e.target.value })} placeholder="Scholarship, sibling discount…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Due Date *</label>
              <input className="input" type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary">Create Fee Record</button>
            <Link to={`/campus/${campusId}/finance`} className="btn-secondary">Finance desk</Link>
          </div>
        </div>
      </form>
    </div>
  );
}
