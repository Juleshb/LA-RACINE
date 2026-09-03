import { useEffect, useState } from 'react';
import { api } from '../lib/api';

function instructorLabel(activity) {
  if (activity.instructorTeacher?.name) return activity.instructorTeacher.name;
  if (activity.externalInstructor?.name) return activity.externalInstructor.name;
  return activity.instructor || '';
}

export function useActivitiesManagerDashboardData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    Promise.all([
      api.getExtracurricular().catch(() => ({ activities: [], externalInstructors: [] })),
    ])
      .then(([payload]) => {
        const activities = Array.isArray(payload)
          ? payload
          : (payload?.activities || []);
        const externals = Array.isArray(payload)
          ? []
          : (payload?.externalInstructors || []);
        const active = activities.filter((a) => a.isActive !== false);
        const enrollments = activities.reduce(
          (sum, a) => sum + (a._count?.enrollments || a.enrollmentCount || 0),
          0,
        );
        const nearlyFull = active.filter((a) => {
          const max = a.maxStudents;
          const enrolled = a._count?.enrollments || 0;
          return max && enrolled >= Math.max(1, max - 3) && enrolled < max;
        });
        const full = active.filter((a) => {
          const max = a.maxStudents;
          const enrolled = a._count?.enrollments || 0;
          return max && enrolled >= max;
        });

        const byCategory = {};
        for (const a of activities) {
          const key = a.category || 'Other';
          if (!byCategory[key]) byCategory[key] = { category: key, activities: 0, enrollments: 0 };
          byCategory[key].activities += 1;
          byCategory[key].enrollments += a._count?.enrollments || 0;
        }

        setData({
          activities,
          activeCount: active.length,
          totalCount: activities.length,
          enrollments,
          nearlyFull,
          full,
          externalInstructors: externals,
          byCategory: Object.values(byCategory).sort((a, b) => b.enrollments - a.enrollments),
          recentActivities: [...activities]
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
            .slice(0, 8)
            .map((a) => ({
              ...a,
              instructorName: instructorLabel(a),
              enrolled: a._count?.enrollments || 0,
            })),
        });
      })
      .catch((err) => setError(err.message || 'Failed to load activities dashboard'))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
