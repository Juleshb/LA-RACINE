import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const EMPTY_FEE_STATS = {
  total: 0,
  paid: 0,
  pending: 0,
  overdue: 0,
  totalCollected: 0,
};

export function buildAccountantRegistrationBreakdown(students) {
  const statuses = { APPROVED: 0, PENDING: 0, AWAITING_CONFIRMATION: 0, REJECTED: 0 };
  for (const student of students) {
    const key = student.registrationStatus || 'PENDING';
    if (statuses[key] != null) statuses[key] += 1;
  }
  return [
    { name: 'Approved', value: statuses.APPROVED, color: '#65a30d' },
    { name: 'Awaiting confirmation', value: statuses.AWAITING_CONFIRMATION, color: '#3b82f6' },
    { name: 'Pending', value: statuses.PENDING, color: '#f59e0b' },
    { name: 'Rejected', value: statuses.REJECTED, color: '#ef4444' },
  ].filter((item) => item.value > 0);
}

export function buildFeesByType(fees) {
  const byType = {};
  for (const fee of fees) {
    const type = fee.feeType || 'OTHER';
    if (!byType[type]) byType[type] = { type, count: 0, amount: 0 };
    byType[type].count += 1;
    byType[type].amount += fee.amount || 0;
  }
  return Object.values(byType).sort((a, b) => b.amount - a.amount);
}

export function useAccountantDashboardData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    Promise.all([
      api.getFeeStats().catch(() => EMPTY_FEE_STATS),
      api.getFees().catch(() => []),
      api.getStudents(),
      api.getCommunicationUnreadCount().catch(() => ({ count: 0 })),
      api.getTransportOverview().catch(() => null),
    ])
      .then(([feeStats, fees, students, unread, transport]) => {
        const pendingFees = (fees || []).filter((f) => f.status === 'PENDING' || f.status === 'OVERDUE');
        const awaitingConfirmation = (students || []).filter(
          (s) => s.registrationStatus === 'AWAITING_CONFIRMATION',
        );

        setData({
          stats: feeStats || EMPTY_FEE_STATS,
          fees: fees || [],
          students: students || [],
          pendingFees,
          awaitingConfirmation,
          unreadCount: unread?.count ?? 0,
          transport,
          feesByType: buildFeesByType(fees || []),
        });
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
