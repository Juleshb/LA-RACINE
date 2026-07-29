import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Trash2, ChevronRight, Pencil } from 'lucide-react';
import AppIcon from '../components/icons/AppIcon';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StudentPageHeader from '../components/student/StudentPageHeader';
import ParentChildFilter from '../components/parent/ParentChildFilter';
import HomeworkGradesSummary from '../components/homework/HomeworkGradesSummary';
import CourseFormModal from '../components/elearning/CourseFormModal';
import { useTranslation } from '../context/LanguageContext';

export default function ELearning() {
  const { campusId } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isStudent = user?.role === 'STUDENT';
  const isParent = user?.role === 'PARENT';
  const canManage = !['STUDENT', 'PARENT'].includes(user?.role);
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [gradesSummary, setGradesSummary] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);

  const base = `/campus/${campusId}/e-learning`;
  const viewerStudentId = isParent ? selectedChildId : undefined;

  const load = () => {
    api.getELearningCourses(viewerStudentId || undefined)
      .then(setCourses)
      .catch(console.error);
    if (isParent) {
      api.getELearningGradesSummary(selectedChildId || undefined)
        .then((data) => {
          if (data.children) {
            setGradesSummary(data.children.find((c) => c.student?.id === selectedChildId) || null);
          } else {
            setGradesSummary(data);
          }
        })
        .catch(console.error);
    }
  };

  useEffect(() => {
    if (isParent) {
      api.getParentChildren().then((list) => {
        setChildren(list);
        if (list.length) setSelectedChildId(list[0].id);
      }).catch(console.error);
    }
  }, [isParent]);

  useEffect(() => { load(); }, [isParent, selectedChildId, children.length]);
  useEffect(() => {
    if (canManage) api.getClasses().then(setClasses).catch(console.error);
  }, [canManage]);

  const openCreate = () => {
    setEditingCourseId(null);
    setFormOpen(true);
  };

  const openEdit = (courseId) => {
    setEditingCourseId(courseId);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingCourseId(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this course and all its lessons?')) return;
    try {
      await api.deleteELearningCourse(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className={isStudent ? 'student-page' : ''}>
      {isStudent ? (
        <StudentPageHeader
          icon="learning"
          title={t('elearning.title')}
          subtitle={t('elearning.subtitle')}
          backTo={`/campus/${campusId}`}
        />
      ) : (
        <PageHeader
          title={t('pages.elearning.title')}
          description={isParent
            ? t('pages.elearning.descriptionParent')
            : t('pages.elearning.description')}
          action={canManage && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> {t('pages.elearning.addCourse')}
            </button>
          )}
        />
      )}

      {isParent && (
        <ParentChildFilter
          children={children}
          value={selectedChildId}
          onChange={setSelectedChildId}
        />
      )}

      {isParent && gradesSummary && (
        <HomeworkGradesSummary
          summary={gradesSummary}
          campusId={campusId}
          studentId={viewerStudentId}
          title="E-Learning performance"
          detailSegment="e-learning"
          itemIdField="courseId"
        />
      )}

      {canManage && (
        <CourseFormModal
          open={formOpen}
          courseId={editingCourseId}
          classes={classes}
          onClose={closeForm}
          onSaved={load}
        />
      )}

      {courses.length === 0 ? (
        <div className={isStudent ? 'student-empty-card' : 'card text-center py-12 text-gray-500'}>
          {isStudent || isParent ? t('common.noCourses') : 'No e-learning courses yet.'}
        </div>
      ) : isStudent ? (
        <div className="student-learning-grid">
          {courses.map((course) => (
            <Link key={course.id} to={`${base}/${course.id}`} className="student-learning-tile student-learning-tile-course">
              <span className="student-learning-tile-icon" aria-hidden>
                <AppIcon name="learning" className="w-12 h-12" />
              </span>
              <h2 className="student-learning-tile-title">{course.title}</h2>
              <p className="student-learning-tile-sub">{course.subject || t('common.course')}</p>
              <div className="student-learning-tile-meta">
                <span className="inline-flex items-center gap-1">
                  <AppIcon name="lesson" className="w-4 h-4" />
                  {t('common.lessonsCount', { count: course._count?.lessons || 0 })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <AppIcon name="exercise" className="w-4 h-4" />
                  {t('common.exercisesCount', { count: course._count?.exercises || 0 })}
                </span>
              </div>
              <span className="student-learning-tile-cta">{t('common.tapToStart')} <ChevronRight className="w-4 h-4 inline" /></span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Course</th>
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 font-medium">Class</th>
                  <th className="pb-3 font-medium">Lessons</th>
                  <th className="pb-3 font-medium">Exercises</th>
                  {isParent && <th className="pb-3 font-medium">Status</th>}
                  {isParent && <th className="pb-3 font-medium">Score</th>}
                  {canManage && <th className="pb-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => {
                  const done = course.mySubmission;
                  const detailLink = isParent && selectedChildId
                    ? `${base}/${course.id}?studentId=${selectedChildId}`
                    : `${base}/${course.id}`;
                  return (
                    <tr key={course.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3">
                        <Link to={detailLink} className="font-medium text-brand-700 hover:underline">
                          {course.coverEmoji} {course.title}
                        </Link>
                      </td>
                      <td className="py-3">{course.subject || '—'}</td>
                      <td className="py-3">{course.class?.name || 'All'}</td>
                      <td className="py-3">{course._count?.lessons || 0}</td>
                      <td className="py-3">{course._count?.exercises || 0}</td>
                      {isParent && (
                        <td className="py-3">
                          {done ? (
                            <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">Completed</span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">Not done</span>
                          )}
                        </td>
                      )}
                      {isParent && (
                        <td className="py-3 font-semibold">
                          {done ? `${done.score}/${done.maxScore}` : '—'}
                        </td>
                      )}
                      {canManage && (
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => openEdit(course.id)} className="p-1.5 text-gray-400 hover:text-brand-600" title="Edit course">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => handleDelete(course.id)} className="p-1.5 text-gray-400 hover:text-red-400" title="Delete course">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
