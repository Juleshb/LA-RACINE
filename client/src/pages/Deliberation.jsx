import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Gavel } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';

export default function Deliberation() {
  const { campus, academicYear } = useCampus();
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterClass, setFilterClass] = useState('all');

  const load = () => {
    setError('');
    api.getDeliberation()
      .then((payload) => {
        setData(payload);
        setRows((payload.students || []).map((s) => ({
          ...s,
          decision: s.savedDecision || s.suggestedDecision,
          selected: true,
        })));
      })
      .catch((err) => setError(err.message));
  };

  useEffect(() => { load(); }, []);

  const sourceClasses = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.class?.id || 'none';
      if (!map.has(key)) map.set(key, r.class?.name || 'Unassigned');
    }
    return [...map.entries()];
  }, [rows]);

  const visible = rows.filter((r) => filterClass === 'all' || (r.class?.id || 'none') === filterClass);

  const setAllVisible = (decision) => {
    setRows((prev) => prev.map((r) => {
      if (filterClass !== 'all' && (r.class?.id || 'none') !== filterClass) return r;
      const nextDecision = decision === 'PROMOTE' && r.suggestedDecision === 'GRADUATE' ? 'GRADUATE' : decision;
      return { ...r, decision: nextDecision, selected: true };
    }));
  };

  const handleApply = async () => {
    const selected = rows.filter((r) => r.selected);
    if (!selected.length) {
      setError('Select at least one student.');
      return;
    }
    if (!confirm(`Save council decisions for ${selected.length} student(s) in ${data.sourceYear?.name}?\n\nThis does not enroll them yet. Confirmation and payment happen when you start the next year.`)) {
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const result = await api.applyDeliberation({
        decisions: selected.map((r) => ({
          studentRecordId: r.id,
          decision: r.decision,
        })),
      });
      setMessage(result.message);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const counts = {
    promote: rows.filter((r) => r.decision === 'PROMOTE').length,
    repeat: rows.filter((r) => r.decision === 'REPEAT').length,
    graduate: rows.filter((r) => r.decision === 'GRADUATE').length,
    rejected: rows.filter((r) => r.decision === 'REJECTED').length,
    saved: rows.filter((r) => r.savedDecision).length,
  };

  return (
    <div>
      <PageHeader
        title="Year-end deliberation"
        description={`Conseil de classe for ${data?.sourceYear?.name || academicYear?.name || campus.name}. Decide from the report: promote, repeat, or reject.`}
        action={
          <Link to="../academic-years" className="btn-secondary">
            Academic years
          </Link>
        }
      />

      {message && <div className="mb-6 p-4 rounded-lg text-sm bg-brand-50 text-brand-700">{message}</div>}
      {error && <div className="mb-6 p-4 rounded-lg text-sm bg-red-50 text-red-600">{error}</div>}

      <div className="card mb-6 border-brand-200 bg-brand-50/30">
        <div className="flex items-start gap-3">
          <Gavel className="w-7 h-7 text-brand-600 shrink-0" />
          <div className="text-sm text-gray-700 space-y-1">
            <p>
              Do this at the <strong>end of the year</strong>, using bulletins.
              Decisions are saved on this year’s records.
            </p>
            <p>
              <strong>Promote</strong> — next grade.
              <strong> Repeat</strong> — same grade next year.
              <strong> Graduate</strong> — P6 leavers.
              <strong> Rejected</strong> — will not continue (failed / not admitted).
            </p>
            <p>
              When you <strong>start the new year</strong>, promoted and repeating students are enrolled and asked to pay the confirmation fee. Rejected and graduated students are not enrolled.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select className="input w-auto" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="all">All classes</option>
          {sourceClasses.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <button type="button" className="btn-secondary text-sm" onClick={() => setAllVisible('PROMOTE')}>Promote all (visible)</button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setAllVisible('REPEAT')}>Repeat all (visible)</button>
        <span className="text-sm text-gray-500 ml-auto">
          {counts.promote} promote · {counts.repeat} repeat · {counts.rejected} rejected · {counts.saved} saved
        </span>
        <button type="button" className="btn-primary flex items-center gap-2" disabled={submitting} onClick={handleApply}>
          <Check className="w-4 h-4" />
          {submitting ? 'Saving…' : 'Save decisions'}
        </button>
      </div>

      <div className="card overflow-x-auto">
        {visible.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No approved students in this year.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="pb-3 w-8"></th>
                <th className="pb-3 font-medium">Student</th>
                <th className="pb-3 font-medium">Current class</th>
                <th className="pb-3 font-medium">If promoted</th>
                <th className="pb-3 font-medium">Decision</th>
                <th className="pb-3 font-medium">Saved</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-3">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, selected: e.target.checked } : x)))}
                    />
                  </td>
                  <td className="py-3">
                    <p className="font-medium text-gray-900">{r.lastName} {r.firstName}</p>
                    <p className="text-xs text-gray-500">{r.studentId}</p>
                  </td>
                  <td className="py-3 text-sm text-gray-600">{r.class?.name || '—'}</td>
                  <td className="py-3 text-sm text-gray-500">{r.targetGrade || '—'}</td>
                  <td className="py-3">
                    <select
                      className="input py-1.5 text-sm"
                      value={r.decision}
                      onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, decision: e.target.value } : x)))}
                    >
                      <option value="PROMOTE">Promote</option>
                      <option value="REPEAT">Repeat</option>
                      <option value="GRADUATE">Graduate</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </td>
                  <td className="py-3 text-xs text-gray-500">{r.savedDecision || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
