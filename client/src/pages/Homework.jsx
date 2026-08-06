import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Trash2, Paperclip, Video } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StudentPageHeader from '../components/student/StudentPageHeader';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import ParentChildFilter from '../components/parent/ParentChildFilter';
import HomeworkQuestionBuilder, { createEmptyQuestion } from '../components/homework/HomeworkQuestionBuilder';
import HomeworkGradesSummary from '../components/homework/HomeworkGradesSummary';
import AppIcon from '../components/icons/AppIcon';
import { useTranslation } from '../context/LanguageContext';
import { formatDueDateLabel } from '../i18n/studentQuiz';
import { isValidYouTubeUrl } from '../lib/youtube';
import { SortableTh, useTableSort } from '../hooks/useTableSort';

const EMPTY_VIDEO = { title: '', videoUrl: '' };

const EMPTY_FORM = {
  classId: '', subjectId: '', title: '', description: '', dueDate: '',
};

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Homework() {
  const { campusId } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isParent = user?.role === 'PARENT';
  const isStudent = user?.role === 'STUDENT';
  const isTeacher = user?.role === 'TEACHER';
  const canEdit = !['PARENT', 'STUDENT'].includes(user?.role);
  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [courses, setCourses] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [questions, setQuestions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gradesSummary, setGradesSummary] = useState(null);

  const viewerStudentId = isParent ? selectedChildId : (isStudent ? user?.studentId : undefined);

  const load = () => {
    const classFilterId = isParent
      ? children.find((c) => c.id === selectedChildId)?.classId
      : (isStudent ? undefined : (classFilter || undefined));
    api.getHomework(classFilterId || undefined, viewerStudentId || undefined)
      .then(setItems)
      .catch(console.error);
    if (!isParent && !isStudent) api.getClasses().then(setClasses).catch(console.error);
    if (isParent || isStudent) {
      api.getHomeworkGradesSummary(isParent ? selectedChildId : undefined)
        .then((data) => {
          if (isParent && data.children) {
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

  useEffect(() => { load(); }, [classFilter, isParent, selectedChildId, children, user?.studentId]);

  useEffect(() => {
    if (form.classId) {
      api.getCourses(form.classId).then(setCourses).catch(console.error);
    } else {
      setCourses([]);
    }
  }, [form.classId]);

  const closeForm = () => {
    setShowForm(false);
    setForm({ ...EMPTY_FORM });
    setQuestions([]);
    setAttachments([]);
    setVideos([]);
    setError('');
    setSubmitting(false);
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    const next = [];
    for (const file of files) {
      try {
        const contentBase64 = await readFileAsBase64(file);
        next.push({ fileName: file.name, mimeType: file.type, contentBase64 });
      } catch {
        setError(`Could not read ${file.name}`);
      }
    }
    setAttachments((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const validQuestions = questions.filter((q) => q.prompt.trim());
      const validVideos = videos.filter((v) => v.videoUrl.trim());
      for (const v of validVideos) {
        if (!isValidYouTubeUrl(v.videoUrl)) {
          setError('Please use a valid YouTube link for each video.');
          setSubmitting(false);
          return;
        }
      }
      await api.createHomework({
        ...form,
        subjectId: form.subjectId || null,
        questions: validQuestions,
        attachments,
        videos: validVideos,
      });
      closeForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('pageBody.homework.deleteConfirm'))) return;
    try {
      await api.deleteHomework(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const getHomeworkSortValue = useCallback((row, key) => {
    switch (key) {
      case 'title': return row.title || '';
      case 'class': return row.class?.name || '';
      case 'questions': return row._count?.questions ?? 0;
      case 'dueDate': return row.dueDate ? new Date(row.dueDate) : null;
      case 'status': return row.mySubmission ? 1 : 0;
      default: return '';
    }
  }, []);

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    items,
    getHomeworkSortValue,
    { initialKey: 'dueDate' },
  );

  return (
    <div className={isStudent ? 'student-page' : ''}>
      {isStudent ? (
        <StudentPageHeader
          icon="homework"
          title={t('homework.title')}
          subtitle={t('homework.subtitle')}
          backTo={`/campus/${campusId}`}
        />
      ) : (
        <PageHeader
          title={t('pages.homework.title')}
          description={isParent
            ? t('pages.homework.descriptionParent')
            : isTeacher
              ? t('pages.homework.descriptionTeacher')
              : t('pages.homework.description')}
          action={canEdit && (
            <button
              onClick={() => {
                setShowForm(true);
                setError('');
                setQuestions([createEmptyQuestion()]);
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {t('pages.homework.add')}
            </button>
          )}
        />
      )}

      {isParent ? (
        <ParentChildFilter
          children={children}
          value={selectedChildId}
          onChange={setSelectedChildId}
        />
      ) : !isStudent ? (
        <div className="mb-6">
          <label className="label">{isTeacher ? t('ui.filterByMyClass') : t('ui.filterByClass')}</label>
          <select className="input max-w-xs" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">{t('ui.allClasses')}</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      ) : null}

      {(isStudent || isParent) && gradesSummary && (
        <HomeworkGradesSummary
          summary={gradesSummary}
          campusId={campusId}
          studentId={viewerStudentId}
          title={isStudent ? t('homework.gradesTitle') : t('pageBody.homework.performanceTitle')}
        />
      )}

      <FormModeModal
        open={showForm}
        mode="create"
        title={t('pageBody.homework.newTitle')}
        subtitle={t('pageBody.homework.newSubtitle')}
        onClose={closeForm}
        onSubmit={handleSubmit}
        formId="homework-form"
        submitLabel={t('pageBody.homework.saveAssignment')}
        submitting={submitting}
        error={error}
        size="xl"
      >
        <FormSection title={t('ui.assignmentDetails')}>
          <div>
            <label className="label">{t('ui.class')} *</label>
            <select className="input" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, subjectId: '' })}>
              <option value="">{t('ui.selectClass')}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('ui.subject')}</label>
            <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">{t('ui.none')}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('ui.titleField')} *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('ui.instructions')}</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('ui.dueDate')} *</label>
            <input className="input" type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
        </FormSection>

        <FormSection title={t('pageBody.homework.filesSection')}>
          <div className="form-field-full md:col-span-2">
            <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer">
              <Paperclip className="w-4 h-4" />
              {t('ui.uploadFile')}
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={handleFiles} />
            </label>
            {attachments.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-gray-600">
                {attachments.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span>{f.fileName}</span>
                    <button type="button" className="text-red-500" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}>{t('ui.remove')}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FormSection>

        <FormSection title={t('pageBody.homework.videosSection')}>
          <div className="form-field-full md:col-span-2">
            <p className="text-sm text-gray-500 mb-3">
              {t('pageBody.homework.videosHint')}
            </p>
            {videos.map((video, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-2 mb-3 p-3 rounded-lg border border-gray-200 bg-gray-50/80">
                <input
                  className="input flex-1"
                  placeholder={t('pageBody.homework.videoTitlePlaceholder')}
                  value={video.title}
                  onChange={(e) => setVideos((prev) => prev.map((v, i) => (i === index ? { ...v, title: e.target.value } : v)))}
                />
                <input
                  className="input flex-[2]"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={video.videoUrl}
                  onChange={(e) => setVideos((prev) => prev.map((v, i) => (i === index ? { ...v, videoUrl: e.target.value } : v)))}
                />
                <button
                  type="button"
                  className="text-red-500 text-sm shrink-0"
                  onClick={() => setVideos((prev) => prev.filter((_, i) => i !== index))}
                >
                  {t('ui.remove')}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => setVideos((prev) => [...prev, { ...EMPTY_VIDEO }])}
            >
              <Video className="w-4 h-4" />
              {t('ui.addVideoLink')}
            </button>
          </div>
        </FormSection>

        <div className="form-field-full md:col-span-2 mt-4">
          <HomeworkQuestionBuilder questions={questions} onChange={setQuestions} />
        </div>
      </FormModeModal>

      {isStudent ? (
        items.length === 0 ? (
          <div className="student-empty-card inline-flex items-center gap-2">
            {t('common.noHomework')}
            <AppIcon name="star" className="w-5 h-5 text-amber-500" />
          </div>
        ) : (
          <div className="student-hw-cards">
            {items.map((item) => {
              const overdue = new Date(item.dueDate) < new Date();
              const done = item.mySubmission;
              return (
                <Link
                  key={item.id}
                  to={`/campus/${campusId}/homework/${item.id}`}
                  className={`student-hw-card block no-underline ${overdue && !done ? 'student-hw-card-overdue' : ''}`}
                >
                  <div className="student-hw-card-head">
                    <span className="student-hw-card-icon" aria-hidden>
                      <AppIcon name="homework" className="w-9 h-9" />
                    </span>
                    <div>
                      <h2 className="student-hw-card-title">{item.title}</h2>
                      <p className={`student-hw-card-due ${overdue && !done ? 'student-hw-card-due-overdue' : ''} inline-flex items-center gap-1.5`}>
                        {done ? (
                          <>
                            {t('dashboard.score', { score: done.score, max: done.maxScore })}
                            <AppIcon name="star" className="w-4 h-4 text-amber-500" />
                          </>
                        ) : (
                          formatDueDateLabel(item.dueDate, t)
                        )}
                      </p>
                      {item._count?.questions > 0 && (
                        <span className="student-hw-card-subject">{t('homework.questionsCount', { count: item._count.questions })}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-violet-700 font-semibold mt-2">{t('homework.tapToOpenArrow')}</p>
                </Link>
              );
            })}
          </div>
        )
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <SortableTh label={t('ui.assignment')} columnKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label={t('ui.class')} columnKey="class" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label={t('ui.questions')} columnKey="questions" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label={t('ui.due')} columnKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  {isParent && <SortableTh label={t('ui.status')} columnKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />}
                  {isParent && <th className="pb-3 font-medium">{t('ui.score')}</th>}
                  {canEdit && <th className="pb-3 font-medium">{t('ui.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => {
                  const done = item.mySubmission;
                  const detailLink = isParent && selectedChildId
                    ? `/campus/${campusId}/homework/${item.id}?studentId=${selectedChildId}`
                    : `/campus/${campusId}/homework/${item.id}`;
                  return (
                  <tr key={item.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3">
                      <Link to={detailLink} className="font-medium text-brand-700 hover:underline">
                        {item.title}
                      </Link>
                      {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                    </td>
                    <td className="py-3">{item.class.name}</td>
                    <td className="py-3">{item._count?.questions ?? 0}</td>
                    <td className="py-3">
                      <span className={new Date(item.dueDate) < new Date() && !done ? 'text-red-500' : ''}>
                        {new Date(item.dueDate).toLocaleDateString()}
                      </span>
                    </td>
                    {isParent && (
                      <td className="py-3">
                        {done ? (
                          <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">{t('ui.submitted')}</span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">{t('ui.notDone')}</span>
                        )}
                      </td>
                    )}
                    {isParent && (
                      <td className="py-3 font-semibold">
                        {done ? `${done.score}/${done.maxScore}` : '—'}
                      </td>
                    )}
                    {canEdit && (
                      <td className="py-3">
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
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
