import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Eye, Clock, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';
import { SortableTh, useTableSort } from '../hooks/useTableSort';

const STATUS = {
  PENDING: { label: 'Pending review', className: 'bg-amber-50 text-amber-700', icon: Clock },
  APPROVED: { label: 'Approved', className: 'bg-green-50 text-green-700', icon: CheckCircle },
  REJECTED: { label: 'Rejected', className: 'bg-red-50 text-red-600', icon: XCircle },
};

export default function ParentMyRegistrations() {
  const { campusId } = useCampus();
  const { t } = useTranslation();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getParentRegistrations()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getRegSortValue = useCallback((row, key) => {
    switch (key) {
      case 'name': return `${row.lastName || ''} ${row.postName || ''} ${row.firstName || ''}`.trim();
      case 'studentId': return row.studentId || '';
      case 'class': return row.class?.name || row.registrationClass || '';
      case 'createdAt': return row.createdAt ? new Date(row.createdAt) : null;
      case 'status': return row.registrationStatus || '';
      default: return '';
    }
  }, []);

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    items,
    getRegSortValue,
    { initialKey: 'createdAt', initialDir: 'desc' },
  );

  return (
    <div>
      <PageHeader
        title={t('pages.myRegistrations.title')}
        description={t('pages.myRegistrations.description')}
        action={(
          <Link to={`/campus/${campusId}/register-child`} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('pages.myRegistrations.registerChild')}
          </Link>
        )}
      />

      {location.state?.message && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
          {location.state.message}
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="text-center py-12 text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">You have not submitted any registration applications yet.</p>
            <Link to={`/campus/${campusId}/register-child`} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Register your child
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <SortableTh label="Child" columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="Reference" columnKey="studentId" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="Class requested" columnKey="class" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="Submitted" columnKey="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="Status" columnKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => {
                  const status = STATUS[item.registrationStatus] || STATUS.PENDING;
                  const StatusIcon = status.icon;
                  return (
                    <tr key={item.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 font-medium">
                        {item.lastName} {item.postName} {item.firstName}
                      </td>
                      <td className="py-3 text-brand-600">{item.studentId}</td>
                      <td className="py-3">{item.class?.name || item.registrationClass || '—'}</td>
                      <td className="py-3 text-gray-400 text-sm">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3">
                        <Link
                          to={`/campus/${campusId}/my-registrations/${item.id}`}
                          className="p-1.5 inline-flex text-gray-400 hover:text-brand-600"
                          title="View application"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
