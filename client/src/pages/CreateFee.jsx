import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import { useAuth } from '../context/AuthContext';
import StudentSelect from '../components/StudentSelect';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', maximumFractionDigits: 0 }).format(amount);
}

const FINANCE_ROLES = new Set(['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY', 'ACCOUNTANT']);

export default function CreateFee() {
  const navigate = useNavigate();
  const { campusId } = useCampus();
  const { user } = useAuth();
  const canSuggest = FINANCE_ROLES.has(user?.role);
  const [students, setStudents] = useState([]);
  const [suggestNote, setSuggestNote] = useState('');
  const [form, setForm] = useState({
    studentId: '',
    feeType: 'TUITION',
    amount: '',
    discountAmount: '',
    discountReason: '',
    dueDate: '',
    notes: '',
    status: 'PENDING',
    structureId: '',
  });

  useEffect(() => {
    api.getStudents().then(setStudents).catch(console.error);
  }, []);

  useEffect(() => {
    if (!canSuggest || !form.studentId || !form.feeType) {
      setSuggestNote('');
      return;
    }
    let cancelled = false;
    api.suggestFeeAmount(form.studentId, form.feeType)
      .then((result) => {
        if (cancelled) return;
        const match = result?.suggested;
        if (match) {
          setForm((prev) => ({
            ...prev,
            amount: String(match.amount),
            structureId: match.id,
            dueDate: prev.dueDate || (match.dueDate ? String(match.dueDate).slice(0, 10) : ''),
          }));
          setSuggestNote(
            match.class?.name
              ? `Suggested from ${match.class.name} structure${match.label ? ` (${match.label})` : ''}: ${formatCurrency(match.amount)}`
              : `Suggested from school-wide structure${match.label ? ` (${match.label})` : ''}: ${formatCurrency(match.amount)}`,
          );
        } else {
          setSuggestNote('No fee structure found for this student/type — enter amount manually.');
          setForm((prev) => ({ ...prev, structureId: '' }));
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestNote('');
      });
    return () => { cancelled = true; };
  }, [canSuggest, form.studentId, form.feeType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.studentId) return alert('Please select a student');

    try {
      const fee = await api.createFee({
        studentId: form.studentId,
        feeType: form.feeType,
        amount: Number(form.amount),
        dueDate: form.dueDate,
        notes: form.notes,
        status: form.status,
        discountAmount: Number(form.discountAmount) || 0,
        discountReason: form.discountReason,
        structureId: form.structureId || null,
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
                `${s.studentId} — ${s.firstName} ${s.lastName}${s.class ? ` (${s.class.name})` : ''}`
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fee Type *</label>
              <select className="input" value={form.feeType} onChange={(e) => setForm({ ...form, feeType: e.target.value })}>
                <option value="TUITION">Tuition</option>
                <option value="REGISTRATION">Registration</option>
                <option value="EXAM">Exam Fee</option>
                <option value="TRANSPORT">Transport</option>
                <option value="UNIFORM">Uniform</option>
                <option value="OTHER">Other</option>
                <option value="CONFIRMATION">Confirmation (continue next year)</option>
              </select>
            </div>
            <div>
              <label className="label">Amount (RWF) *</label>
              <input className="input" type="number" required min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value, structureId: '' })} />
              {suggestNote && <p className="text-xs text-brand-700 mt-1">{suggestNote}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Discount (RWF)</label>
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
