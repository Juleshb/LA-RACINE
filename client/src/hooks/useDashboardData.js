import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const EMPTY_MARKS_STATS = {
  totalMarks: 0,
  byAssessment: [],
  byTerm: [],
  byClass: [],
  weeklyRecording: [],
};

const EMPTY_FEE_STATS = {
  total: 0,
  paid: 0,
  pending: 0,
  overdue: 0,
  totalCollected: 0,
};

export function useDashboardData({ campusId, includeUsers = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    const requests = [
      api.getAttendanceStats(),
      api.getFeeStats().catch(() => EMPTY_FEE_STATS),
      api.getStudents(),
      api.getClasses(),
      api.getTeachers(),
      api.getFees().catch(() => []),
      api.getMarksStats().catch(() => EMPTY_MARKS_STATS),
    ];

    if (includeUsers && campusId) {
      requests.push(api.getUsers(campusId));
    }

    Promise.all(requests)
      .then((results) => {
        const [
          attendance,
          feeStats,
          students,
          classes,
          teachers,
          fees,
          marksStats,
          users,
        ] = results;

        setData({
          stats: { ...attendance, ...feeStats },
          students,
          classes,
          teachers,
          fees: fees || [],
          marksStats: marksStats || EMPTY_MARKS_STATS,
          users: users || [],
        });
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [campusId, includeUsers]);

  return { data, loading, error };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function buildStudentsByClass(students, classes) {
  const counts = new Map(classes.map((cls) => [cls.id, { name: cls.name, count: 0 }]));
  let unassigned = 0;

  for (const student of students) {
    if (student.classId && counts.has(student.classId)) {
      counts.get(student.classId).count += 1;
    } else {
      unassigned += 1;
    }
  }

  const rows = [...counts.values()]
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (unassigned > 0) {
    rows.push({ name: 'Unassigned', count: unassigned });
  }

  return rows;
}

export function buildRegistrationBreakdown(students) {
  const statuses = { APPROVED: 0, PENDING: 0, REJECTED: 0 };
  for (const student of students) {
    const key = student.registrationStatus || 'PENDING';
    if (statuses[key] != null) statuses[key] += 1;
  }
  return [
    { name: 'Approved', value: statuses.APPROVED, color: '#65a30d' },
    { name: 'Pending', value: statuses.PENDING, color: '#f59e0b' },
    { name: 'Rejected', value: statuses.REJECTED, color: '#ef4444' },
  ].filter((item) => item.value > 0);
}
