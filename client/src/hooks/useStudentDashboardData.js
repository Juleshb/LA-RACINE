import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useStudentDashboardData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    api.getStudentDashboard()
      .then((result) => {
        setData({
          student: result.student || null,
          upcomingHomework: result.upcomingHomework || [],
          homeworkGrades: result.homeworkGrades || null,
          eLibraryItems: result.eLibraryItems || [],
          eLearningCourses: result.eLearningCourses || [],
          onlineClasses: result.onlineClasses || [],
        });
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
