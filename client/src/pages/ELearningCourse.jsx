import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import StudentPageHeader from '../components/student/StudentPageHeader';
import PageHeader from '../components/PageHeader';
import EmbeddedYouTube from '../components/media/EmbeddedYouTube';
import CourseExerciseQuiz from '../components/elearning/CourseExerciseQuiz';
import CourseStudentFlow from '../components/elearning/CourseStudentFlow';
import CourseFormModal from '../components/elearning/CourseFormModal';
import AppIcon from '../components/icons/AppIcon';

export default function ELearningCourse() {
  const { campusId, courseId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isStudent = user?.role === 'STUDENT';
  const isParent = user?.role === 'PARENT';
  const studentId = isParent ? searchParams.get('studentId') : undefined;
  const canManage = !['STUDENT', 'PARENT'].includes(user?.role);
  const [course, setCourse] = useState(null);
  const [classes, setClasses] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.getELearningCourse(courseId, studentId || undefined)
      .then(setCourse)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [courseId, studentId]);
  useEffect(() => {
    if (canManage) api.getClasses().then(setClasses).catch(console.error);
  }, [canManage]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !course) {
    return <div className="student-empty-card">{error || t('elearning.courseNotFound')}</div>;
  }

  const base = `/campus/${campusId}/e-learning`;
  const backTo = isParent && studentId ? `${base}?studentId=${studentId}` : base;

  return (
    <div className={isStudent ? 'student-page' : ''}>
      {isStudent ? (
        <StudentPageHeader
          icon="learning"
          title={course.title}
          subtitle={course.subject || course.class?.name || t('elearning.learningCourse')}
          backTo={base}
        />
      ) : (
        <PageHeader
          title={course.title}
          description={isParent
            ? 'View your child\'s exercise results for this course'
            : (course.subject || course.class?.name)}
          action={canManage && (
            <button type="button" onClick={() => setFormOpen(true)} className="btn-secondary flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Edit course
            </button>
          )}
        />
      )}

      {canManage && (
        <CourseFormModal
          open={formOpen}
          courseId={courseId}
          classes={classes}
          onClose={() => setFormOpen(false)}
          onSaved={load}
        />
      )}

      {course.description && (
        <div className="student-material-card student-material-intro mb-4">
          <p className="student-material-text">{course.description}</p>
        </div>
      )}

      {isStudent ? (
        <CourseStudentFlow course={course} onSubmitted={load} />
      ) : isParent ? (
        <>
          {course.lessons?.length > 0 && (
            <section className="student-hw-materials mb-6">
              {course.lessons.map((lesson) => (
                <article key={lesson.id} className="student-material-card student-material-lesson">
                  <div className="student-material-head">
                    <span className="student-material-badge" aria-hidden>
                      <AppIcon name="lesson" className="w-8 h-8" />
                    </span>
                    <div>
                      <h2 className="student-material-label">{lesson.title}</h2>
                      {lesson.description && <p className="student-material-sub">{lesson.description}</p>}
                    </div>
                  </div>
                  {(lesson.youtubeId || lesson.videoUrl) && (
                    <EmbeddedYouTube youtubeId={lesson.youtubeId} videoUrl={lesson.videoUrl} title={lesson.title} />
                  )}
                </article>
              ))}
            </section>
          )}

          {course.exercises?.length > 0 ? (
            course.mySubmission ? (
              <CourseExerciseQuiz
                courseId={course.id}
                exercises={course.exercises}
                submission={course.mySubmission}
                readOnly
              />
            ) : (
              <div className="card text-sm text-gray-600">
                Your child has not completed the exercises for this course yet.
              </div>
            )
          ) : (
            <div className="card text-sm text-gray-500">This course has no exercises yet.</div>
          )}
        </>
      ) : (
        <>
          {course.lessons?.length > 0 && (
            <section className="student-hw-materials mb-6">
              {course.lessons.map((lesson) => (
                <article key={lesson.id} className="student-material-card student-material-lesson">
                  <div className="student-material-head">
                    <span className="student-material-badge" aria-hidden>
                      <AppIcon name="lesson" className="w-8 h-8" />
                    </span>
                    <div>
                      <h2 className="student-material-label">{lesson.title}</h2>
                      {lesson.description && <p className="student-material-sub">{lesson.description}</p>}
                    </div>
                  </div>
                  {(lesson.youtubeId || lesson.videoUrl) && (
                    <EmbeddedYouTube youtubeId={lesson.youtubeId} videoUrl={lesson.videoUrl} title={lesson.title} />
                  )}
                </article>
              ))}
            </section>
          )}

          {course.exercises?.length > 0 && (
            <>
              <h3 className="student-quiz-divider">Exercises (preview)</h3>
              <CourseExerciseQuiz
                courseId={course.id}
                exercises={course.exercises}
                submission={course.mySubmission}
                onSubmitted={() => load()}
              />
            </>
          )}
        </>
      )}

      {!isStudent && (
        <Link to={backTo} className="link text-sm mt-6 inline-block">← Back to courses</Link>
      )}
    </div>
  );
}
