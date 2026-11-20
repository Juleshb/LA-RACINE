import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Download, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';
import { studentFullName } from '../lib/studentName';
import { compareTuitionClass, sortTuitionPeople } from '../lib/tuitionSort';
import { formatMoney } from '../lib/money';

function formatCurrency(amount) {
  if (amount == null || amount === '') return '—';
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function MoneyCell({ value, muted, currency = 'RWF' }) {
  return (
    <td className={`px-2 py-1.5 text-right text-xs whitespace-nowrap ${muted ? 'text-gray-400' : 'text-gray-800'}`}>
      {value == null || value === 0 ? '—' : (currency === 'USD' ? formatMoney(value, 'USD') : formatCurrency(value))}
    </td>
  );
}

function InstallmentCell({ campusId, cell, onMarkPaid, markingId }) {
  if (!cell?.feeId) {
    return <td className="px-2 py-1.5 text-right text-xs text-gray-300">—</td>;
  }
  if (cell.paid) {
    return (
      <td className="px-2 py-1.5 text-right text-xs whitespace-nowrap">
        <Link to={`/campus/${campusId}/fees/${cell.feeId}`} className="text-emerald-700 hover:underline font-medium">
          {formatCurrency(cell.amount)}
        </Link>
      </td>
    );
  }
  return (
    <td className="px-2 py-1.5 text-right text-xs whitespace-nowrap">
      <button
        type="button"
        disabled={markingId === cell.feeId}
        onClick={() => onMarkPaid(cell.feeId)}
        className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium disabled:opacity-50"
        title="Mark paid"
      >
        {markingId === cell.feeId ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
        {formatCurrency(cell.amount)}
      </button>
    </td>
  );
}

export default function TuitionLedger() {
  const { campusId } = useCampus();
  const { t } = useTranslation();
  const [level, setLevel] = useState('nursery');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [markingId, setMarkingId] = useState(null);
  const [sortMode, setSortMode] = useState('class');
  const [classId, setClassId] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.getTuitionLedger(level));
    } catch (err) {
      setError(err.message || 'Failed to load tuition ledger');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [level]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setClassId('all'); }, [level]);

  const markPaid = async (feeId) => {
    setMarkingId(feeId);
    setMessage('');
    try {
      await api.updateFeeStatus(feeId, 'PAID');
      setMessage(t('pageBody.tuition.markedPaid'));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setMarkingId(null);
    }
  };

  const isPrimary = level === 'primary';

  const exportCsv = () => {
    if (!data?.rows?.length) return;
    const headers = isPrimary
      ? [
        'S/N', 'Names', 'Classes', 'Uniforms', 'Inscription', 'Paiement en Dollars',
        'Activities First trim', 'Activities Second trim', 'Activities Third trim',
        'Carry-over',
        'T1 Amount', 'T1 Inst1', 'T1 Inst2', 'T1 Balance',
        'T2 Amount', 'T2 Inst1', 'T2 Inst2', 'T2 Balance',
        'T3 Amount', 'T3 Inst1', 'T3 Inst2', 'T3 Balance',
      ]
      : [
        'S/N', 'Names', 'Classes', 'Paiement en Dollars', 'Inscription', 'Confirmation',
        'Carry-over',
        'T1 Amount', 'T1 Inst1', 'T1 Inst2', 'T1 Balance',
        'T2 Amount', 'T2 Inst1', 'T2 Inst2', 'T2 Balance',
        'T3 Amount', 'T3 Inst1', 'T3 Inst2', 'T3 Balance',
      ];
    const lines = [headers.join(',')];
    for (const row of visibleRows) {
      const name = studentFullName(row.student);
      const trimesterCells = ['t1', 't2', 't3'].flatMap((key) => {
        const tri = row.trimesters[key];
        return [
          tri.due,
          tri.inst1.paid ? tri.inst1.amount : '',
          tri.inst2.paid ? tri.inst2.amount : '',
          tri.balance,
        ];
      });
      const cells = isPrimary
        ? [
          row.sn,
          `"${name}"`,
          `"${row.branche || ''}"`,
          row.uniform?.due || 0,
          row.inscription?.due || 0,
          row.dollar?.due || 0,
          row.activities?.t1?.due || 0,
          row.activities?.t2?.due || 0,
          row.activities?.t3?.due || 0,
          row.carryOver?.due || 0,
          ...trimesterCells,
        ]
        : [
          row.sn,
          `"${name}"`,
          `"${row.branche || ''}"`,
          row.dollar?.due || 0,
          row.inscription?.due || 0,
          row.confirmation?.due || 0,
          row.carryOver?.due || 0,
          ...trimesterCells,
        ];
      lines.push(cells.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tuition-ledger-${level}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rows = data?.rows || [];
  const classOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const cls = row.student?.class;
      const id = cls?.id || row.branche || '';
      if (!id || map.has(id)) return;
      map.set(id, { id, name: row.branche || cls?.name || '—', class: cls });
    });
    return [...map.values()].sort((a, b) => compareTuitionClass(a, b));
  }, [rows]);
  const visibleRows = useMemo(() => {
    const filtered = classId === 'all'
      ? rows
      : rows.filter((row) => (row.student?.class?.id || row.branche) === classId);
    return sortTuitionPeople(filtered, sortMode).map((row, index) => ({ ...row, sn: index + 1 }));
  }, [rows, classId, sortMode]);

  return (
    <div>
      <PageHeader
        title={t('pages.tuitionLedger.title')}
        description={t('pages.tuitionLedger.description')}
        action={(
          <div className="flex flex-wrap gap-2">
            <Link to={`/campus/${campusId}/finance`} className="btn-secondary text-sm">
              {t('pages.finance.title')}
            </Link>
            <button type="button" onClick={exportCsv} className="btn-secondary text-sm flex items-center gap-1.5" disabled={!visibleRows.length}>
              <Download className="w-4 h-4" />
              {t('pageBody.finance.exportCsv')}
            </button>
            <button type="button" onClick={load} className="btn-secondary text-sm flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4" />
              {t('ui.refresh')}
            </button>
          </div>
        )}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { id: 'nursery', label: t('pageBody.tuition.maternelle') },
          { id: 'primary', label: t('pageBody.tuition.primaire') },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setLevel(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              level === tab.id
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-gray-600">
          <span>{t('pageBody.tuition.sortLabel')}</span>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
          >
            <option value="name">{t('pageBody.tuition.sortAz')}</option>
            <option value="class">{t('pageBody.tuition.sortClass')}</option>
          </select>
        </label>
        <select
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
        >
          <option value="all">{t('pageBody.tuition.allClasses')}</option>
          {classOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {t('pageBody.tuition.hintBefore')}{' '}
        <Link to={`/campus/${campusId}/finance`} className="text-brand-700 underline font-medium">
          {t('pages.finance.title')}
        </Link>
        {' '}{t(isPrimary ? 'pageBody.tuition.hintAfterPrimary' : 'pageBody.tuition.hintAfter')}
      </p>

      {message && (
        <div className="mb-3 p-3 rounded-lg text-sm bg-brand-50 text-brand-700 border border-brand-100">{message}</div>
      )}
      {error && (
        <div className="mb-3 p-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-100">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          {t('ui.loading')}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-max w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th rowSpan={3} className="sticky left-0 z-20 bg-gray-50 px-3 py-2 border-b border-r text-left">S/N</th>
                <th rowSpan={3} className="sticky left-10 z-20 bg-gray-50 px-3 py-2 border-b border-r text-left min-w-[160px]">
                  {t('pageBody.tuition.names')}
                </th>
                <th rowSpan={3} className="px-3 py-2 border-b border-r text-left">{t('pageBody.tuition.classes')}</th>
                {isPrimary ? (
                  <>
                    <th rowSpan={3} className="px-3 py-2 border-b border-r text-right">{t('pageBody.tuition.uniforms')}</th>
                    <th rowSpan={3} className="px-3 py-2 border-b border-r text-right">{t('pageBody.tuition.inscription')}</th>
                    <th rowSpan={3} className="px-3 py-2 border-b border-r text-right">{t('pageBody.tuition.dollar')}</th>
                    <th colSpan={3} className="px-3 py-2 border-b border-r text-center">{t('pageBody.tuition.activities')}</th>
                  </>
                ) : (
                  <>
                    <th rowSpan={3} className="px-3 py-2 border-b border-r text-right">{t('pageBody.tuition.dollar')}</th>
                    <th rowSpan={3} className="px-3 py-2 border-b border-r text-right">{t('pageBody.tuition.inscription')}</th>
                    <th rowSpan={3} className="px-3 py-2 border-b border-r text-right">{t('pageBody.tuition.confirmation')}</th>
                  </>
                )}
                <th rowSpan={3} className="px-3 py-2 border-b border-r text-right">{t('pageBody.tuition.carryOver')}</th>
                <th colSpan={4} className="px-3 py-2 border-b border-r text-center">{t('pageBody.tuition.firstTrimester')}</th>
                <th colSpan={4} className="px-3 py-2 border-b border-r text-center">{t('pageBody.tuition.secondTrimester')}</th>
                <th colSpan={4} className="px-3 py-2 border-b text-center">{t('pageBody.tuition.thirdTrimester')}</th>
              </tr>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                {isPrimary && ['activity1', 'activity2', 'activity3'].map((key) => (
                  <th key={key} rowSpan={2} className="px-2 py-1 border-b border-r text-center whitespace-nowrap">
                    {t(`pageBody.tuition.${key}`)}
                  </th>
                ))}
                {[1, 2, 3].map((n) => (
                  <th key={`sf-${n}`} colSpan={4} className="px-2 py-1 border-b border-r text-center">
                    {t('pageBody.tuition.schoolFees')}
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-50 text-gray-500 text-[11px]">
                {['amount', 'inst1', 'inst2', 'balance', 'amount', 'inst1', 'inst2', 'balance', 'amount', 'inst1', 'inst2', 'balance'].map((key, i) => (
                  <th key={`${key}-${i}`} className="px-2 py-1 border-b border-r font-medium whitespace-nowrap">
                    {t(`pageBody.tuition.col.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={isPrimary ? 22 : 19} className="text-center text-gray-500 py-12">
                    {t('pageBody.tuition.empty')}
                  </td>
                </tr>
              ) : visibleRows.map((row) => (
                <tr key={row.student.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-r text-xs text-gray-500">{row.sn}</td>
                  <td className="sticky left-10 z-10 bg-white px-3 py-1.5 border-r">
                    <p className="font-medium text-gray-900 text-xs">
                      {studentFullName(row.student)}
                    </p>
                    <p className="text-[10px] text-gray-400">{row.student.studentId}</p>
                  </td>
                  <td className="px-3 py-1.5 border-r text-xs">{row.branche || '—'}</td>
                  {isPrimary ? (
                    <>
                      <MoneyCell value={row.uniform?.due} />
                      <MoneyCell value={row.inscription?.due} />
                      <MoneyCell value={row.dollar?.due} currency="USD" />
                      <MoneyCell value={row.activities?.t1?.due} />
                      <MoneyCell value={row.activities?.t2?.due} />
                      <MoneyCell value={row.activities?.t3?.due} />
                    </>
                  ) : (
                    <>
                      <MoneyCell value={row.dollar?.due} currency="USD" />
                      <MoneyCell value={row.inscription?.due} />
                      <MoneyCell value={row.confirmation?.due} />
                    </>
                  )}
                  <MoneyCell value={row.carryOver?.due} />
                  {['t1', 't2', 't3'].map((key) => {
                    const tri = row.trimesters[key];
                    return (
                      <TrimesterCells
                        key={key}
                        campusId={campusId}
                        tri={tri}
                        onMarkPaid={markPaid}
                        markingId={markingId}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TrimesterCells({ campusId, tri, onMarkPaid, markingId }) {
  return (
    <>
      <MoneyCell value={tri.due} />
      <InstallmentCell campusId={campusId} cell={tri.inst1} onMarkPaid={onMarkPaid} markingId={markingId} />
      <InstallmentCell campusId={campusId} cell={tri.inst2} onMarkPaid={onMarkPaid} markingId={markingId} />
      <MoneyCell value={tri.balance} muted={tri.balance === 0} />
    </>
  );
}
