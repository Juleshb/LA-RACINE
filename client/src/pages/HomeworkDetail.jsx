import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import HomeworkQuiz from '../components/homework/HomeworkQuiz';

export default function HomeworkDetail() {
  const { campusId, homeworkId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isStudent = user?.role === 'STUDENT';
  const isParent = user?.role === 'PARENT';
  const studentId = isParent ? searchParams.get('studentId') : undefined;
  const [homework, setHomework] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.getHomeworkDetail(homeworkId, studentId || undefined)
      .then(setHomework)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [homeworkId, studentId]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !homework) {
    return <div className="student-empty-card">{error || t('homework.notFound')}</div>;
  }

  return (
    <HomeworkQuiz
      homework={homework}
      campusId={campusId}
      isStudent={isStudent}
      readOnly={isParent}
      backTo={`/campus/${campusId}/homework`}
      onSubmitted={() => load()}
    />
  );
}
