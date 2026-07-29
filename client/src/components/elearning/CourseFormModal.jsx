import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import FormModeModal from '../form/FormModeModal';
import FormSection from '../form/FormSection';
import HomeworkQuestionBuilder, { createEmptyQuestion } from '../homework/HomeworkQuestionBuilder';
import { isValidYouTubeUrl } from '../../lib/youtube';

const EMPTY_LESSON = { title: '', description: '', videoUrl: '', coverEmoji: '📺' };
const EMPTY_COURSE = {
  title: '', subject: '', description: '', classId: '', coverEmoji: '🎓',
};

function mapCourseToForm(course) {
  return {
    title: course.title || '',
    subject: course.subject || '',
    description: course.description || '',
    classId: course.classId || '',
    coverEmoji: course.coverEmoji || '🎓',
  };
}

function mapLessonsFromCourse(course) {
  if (!course?.lessons?.length) return [{ ...EMPTY_LESSON }];
  return course.lessons.map((l) => ({
    title: l.title || '',
    description: l.description || '',
    videoUrl: l.videoUrl || '',
    coverEmoji: l.coverEmoji || '📺',
  }));
}

function mapExercisesFromCourse(course) {
  if (!course?.exercises?.length) return [createEmptyQuestion()];
  return course.exercises.map((e) => ({
    type: e.type,
    prompt: e.prompt,
    options: Array.isArray(e.options) ? e.options : ['', '', '', ''],
    correctAnswer: e.correctAnswer,
    points: e.points || 1,
  }));
}

export default function CourseFormModal({
  open,
  courseId = null,
  onClose,
  onSaved,
  classes = [],
}) {
  const isEdit = Boolean(courseId);
  const [form, setForm] = useState({ ...EMPTY_COURSE });
  const [lessons, setLessons] = useState([{ ...EMPTY_LESSON }]);
  const [exercises, setExercises] = useState([createEmptyQuestion()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (!isEdit) {
      setForm({ ...EMPTY_COURSE });
      setLessons([{ ...EMPTY_LESSON }]);
      setExercises([createEmptyQuestion()]);
      return;
    }
    setLoading(true);
    api.getELearningCourse(courseId)
      .then((course) => {
        setForm(mapCourseToForm(course));
        setLessons(mapLessonsFromCourse(course));
        setExercises(mapExercisesFromCourse(course));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, courseId, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    for (const lesson of lessons.filter((l) => l.title.trim())) {
      if (lesson.videoUrl.trim() && !isValidYouTubeUrl(lesson.videoUrl)) {
        setError(`Invalid YouTube link in lesson "${lesson.title}"`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        classId: form.classId || null,
        lessons: lessons.filter((l) => l.title.trim()),
        exercises: exercises.filter((q) => q.prompt?.trim()),
      };
      if (isEdit) {
        await api.updateELearningCourse(courseId, payload);
      } else {
        await api.createELearningCourse(payload);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModeModal
      open={open}
      mode={isEdit ? 'edit' : 'create'}
      title={isEdit ? 'Edit course' : 'New course'}
      subtitle={isEdit ? 'Update lessons and exercises' : 'Add lessons (videos) and fun exercises for students'}
      onClose={onClose}
      onSubmit={handleSubmit}
      formId="elearning-course-form"
      submitLabel={isEdit ? 'Save changes' : 'Save course'}
      submitting={submitting || loading}
      error={error}
      size="xl"
    >
      {loading ? (
        <p className="text-center text-gray-500 py-8">Loading course…</p>
      ) : (
        <>
          <FormSection title="Course details">
            <div className="form-field-full md:col-span-2">
              <label className="label">Course title *</label>
              <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div><label className="label">Subject</label><input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div>
              <label className="label">Class (optional)</label>
              <select className="input" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">All classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-field-full md:col-span-2">
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </FormSection>

          <FormSection title="Video lessons">
            {lessons.map((lesson, index) => (
              <div key={index} className="form-field-full md:col-span-2 p-3 rounded-lg border border-gray-200 space-y-2">
                <input className="input" placeholder="Lesson title *" value={lesson.title} onChange={(e) => setLessons((prev) => prev.map((l, i) => (i === index ? { ...l, title: e.target.value } : l)))} />
                <input className="input" type="url" placeholder="YouTube link" value={lesson.videoUrl} onChange={(e) => setLessons((prev) => prev.map((l, i) => (i === index ? { ...l, videoUrl: e.target.value } : l)))} />
                <input className="input" placeholder="Short description" value={lesson.description} onChange={(e) => setLessons((prev) => prev.map((l, i) => (i === index ? { ...l, description: e.target.value } : l)))} />
                {lessons.length > 1 && (
                  <button type="button" className="text-red-500 text-sm" onClick={() => setLessons((prev) => prev.filter((_, i) => i !== index))}>Remove lesson</button>
                )}
              </div>
            ))}
            <button type="button" className="btn-secondary text-sm" onClick={() => setLessons((prev) => [...prev, { ...EMPTY_LESSON }])}>+ Add lesson</button>
          </FormSection>

          <div className="form-field-full md:col-span-2 mt-4">
            <HomeworkQuestionBuilder questions={exercises} onChange={setExercises} />
          </div>
        </>
      )}
    </FormModeModal>
  );
}
