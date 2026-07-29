import { useState } from 'react';
import { api } from '../../lib/api';
import { useTranslation } from '../../context/LanguageContext';
import { formatBoolAnswer, getQuestionTypeLabel } from '../../i18n/studentQuiz';
import StudentPageHeader from '../student/StudentPageHeader';
import PageHeader from '../PageHeader';
import InAppViewer from './InAppViewer';
import StudentHomeworkMaterials from './StudentHomeworkMaterials';
import AppIcon, { IconLabel } from '../icons/AppIcon';

function TrueFalseLabel({ value }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5">
      <AppIcon name={value === 'true' ? 'check' : 'wrong'} className="w-4 h-4" />
      {formatBoolAnswer(value, t)}
    </span>
  );
}

function QuestionInput({ question, value, onChange, disabled }) {
  const { t } = useTranslation();
  if (question.type === 'TRUE_FALSE') {
    return (
      <div className="student-tf-options">
        {['true', 'false'].map((opt) => (
          <label key={opt} className={`student-tf-option ${value === opt ? 'student-tf-option-active' : ''}`}>
            <input
              type="radio"
              name={question.id}
              value={opt}
              checked={value === opt}
              disabled={disabled}
              onChange={() => onChange(opt)}
            />
            <TrueFalseLabel value={opt} />
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'MULTIPLE_CHOICE') {
    const options = Array.isArray(question.options) ? question.options : [];
    return (
      <div className="student-mc-options">
        {options.map((opt, i) => (
          <label key={i} className={`student-mc-option ${value === String(i) ? 'student-mc-option-active' : ''}`}>
            <input
              type="radio"
              name={question.id}
              value={String(i)}
              checked={value === String(i)}
              disabled={disabled}
              onChange={() => onChange(String(i))}
            />
            <span>{opt || t('homework.optionN', { n: i + 1 })}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <input
      className="input text-lg"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('homework.typeAnswerPlaceholder')}
    />
  );
}

export default function HomeworkQuiz({
  homework,
  campusId,
  isStudent,
  readOnly = false,
  backTo,
  onSubmitted,
}) {
  const [answers, setAnswers] = useState({});
  const [viewerAttachment, setViewerAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const { t } = useTranslation();

  const childView = isStudent || readOnly;

  const submission = homework.mySubmission;
  const submitted = Boolean(submission) && !retrying;
  const questions = homework.questions || [];

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const missing = questions.filter((q) => !answers[q.id] && answers[q.id] !== 'false');
    if (missing.length) {
      setError(t('homework.answerAll'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.submitHomework(
        homework.id,
        questions.map((q) => ({ questionId: q.id, answer: answers[q.id] })),
      );
      setRetrying(false);
      onSubmitted?.(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const scorePct = submission?.maxScore
    ? Math.round((submission.score / submission.maxScore) * 100)
    : 0;

  const scoreTitle = submission
    ? (readOnly
      ? t('homework.scoreLabel', { score: submission.score, max: submission.maxScore })
      : t('homework.yourScore', { score: submission.score, max: submission.maxScore }))
    : '';

  return (
    <div className={isStudent ? 'student-page' : ''}>
      {isStudent ? (
        <StudentPageHeader
          icon="homework"
          title={homework.title}
          subtitle={homework.subject?.name || homework.class?.name}
          backTo={backTo}
        />
      ) : (
        <PageHeader
          title={homework.title}
          description={readOnly ? 'View your child\'s homework results' : homework.class?.name}
        />
      )}

      {childView ? (
        <StudentHomeworkMaterials homework={homework} />
      ) : (
        <>
          {homework.description && (
            <p className="mb-4 text-gray-600">{homework.description}</p>
          )}
          {homework.videos?.length > 0 && (
            <section className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Videos</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {homework.videos.map((video) => (
                  <li key={video.id}>{video.title || 'Lesson video'}</li>
                ))}
              </ul>
            </section>
          )}
          {homework.attachments?.length > 0 && (
            <section className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Files</h3>
              <div className="flex flex-wrap gap-2">
                {homework.attachments.map((att) => (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => setViewerAttachment(att)}
                    className="student-quick-chip"
                  >
                    <AppIcon name={att.mimeType === 'application/pdf' ? 'pdf' : 'image'} className="w-4 h-4 shrink-0" />
                    {' '}
                    {att.fileName}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {childView && (homework.questions?.length > 0 || submitted) && (
        <h3 className="student-quiz-divider">
          {submitted ? (
            <IconLabel icon="star">{t('homework.yourResults')}</IconLabel>
          ) : (
            <IconLabel icon="pencil">{t('homework.nowAnswer')}</IconLabel>
          )}
        </h3>
      )}

      {submitted ? (
        <section className="student-score-card">
          <span className="student-score-icon" aria-hidden>
            <AppIcon name="star" className="w-14 h-14 text-amber-500" />
          </span>
          <h2 className="student-score-title">{scoreTitle}</h2>
          <p className="student-score-pct">{scorePct}%</p>
          <ul className="student-result-list">
            {(submission.answers || []).map((a) => (
              <li key={a.id} className={a.isCorrect ? 'student-result-correct' : 'student-result-wrong'}>
                <p className="font-semibold">{a.question.prompt}</p>
                <p className="text-sm mt-1 inline-flex items-center gap-1.5 flex-wrap">
                  {readOnly ? t('homework.answer') : t('homework.yourAnswer')}: {formatDisplayAnswer(a.question, a.answer, t)}
                  <AppIcon name={a.isCorrect ? 'check' : 'wrong'} className="w-4 h-4 shrink-0" />
                  {!a.isCorrect && (
                    <span className="text-gray-600">
                      {t('homework.correctAnswer', { answer: formatDisplayAnswer(a.question, a.question.correctAnswer, t) })}
                    </span>
                  )}
                </p>
                <p className="text-xs mt-1">{t('elearning.points', { earned: a.pointsEarned, total: a.question.points })}</p>
              </li>
            ))}
          </ul>
          {isStudent && !readOnly && (
            <button
              type="button"
              onClick={() => { setRetrying(true); setAnswers({}); setError(''); }}
              className="course-big-btn course-big-btn-primary mt-5 w-full sm:w-auto"
            >
              <IconLabel icon="refresh">{t('homework.tryAgain')}</IconLabel>
            </button>
          )}
        </section>
      ) : readOnly ? (
        <div className="student-empty-card">Your child has not submitted this homework yet.</div>
      ) : questions.length > 0 ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {submission && (
            <p className="text-sm text-violet-700 font-medium bg-violet-50 rounded-xl px-4 py-2">
              {t('homework.retryHint')}
            </p>
          )}
          {questions.map((q, i) => (
            <div key={q.id} className="student-question-card">
              <p className="student-question-num">{t('homework.questionN', { n: i + 1, type: getQuestionTypeLabel(q.type, t) })}</p>
              <p className="student-question-prompt">{q.prompt}</p>
              <QuestionInput
                question={q}
                value={answers[q.id] || ''}
                onChange={(v) => setAnswer(q.id, v)}
                disabled={submitting}
              />
            </div>
          ))}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto text-lg px-8 py-3">
            {submitting ? t('homework.checking') : (
              <IconLabel icon="check">{submission ? t('homework.submitAnswersAgain') : t('homework.submitAnswers')}</IconLabel>
            )}
          </button>
        </form>
      ) : (
        <div className="student-empty-card">{t('homework.noQuestionsYet')}</div>
      )}

      {viewerAttachment && (
        <InAppViewer
          homeworkId={homework.id}
          attachment={viewerAttachment}
          onClose={() => setViewerAttachment(null)}
        />
      )}
    </div>
  );
}

function formatDisplayAnswer(question, raw, t) {
  if (question.type === 'TRUE_FALSE') {
    return formatBoolAnswer(raw, t);
  }
  if (question.type === 'MULTIPLE_CHOICE') {
    const options = Array.isArray(question.options) ? question.options : [];
    return options[Number(raw)] || raw;
  }
  return raw;
}
