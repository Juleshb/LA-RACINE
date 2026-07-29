import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useTeacherDashboardData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    api.getTeacherDashboard()
      .then((result) => {
        setData({
          classes: result.classes || [],
          courses: result.courses || [],
          courseCount: result.courseCount || 0,
          studentCount: result.studentCount || 0,
          todaySchedule: result.todaySchedule || [],
          unreadCount: result.unreadCount || 0,
          recentMessages: result.recentMessages || [],
          upcomingHomework: result.upcomingHomework || [],
          attendanceToday: result.attendanceToday || {
            present: 0, absent: 0, late: 0, excused: 0, total: 0, marked: 0,
          },
        });
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
