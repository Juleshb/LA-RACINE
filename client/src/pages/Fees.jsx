import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Bell, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import ListSearch, { matchesSearch } from '../components/ListSearch';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { useTranslation } from '../context/LanguageContext';
import { SortableTh, useTableSort } from '../hooks/useTableSort';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', maximumFractionDigits: 0 }).format(amount);
}

const statusColors = {
  PENDING: 'badge-warning',
  PAID: 'badge-success',
  OVERDUE: 'badge-danger',
  WAIVED: 'badge-warning',
};

const FEE_STATUS_KEYS = {
  ALL: 'ui.all',
  PENDING: 'ui.pending',
  PAID: 'ui.paid',
  OVERDUE: 'ui.overdue',
  WAIVED: 'ui.waived',
};

const FEE_TYPE_KEYS = {
  TUITION: 'pageBody.fees.types.TUITION',
  REGISTRATION: 'pageBody.fees.types.REGISTRATION',
  EXAM: 'pageBody.fees.types.EXAM',
  TRANSPORT: 'pageBody.fees.types.TRANSPORT',
  UNIFORM: 'pageBody.fees.types.UNIFORM',
  OTHER: 'pageBody.fees.types.OTHER',
  CONFIRMATION: 'pageBody.fees.types.CONFIRMATION',
};

const FINANCE_ROLES = new Set(['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY', 'ACCOUNTANT']);

export default function Fees() {
  const { campusId } = useCampus();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isParent = user?.role === 'PARENT';
  const canFinanceTools = FINANCE_ROLES.has(user?.role);
  const [fees, setFees] = useState([]);
  const [confirmationQueue, setConfirmationQueue] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [markingId, setMarkingId] = useState(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [reminderError, setReminderError] = useState('');
  const [reminderResult, setReminderResult] = useState('');
  const [reminderForm, setReminderForm] = useState({
    scope: 'outstanding',
    feeType: '',
    title: '',
    body: '',
    sendEmail: true,
  });

  const loadFees = () => api.getFees().then(setFees).catch(console.error);
  const loadConfirmationQueue = () => {
    if (!canFinanceTools) return;
    api.getConfirmationQueue().then(setConfirmationQueue).catch(() => setConfirmationQueue([]));
  };

  useEffect(() => {
    loadFees();
    loadConfirmationQueue();
  }, [canFinanceTools]);

  const handleDelete = async (id) => {
    if (!confirm(t('pageBody.fees.deleteConfirm'))) return;
    try {
      await api.deleteFee(id);
      loadFees();
      loadConfirmationQueue();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.updateFeeStatus(id, status);
      loadFees();
      loadConfirmationQueue();
    } catch (err) {
      alert(err.message);
    }
  };

  const markConfirmationPaid = async (id) => {
    setMarkingId(id);
    try {
      await api.updateFeeStatus(id, 'PAID');
      loadFees();
      loadConfirmationQueue();
    } catch (err) {
      alert(err.message);
    } finally {
      setMarkingId(null);
    }
  };

  const openReminders = (preferredScope) => {
    setReminderError('');
    setReminderResult('');
    setReminderForm({
      scope: preferredScope === 'confirmation' && confirmationQueue.length
        ? 'confirmation'
        : 'outstanding',
      feeType: '',
      title: t('pageBody.fees.reminderDefaultTitle'),
      body: '',
      sendEmail: true,
    });
    setReminderOpen(true);
  };

  const sendReminders = async (e) => {
    e.preventDefault();
    setReminderSubmitting(true);
    setReminderError('');
    setReminderResult('');
    try {
      const payload = {
        title: reminderForm.title || undefined,
        body: reminderForm.body || undefined,
        sendEmail: reminderForm.sendEmail,
        statuses: ['PENDING', 'OVERDUE'],
      };
      if (reminderForm.scope === 'confirmation') {
        payload.feeType = 'CONFIRMATION';
        payload.feeIds = confirmationQueue.map((f) => f.id);
      } else if (reminderForm.feeType) {
        payload.feeType = reminderForm.feeType;
      }

      const result = await api.sendFeeReminders(payload);
      setReminderResult(t('pageBody.fees.reminderSuccess', {
        parents: result.parentsNotified || 0,
        fees: result.outstandingFees || 0,
        emails: result.emailsSent || 0,
      }));
      setReminderOpen(false);
    } catch (err) {
      setReminderError(err.message || t('pageBody.fees.reminderFailed'));
    } finally {
      setReminderSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const byStatus = filter === 'ALL' ? fees : fees.filter((f) => f.status === filter);
    return byStatus.filter((fee) => matchesSearch(
      search,
      fee.receiptNumber,
      fee.student?.firstName,
      fee.student?.lastName,
      fee.student?.postName,
      fee.student?.studentId,
      fee.feeType,
      FEE_TYPE_KEYS[fee.feeType] ? t(FEE_TYPE_KEYS[fee.feeType]) : '',
      fee.amount,
    ));
  }, [fees, filter, search, t]);

  const getFeeSortValue = useCallback((fee, key) => {
    switch (key) {
      case 'receipt': return fee.receiptNumber || '';
      case 'student': return `${fee.student?.lastName || ''} ${fee.student?.firstName || ''}`.trim();
      case 'feeType': return fee.feeType || '';
      case 'amount': return Number(fee.amount) || 0;
      case 'dueDate': return fee.dueDate ? new Date(fee.dueDate) : null;
      case 'status': return fee.status || '';
      default: return '';
    }
  }, []);

  const { sorted: sortedFees, sortKey, sortDir, toggleSort } = useTableSort(
    filtered,
    getFeeSortValue,
    { initialKey: 'student' },
  );

  const outstandingCount = fees.filter((f) => f.status === 'PENDING' || f.status === 'OVERDUE').length;

  return (
    <div>
      <PageHeader
        title={isParent ? t('pages.fees.titleParent') : t('pages.fees.title')}
        description={isParent ? t('pages.fees.descriptionParent') : t('pages.fees.description')}
        action={!isParent && (
          <div className="flex flex-wrap items-center gap-2">
            {canFinanceTools && (
              <Link to={`/campus/${campusId}/finance`} className="btn-secondary flex items-center gap-2">
                {t('pages.finance.title')}
              </Link>
            )}
            {canFinanceTools && outstandingCount > 0 && (
              <button type="button" onClick={() => openReminders('outstanding')} className="btn-secondary flex items-center gap-2">
                <Bell className="w-4 h-4" />
                {t('pageBody.fees.sendReminders')}
              </button>
            )}
            <Link to={`/campus/${campusId}/fees/new`} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {t('pages.fees.newFee')}
            </Link>
          </div>
        )}
      />

      {reminderResult && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-brand-50 text-brand-700 border border-brand-100">
          {reminderResult}
        </div>
      )}

      {canFinanceTools && confirmationQueue.length > 0 && (
        <div className="card mb-6 border-blue-200 bg-blue-50/40">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{t('pageBody.fees.confirmationQueueTitle')}</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {t('pageBody.fees.confirmationQueueDesc', { count: confirmationQueue.length })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openReminders('confirmation')}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" />
              {t('pageBody.fees.remindConfirmation')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-blue-100">
                  <th className="pb-2 font-medium">{t('ui.student')}</th>
                  <th className="pb-2 font-medium">{t('ui.class')}</th>
                  <th className="pb-2 font-medium">{t('ui.amount')}</th>
                  <th className="pb-2 font-medium">{t('ui.dueDate')}</th>
                  <th className="pb-2 font-medium">{t('ui.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {confirmationQueue.map((fee) => (
                  <tr key={fee.id} className="border-b border-blue-50 last:border-0">
                    <td className="py-2.5">
                      <Link to={`/campus/${campusId}/fees/${fee.id}`} className="font-medium text-brand-700 hover:underline">
                        {fee.student.firstName} {fee.student.lastName}
                      </Link>
                      <p className="text-xs text-gray-500">{fee.student.studentId}</p>
                    </td>
                    <td className="py-2.5 text-gray-600">{fee.student.class?.name || '—'}</td>
                    <td className="py-2.5 font-medium">{formatCurrency(fee.amount)}</td>
                    <td className="py-2.5 text-gray-500">{new Date(fee.dueDate).toLocaleDateString()}</td>
                    <td className="py-2.5">
                      <button
                        type="button"
                        disabled={markingId === fee.id}
                        onClick={() => markConfirmationPaid(fee.id)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                      >
                        {markingId === fee.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        {t('pageBody.fees.markPaidEnroll')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <ListSearch
          value={search}
          onChange={setSearch}
          placeholder={`${t('ui.search')} student, receipt, fee type…`}
          className="min-w-[220px] flex-1 max-w-md"
        />
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'PENDING', 'PAID', 'OVERDUE', 'WAIVED'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === s ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t(FEE_STATUS_KEYS[s])}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {sortedFees.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {fees.length > 0 && search.trim() ? t('ui.noSearchResults') : t('pageBody.fees.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <SortableTh label={t('ui.receiptNo')} columnKey="receipt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label={t('ui.student')} columnKey="student" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label={t('ui.feeType')} columnKey="feeType" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label={t('ui.amount')} columnKey="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label={t('ui.dueDate')} columnKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label={t('ui.status')} columnKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  {!isParent && <th className="pb-3 font-medium">{t('ui.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {sortedFees.map((fee) => (
                  <tr key={fee.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3">
                      <Link to={`/campus/${campusId}/fees/${fee.id}`} className="text-brand-600 hover:underline font-medium">
                        {fee.receiptNumber}
                      </Link>
                    </td>
                    <td className="py-3">{fee.student.firstName} {fee.student.lastName}</td>
                    <td className="py-3 text-gray-400">{FEE_TYPE_KEYS[fee.feeType] ? t(FEE_TYPE_KEYS[fee.feeType]) : fee.feeType}</td>
                    <td className="py-3 font-medium">{formatCurrency(fee.amount)}</td>
                    <td className="py-3 text-gray-400">{new Date(fee.dueDate).toLocaleDateString()}</td>
                    <td className="py-3">
                      {isParent ? (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[fee.status]}`}>
                          {FEE_STATUS_KEYS[fee.status] ? t(FEE_STATUS_KEYS[fee.status]) : fee.status}
                        </span>
                      ) : (
                        <select
                          value={fee.status}
                          onChange={(e) => handleStatusChange(fee.id, e.target.value)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${statusColors[fee.status]}`}
                        >
                          <option value="PENDING">{t('ui.pending')}</option>
                          <option value="PAID">{t('ui.paid')}</option>
                          <option value="OVERDUE">{t('ui.overdue')}</option>
                          <option value="WAIVED">{t('ui.waived')}</option>
                        </select>
                      )}
                    </td>
                    {!isParent && (
                      <td className="py-3">
                        <button onClick={() => handleDelete(fee.id)} className="p-1.5 text-gray-400 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FormModeModal
        open={reminderOpen}
        mode="create"
        title={t('pageBody.fees.reminderModalTitle')}
        subtitle={t('pageBody.fees.reminderModalSubtitle')}
        onClose={() => { setReminderOpen(false); setReminderError(''); }}
        onSubmit={sendReminders}
        formId="fee-reminder-form"
        submitLabel={reminderSubmitting ? t('pageBody.fees.sendingReminders') : t('pageBody.fees.sendReminders')}
        submitting={reminderSubmitting}
        error={reminderError}
      >
        <FormSection title={t('pageBody.fees.reminderScope')}>
          <div>
            <label className="label">{t('pageBody.fees.reminderWho')}</label>
            <select
              className="input"
              value={reminderForm.scope}
              onChange={(e) => setReminderForm({ ...reminderForm, scope: e.target.value })}
            >
              <option value="outstanding">{t('pageBody.fees.reminderAllOutstanding')}</option>
              <option value="confirmation" disabled={!confirmationQueue.length}>
                {t('pageBody.fees.reminderConfirmationOnly', { count: confirmationQueue.length })}
              </option>
            </select>
          </div>
          {reminderForm.scope === 'outstanding' && (
            <div>
              <label className="label">{t('ui.feeType')}</label>
              <select
                className="input"
                value={reminderForm.feeType}
                onChange={(e) => setReminderForm({ ...reminderForm, feeType: e.target.value })}
              >
                <option value="">{t('ui.all')}</option>
                {Object.keys(FEE_TYPE_KEYS).map((type) => (
                  <option key={type} value={type}>{t(FEE_TYPE_KEYS[type])}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">{t('pageBody.fees.reminderTitle')}</label>
            <input
              className="input"
              value={reminderForm.title}
              onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
              placeholder={t('pageBody.fees.reminderDefaultTitle')}
            />
          </div>
          <div>
            <label className="label">{t('pageBody.fees.reminderBody')}</label>
            <textarea
              className="input min-h-[100px]"
              value={reminderForm.body}
              onChange={(e) => setReminderForm({ ...reminderForm, body: e.target.value })}
              placeholder={t('pageBody.fees.reminderBodyPlaceholder')}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={reminderForm.sendEmail}
              onChange={(e) => setReminderForm({ ...reminderForm, sendEmail: e.target.checked })}
            />
            {t('pageBody.fees.reminderAlsoEmail')}
          </label>
        </FormSection>
      </FormModeModal>
    </div>
  );
}
