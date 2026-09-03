import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote, Bus, Calculator, ClipboardList, Loader2, Plus, RefreshCw, Trash2, Wand2,
} from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { useTranslation } from '../context/LanguageContext';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

const FEE_TYPES = [
  'TUITION', 'REGISTRATION', 'CONFIRMATION', 'EXAM', 'TRANSPORT', 'UNIFORM',
  'EXTRACURRICULAR', 'CARRY_OVER', 'OTHER',
];

const FEE_TERMS = [
  { value: '', labelKey: 'pageBody.finance.termNone' },
  { value: 'ANNUAL', labelKey: 'pageBody.finance.termAnnual' },
  { value: 'TRIMESTRE_1', labelKey: 'pageBody.finance.termT1' },
  { value: 'TRIMESTRE_2', labelKey: 'pageBody.finance.termT2' },
  { value: 'TRIMESTRE_3', labelKey: 'pageBody.finance.termT3' },
  { value: 'PRIOR_YEAR', labelKey: 'pageBody.finance.termPrior' },
];

const TABS = [
  { id: 'cash', icon: Banknote, labelKey: 'pageBody.finance.tabCash' },
  { id: 'structures', icon: Calculator, labelKey: 'pageBody.finance.tabStructures' },
  { id: 'debtors', icon: ClipboardList, labelKey: 'pageBody.finance.tabDebtors' },
  { id: 'transport', icon: Bus, labelKey: 'pageBody.finance.tabTransport' },
  { id: 'banks', icon: Banknote, labelKey: 'pageBody.finance.tabBanks' },
];

function defaultInstallmentsFor(feeType, term) {
  if (feeType === 'TUITION' && ['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'].includes(term)) {
    return '2';
  }
  return '1';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function FinanceDesk() {
  const { campusId } = useCampus();
  const { t } = useTranslation();
  const [tab, setTab] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [cashFrom, setCashFrom] = useState(monthStartIso());
  const [cashTo, setCashTo] = useState(todayIso());
  const [cashReport, setCashReport] = useState(null);

  const [structures, setStructures] = useState([]);
  const [classes, setClasses] = useState([]);
  const [structureFormOpen, setStructureFormOpen] = useState(false);
  const [structureSubmitting, setStructureSubmitting] = useState(false);
  const [structureForm, setStructureForm] = useState({
    feeType: 'TUITION',
    term: 'TRIMESTRE_1',
    amount: '',
    classId: '',
    label: '',
    installments: '2',
    dueDate: '',
  });
  const [generatingId, setGeneratingId] = useState(null);

  const [debtors, setDebtors] = useState(null);
  const [transportUnpaid, setTransportUnpaid] = useState(null);
  const [school, setSchool] = useState(null);

  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountFee, setDiscountFee] = useState(null);
  const [discountForm, setDiscountForm] = useState({ discountAmount: '', discountReason: '', waive: false });
  const [discountSubmitting, setDiscountSubmitting] = useState(false);

  const loadCash = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getCashReport({ from: cashFrom, to: cashTo });
      setCashReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [cashFrom, cashTo]);

  const loadStructures = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, cls] = await Promise.all([
        api.getFeeStructures(),
        api.getClasses().catch(() => []),
      ]);
      setStructures(rows || []);
      setClasses(cls || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDebtors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDebtors(await api.getDebtors());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTransport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTransportUnpaid(await api.getTransportUnpaidFees());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBanks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSchool(await api.getSchool());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMessage('');
    if (tab === 'cash') loadCash();
    else if (tab === 'structures') loadStructures();
    else if (tab === 'debtors') loadDebtors();
    else if (tab === 'transport') loadTransport();
    else if (tab === 'banks') loadBanks();
  }, [tab, loadCash, loadStructures, loadDebtors, loadTransport, loadBanks]);

  const feeTypeLabel = (type) => {
    const key = `pageBody.fees.types.${type}`;
    const translated = t(key);
    return translated === key ? type : translated;
  };

  const termLabel = (term) => {
    if (!term) return '—';
    const map = {
      ANNUAL: 'pageBody.finance.termAnnual',
      TRIMESTRE_1: 'pageBody.finance.termT1',
      TRIMESTRE_2: 'pageBody.finance.termT2',
      TRIMESTRE_3: 'pageBody.finance.termT3',
      PRIOR_YEAR: 'pageBody.finance.termPrior',
    };
    return map[term] ? t(map[term]) : term;
  };

  const createStructure = async (e) => {
    e.preventDefault();
    setStructureSubmitting(true);
    setError('');
    try {
      await api.createFeeStructure({
        feeType: structureForm.feeType,
        term: structureForm.term || null,
        amount: Number(structureForm.amount),
        classId: structureForm.classId || null,
        label: structureForm.label || null,
        installments: Number(structureForm.installments) || 1,
        dueDate: structureForm.dueDate || null,
      });
      setStructureFormOpen(false);
      setMessage(t('pageBody.finance.structureSaved'));
      loadStructures();
    } catch (err) {
      setError(err.message);
    } finally {
      setStructureSubmitting(false);
    }
  };

  const generateBills = async (structure) => {
    if (!confirm(t('pageBody.finance.generateConfirm', {
      type: feeTypeLabel(structure.feeType),
      class: structure.class?.name || t('pageBody.finance.allClasses'),
    }))) return;
    setGeneratingId(structure.id);
    setError('');
    try {
      const result = await api.generateFeesFromStructure(structure.id);
      setMessage(t('pageBody.finance.generateSuccess', {
        created: result.created,
        skipped: result.skipped,
        students: result.students,
      }));
      loadStructures();
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingId(null);
    }
  };

  const deleteStructure = async (id) => {
    if (!confirm(t('pageBody.finance.deleteStructureConfirm'))) return;
    try {
      await api.deleteFeeStructure(id);
      loadStructures();
    } catch (err) {
      alert(err.message);
    }
  };

  const openDiscount = (fee) => {
    setDiscountFee(fee);
    setDiscountForm({
      discountAmount: String(fee.discountAmount || ''),
      discountReason: fee.discountReason || '',
      waive: fee.status === 'WAIVED',
    });
    setDiscountOpen(true);
  };

  const applyDiscount = async (e) => {
    e.preventDefault();
    if (!discountFee) return;
    setDiscountSubmitting(true);
    try {
      await api.applyFeeDiscount(discountFee.id, {
        discountAmount: Number(discountForm.discountAmount) || 0,
        discountReason: discountForm.discountReason,
        waive: discountForm.waive,
      });
      setDiscountOpen(false);
      setMessage(t('pageBody.finance.discountApplied'));
      loadDebtors();
    } catch (err) {
      setError(err.message);
    } finally {
      setDiscountSubmitting(false);
    }
  };

  const exportDebtorsCsv = () => {
    if (!debtors?.debtors?.length) return;
    const rows = [['Student ID', 'Name', 'Class', 'Total due', 'Oldest overdue days', 'Parent phone']];
    for (const d of debtors.debtors) {
      rows.push([
        d.student.studentId,
        `${d.student.firstName} ${d.student.lastName}`,
        d.student.class?.name || '',
        d.totalDue,
        d.oldestOverdueDays,
        d.student.parent?.phone || d.student.parent?.user?.phone || '',
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debtors-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCashCsv = () => {
    if (!cashReport?.receipts?.length) return;
    const rows = [['Receipt', 'Date', 'Student', 'Class', 'Type', 'Amount']];
    for (const f of cashReport.receipts) {
      rows.push([
        f.receiptNumber,
        f.paidDate ? new Date(f.paidDate).toLocaleDateString() : '',
        `${f.student.firstName} ${f.student.lastName}`,
        f.student.class?.name || '',
        f.feeType,
        f.amount,
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-report-${cashFrom}-${cashTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bucketCards = useMemo(() => {
    if (!debtors?.buckets) return [];
    return [
      { key: 'current', label: t('pageBody.finance.bucketCurrent'), value: debtors.buckets.current },
      { key: 'd1_30', label: t('pageBody.finance.bucket1_30'), value: debtors.buckets.d1_30 },
      { key: 'd31_60', label: t('pageBody.finance.bucket31_60'), value: debtors.buckets.d31_60 },
      { key: 'd61_90', label: t('pageBody.finance.bucket61_90'), value: debtors.buckets.d61_90 },
      { key: 'd90plus', label: t('pageBody.finance.bucket90plus'), value: debtors.buckets.d90plus },
    ];
  }, [debtors, t]);

  return (
    <div>
      <PageHeader
        title={t('pages.finance.title')}
        description={t('pages.finance.description')}
        action={(
          <div className="flex flex-wrap gap-2">
            <Link to={`/campus/${campusId}/tuition-ledger`} className="btn-secondary text-sm">
              {t('pages.tuitionLedger.title')}
            </Link>
            <Link to={`/campus/${campusId}/fees`} className="btn-secondary text-sm">
              {t('pages.fees.title')}
            </Link>
            <Link to={`/campus/${campusId}/fees/new`} className="btn-primary text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              {t('pages.fees.newFee')}
            </Link>
          </div>
        )}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
              tab === id
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-brand-50 text-brand-700 border border-brand-100">{message}</div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-100">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          {t('ui.loading')}
        </div>
      )}

      {!loading && tab === 'cash' && cashReport && (
        <div className="space-y-6">
          <div className="card flex flex-wrap items-end gap-3">
            <div>
              <label className="label">{t('pageBody.finance.from')}</label>
              <input type="date" className="input" value={cashFrom} onChange={(e) => setCashFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">{t('pageBody.finance.to')}</label>
              <input type="date" className="input" value={cashTo} onChange={(e) => setCashTo(e.target.value)} />
            </div>
            <button type="button" onClick={loadCash} className="btn-secondary flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4" />
              {t('ui.refresh')}
            </button>
            <button type="button" onClick={exportCashCsv} className="btn-secondary">
              {t('pageBody.finance.exportCsv')}
            </button>
            <button type="button" onClick={() => window.print()} className="btn-secondary print:hidden">
              {t('ui.print')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">{t('pageBody.finance.collected')}</p>
              <p className="text-2xl font-semibold mt-1">{formatCurrency(cashReport.totalCollected)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">{t('pageBody.finance.receipts')}</p>
              <p className="text-2xl font-semibold mt-1">{cashReport.receiptCount}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">{t('pageBody.finance.feeTypes')}</p>
              <p className="text-2xl font-semibold mt-1">{cashReport.byType?.length || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold mb-3">{t('pageBody.finance.byType')}</h3>
              {!cashReport.byType?.length ? (
                <p className="text-sm text-gray-500">{t('pageBody.finance.noCollections')}</p>
              ) : (
                <ul className="space-y-2">
                  {cashReport.byType.map((row) => (
                    <li key={row.feeType} className="flex justify-between text-sm">
                      <span>{feeTypeLabel(row.feeType)} · {row.count}</span>
                      <span className="font-medium">{formatCurrency(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card">
              <h3 className="font-semibold mb-3">{t('pageBody.finance.byDay')}</h3>
              {!cashReport.byDay?.length ? (
                <p className="text-sm text-gray-500">{t('pageBody.finance.noCollections')}</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-auto">
                  {cashReport.byDay.map((row) => (
                    <li key={row.date} className="flex justify-between text-sm">
                      <span>{row.date} · {row.count}</span>
                      <span className="font-medium">{formatCurrency(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card overflow-x-auto">
            <h3 className="font-semibold mb-3">{t('pageBody.finance.recentReceipts')}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">{t('ui.receiptNo')}</th>
                  <th className="pb-2">{t('ui.student')}</th>
                  <th className="pb-2">{t('ui.feeType')}</th>
                  <th className="pb-2">{t('ui.amount')}</th>
                  <th className="pb-2">{t('pageBody.finance.paidOn')}</th>
                </tr>
              </thead>
              <tbody>
                {(cashReport.receipts || []).map((fee) => (
                  <tr key={fee.id} className="border-b border-gray-50">
                    <td className="py-2">
                      <Link className="text-brand-600 hover:underline" to={`/campus/${campusId}/fees/${fee.id}`}>
                        {fee.receiptNumber}
                      </Link>
                    </td>
                    <td className="py-2">{fee.student.firstName} {fee.student.lastName}</td>
                    <td className="py-2">{feeTypeLabel(fee.feeType)}</td>
                    <td className="py-2 font-medium">{formatCurrency(fee.amount)}</td>
                    <td className="py-2 text-gray-500">
                      {fee.paidDate ? new Date(fee.paidDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'structures' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary flex items-center gap-1.5"
              onClick={() => {
                setStructureForm({
                  feeType: 'TUITION',
                  term: 'TRIMESTRE_1',
                  amount: '',
                  classId: '',
                  label: '',
                  installments: '2',
                  dueDate: '',
                });
                setStructureFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              {t('pageBody.finance.addStructure')}
            </button>
          </div>

          {!structures.length ? (
            <div className="card text-center py-10 text-gray-500">
              {t('pageBody.finance.noStructures')}
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">{t('ui.feeType')}</th>
                    <th className="pb-2">{t('pageBody.finance.term')}</th>
                    <th className="pb-2">{t('ui.class')}</th>
                    <th className="pb-2">{t('pageBody.finance.label')}</th>
                    <th className="pb-2">{t('ui.amount')}</th>
                    <th className="pb-2">{t('pageBody.finance.installments')}</th>
                    <th className="pb-2">{t('ui.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {structures.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="py-2.5">{feeTypeLabel(s.feeType)}</td>
                      <td className="py-2.5 text-gray-500">{termLabel(s.term)}</td>
                      <td className="py-2.5">{s.class?.name || t('pageBody.finance.allClasses')}</td>
                      <td className="py-2.5 text-gray-500">{s.label || '—'}</td>
                      <td className="py-2.5 font-medium">{formatCurrency(s.amount)}</td>
                      <td className="py-2.5">{s.installments}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={generatingId === s.id}
                            onClick={() => generateBills(s)}
                            className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800 disabled:opacity-50"
                          >
                            {generatingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            {t('pageBody.finance.billClass')}
                          </button>
                          <button type="button" onClick={() => deleteStructure(s.id)} className="text-gray-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'debtors' && debtors && (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-between gap-3 items-center">
            <div>
              <p className="text-sm text-gray-500">{t('pageBody.finance.outstandingTotal')}</p>
              <p className="text-2xl font-semibold">{formatCurrency(debtors.totalOutstanding)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {t('pageBody.finance.debtorSummary', {
                  debtors: debtors.debtorCount,
                  fees: debtors.feeCount,
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={exportDebtorsCsv}>
                {t('pageBody.finance.exportCsv')}
              </button>
              <Link to={`/campus/${campusId}/fees`} className="btn-secondary">
                {t('pageBody.fees.sendReminders')}
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {bucketCards.map((b) => (
              <div key={b.key} className="card py-3">
                <p className="text-xs text-gray-500">{b.label}</p>
                <p className="font-semibold mt-1">{formatCurrency(b.value)}</p>
              </div>
            ))}
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">{t('ui.student')}</th>
                  <th className="pb-2">{t('ui.class')}</th>
                  <th className="pb-2">{t('pageBody.finance.totalDue')}</th>
                  <th className="pb-2">{t('pageBody.finance.overdueDays')}</th>
                  <th className="pb-2">{t('ui.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {debtors.debtors.map((d) => (
                  <tr key={d.student.id} className="border-b border-gray-50 align-top">
                    <td className="py-2.5">
                      <p className="font-medium">{d.student.firstName} {d.student.lastName}</p>
                      <p className="text-xs text-gray-500">{d.student.studentId}</p>
                    </td>
                    <td className="py-2.5">{d.student.class?.name || '—'}</td>
                    <td className="py-2.5 font-medium">{formatCurrency(d.totalDue)}</td>
                    <td className="py-2.5">{d.oldestOverdueDays}</td>
                    <td className="py-2.5 space-y-1">
                      {d.fees.slice(0, 4).map((fee) => (
                        <div key={fee.id} className="flex flex-wrap items-center gap-2 text-xs">
                          <Link to={`/campus/${campusId}/fees/${fee.id}`} className="text-brand-600 hover:underline">
                            {feeTypeLabel(fee.feeType)} · {formatCurrency(fee.amount)}
                          </Link>
                          <button type="button" className="text-amber-700 hover:underline" onClick={() => openDiscount(fee)}>
                            {t('pageBody.finance.discount')}
                          </button>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!debtors.debtors.length && (
              <p className="text-center text-gray-500 py-8">{t('pageBody.finance.noDebtors')}</p>
            )}
          </div>
        </div>
      )}

      {!loading && tab === 'transport' && transportUnpaid && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">{t('pageBody.finance.transportUnpaidCount')}</p>
              <p className="text-2xl font-semibold mt-1">{transportUnpaid.count}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">{t('pageBody.finance.transportUnpaidTotal')}</p>
              <p className="text-2xl font-semibold mt-1">{formatCurrency(transportUnpaid.total)}</p>
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">{t('ui.student')}</th>
                  <th className="pb-2">{t('pageBody.finance.route')}</th>
                  <th className="pb-2">{t('ui.amount')}</th>
                  <th className="pb-2">{t('ui.dueDate')}</th>
                  <th className="pb-2">{t('ui.status')}</th>
                </tr>
              </thead>
              <tbody>
                {(transportUnpaid.fees || []).map((fee) => (
                  <tr key={fee.id} className="border-b border-gray-50">
                    <td className="py-2">
                      <Link to={`/campus/${campusId}/fees/${fee.id}`} className="text-brand-600 hover:underline">
                        {fee.student.firstName} {fee.student.lastName}
                      </Link>
                    </td>
                    <td className="py-2">{fee.routeName || '—'}</td>
                    <td className="py-2 font-medium">{formatCurrency(fee.amount)}</td>
                    <td className="py-2">{new Date(fee.dueDate).toLocaleDateString()}</td>
                    <td className="py-2">{fee.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!transportUnpaid.fees?.length && (
              <p className="text-center text-gray-500 py-8">{t('pageBody.finance.noTransportUnpaid')}</p>
            )}
          </div>
        </div>
      )}

      {!loading && tab === 'banks' && (
        <div className="card space-y-4">
          <div className="flex justify-between items-start gap-3">
            <div>
              <h3 className="font-semibold">{t('pageBody.finance.paymentAccounts')}</h3>
              <p className="text-sm text-gray-500 mt-1">{t('pageBody.finance.paymentAccountsDesc')}</p>
            </div>
            <Link to={`/campus/${campusId}/school`} className="btn-secondary text-sm">
              {t('staffDash.manager.schoolProfile')}
            </Link>
          </div>
          {!school?.bankAccounts?.length ? (
            <p className="text-sm text-gray-500">{t('pageBody.finance.noBankAccounts')}</p>
          ) : (
            <ul className="space-y-3">
              {school.bankAccounts.map((acc) => (
                <li key={acc.id} className="rounded-lg border border-gray-100 p-3">
                  <p className="font-medium">{acc.bankName}</p>
                  <p className="text-sm text-gray-600 mt-1">{acc.accountNumber}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <FormModeModal
        open={structureFormOpen}
        mode="create"
        title={t('pageBody.finance.addStructure')}
        subtitle={t('pageBody.finance.addStructureSubtitle')}
        onClose={() => setStructureFormOpen(false)}
        onSubmit={createStructure}
        formId="fee-structure-form"
        submitLabel={structureSubmitting ? t('ui.saving') : t('ui.save')}
        submitting={structureSubmitting}
        error={error}
      >
        <FormSection title={t('pageBody.finance.structureDetails')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">{t('ui.feeType')}</label>
              <select
                className="input"
                value={structureForm.feeType}
                onChange={(e) => {
                  const feeType = e.target.value;
                  const term = structureForm.term;
                  setStructureForm({
                    ...structureForm,
                    feeType,
                    installments: defaultInstallmentsFor(feeType, term),
                  });
                }}
              >
                {FEE_TYPES.map((type) => (
                  <option key={type} value={type}>{feeTypeLabel(type)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('pageBody.finance.term')}</label>
              <select
                className="input"
                value={structureForm.term}
                onChange={(e) => {
                  const term = e.target.value;
                  setStructureForm({
                    ...structureForm,
                    term,
                    installments: defaultInstallmentsFor(structureForm.feeType, term),
                  });
                }}
              >
                {FEE_TERMS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('ui.amount')} (RWF)</label>
              <input className="input" type="number" min="0" required value={structureForm.amount} onChange={(e) => setStructureForm({ ...structureForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('ui.class')}</label>
              <select className="input" value={structureForm.classId} onChange={(e) => setStructureForm({ ...structureForm, classId: e.target.value })}>
                <option value="">{t('pageBody.finance.allClasses')}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('pageBody.finance.installments')}</label>
              <input className="input" type="number" min="1" max="12" value={structureForm.installments} onChange={(e) => setStructureForm({ ...structureForm, installments: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('pageBody.finance.label')}</label>
              <input className="input" placeholder="Trimestre 1" value={structureForm.label} onChange={(e) => setStructureForm({ ...structureForm, label: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('ui.dueDate')}</label>
              <input className="input" type="date" value={structureForm.dueDate} onChange={(e) => setStructureForm({ ...structureForm, dueDate: e.target.value })} />
            </div>
          </div>
        </FormSection>
      </FormModeModal>

      <FormModeModal
        open={discountOpen}
        mode="edit"
        title={t('pageBody.finance.discountTitle')}
        subtitle={discountFee ? `${feeTypeLabel(discountFee.feeType)} · ${formatCurrency(discountFee.amount)}` : ''}
        onClose={() => setDiscountOpen(false)}
        onSubmit={applyDiscount}
        formId="fee-discount-form"
        submitLabel={discountSubmitting ? t('ui.saving') : t('pageBody.finance.applyDiscount')}
        submitting={discountSubmitting}
        error={error}
      >
        <FormSection title={t('pageBody.finance.discountDetails')}>
          <div>
            <label className="label">{t('pageBody.finance.discountAmount')}</label>
            <input
              className="input"
              type="number"
              min="0"
              value={discountForm.discountAmount}
              onChange={(e) => setDiscountForm({ ...discountForm, discountAmount: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('pageBody.finance.discountReason')}</label>
            <textarea
              className="input min-h-[80px]"
              required
              value={discountForm.discountReason}
              onChange={(e) => setDiscountForm({ ...discountForm, discountReason: e.target.value })}
              placeholder={t('pageBody.finance.discountReasonPlaceholder')}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={discountForm.waive}
              onChange={(e) => setDiscountForm({ ...discountForm, waive: e.target.checked })}
            />
            {t('pageBody.finance.waiveFully')}
          </label>
        </FormSection>
      </FormModeModal>
    </div>
  );
}
