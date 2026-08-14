import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import ListSearch, { matchesSearch } from '../components/ListSearch';
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

export default function Fees() {
  const { campusId } = useCampus();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isParent = user?.role === 'PARENT';
  const [fees, setFees] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const loadFees = () => api.getFees().then(setFees).catch(console.error);
  useEffect(() => { loadFees(); }, []);

  const handleDelete = async (id) => {
    if (!confirm(t('pageBody.fees.deleteConfirm'))) return;
    try {
      await api.deleteFee(id);
      loadFees();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.updateFeeStatus(id, status);
      loadFees();
    } catch (err) {
      alert(err.message);
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

  return (
    <div>
      <PageHeader
        title={isParent ? t('pages.fees.titleParent') : t('pages.fees.title')}
        description={isParent ? t('pages.fees.descriptionParent') : t('pages.fees.description')}
        action={!isParent && (
          <Link to={`/campus/${campusId}/fees/new`} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('pages.fees.newFee')}
          </Link>
        )}
      />

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
    </div>
  );
}
