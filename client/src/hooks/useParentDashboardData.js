import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useParentDashboardData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    api.getParentDashboard()
      .then((result) => {
        setData({
          children: result.children || [],
          childrenWithoutLogin: result.childrenWithoutLogin || 0,
          unreadCount: result.unreadCount || 0,
          recentMessages: result.recentMessages || [],
          pendingFees: result.pendingFees || [],
          upcomingHomework: result.upcomingHomework || [],
          homeworkGrades: result.homeworkGrades || [],
          eLearningGrades: result.eLearningGrades || [],
          transport: result.transport || null,
          pendingRegistrations: result.pendingRegistrations || [],
        });
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
