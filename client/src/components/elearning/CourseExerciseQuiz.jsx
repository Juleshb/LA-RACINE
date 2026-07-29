import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useTranslation } from '../../context/LanguageContext';
import { formatBoolAnswer, getQuestionTypeLabel } from '../../i18n/studentQuiz';
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

function ExerciseInput({ exercise, value, onChange, disabled }) {
  const { t } = useTranslation();
  if (exercise.type === 'TRUE_FALSE') {
    return (
      <div className="student-tf-options">
        {['true', 'false'].map((opt) => (
          <label key={opt} className={`student-tf-option ${value === opt ? 'student-tf-option-active' : ''}`}>
            <input type="radio" name={exercise.id} value={opt} checked={value === opt} disabled={disabled} onChange={() => onChange(opt)} />
            <TrueFalseLabel value={opt} />
          </label>
        ))}
      </div>
    );
  }
  if (exercise.type === 'MULTIPLE_CHOICE') {
    const options = Array.isArray(exercise.options) ? exercise.options : [];
    return (
      <div className="student-mc-options">
        {options.map((opt, i) => (
          <label key={i} className={`student-mc-option ${value === String(i) ? 'student-mc-option-active' : ''}`}>
            <input type="radio" name={exercise.id} value={String(i)} checked={value === String(i)} disabled={disabled} onChange={() => onChange(String(i))} />
            <span>{opt || t('homework.optionN', { n: i + 1 })}</span>
          </label>
        ))}
      </div>
    );
  }
  return (
    <input className="input text-lg" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={t('homework.typeAnswerPlaceholder')} />
  );
}

function formatAnswer(exercise, raw, t) {
  if (!exercise) return raw;
  if (exercise.type === 'TRUE_FALSE') return formatBoolAnswer(raw, t);
  if (exercise.type === 'MULTIPLE_CHOICE') {
    const options = Array.isArray(exercise.options) ? exercise.options : [];
    return options[Number(raw)] || raw;
  }
  return raw;
}

export default function CourseExerciseQuiz({
  courseId,
  exercises,
  submission,
  onSubmitted,
  startInForm = false,
  allowRetry = true,
  readOnly = false,
}) {
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [showForm, setShowForm] = useState(readOnly ? false : (startInForm || !submission));
  const { t } = useTranslation();

  useEffect(() => {
    setShowForm(readOnly ? false : (startInForm || !submission));
    setAnswers({});
    setResults(null);
    setError('');
  }, [startInForm, submission?.id, submission?.submittedAt, courseId, readOnly]);

  const scoreData = results?.submission || submission;
  const resultExercises = results?.exercises;
  const showingResults = !showForm && scoreData;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const missing = exercises.filter((ex) => !answers[ex.id] && answers[ex.id] !== 'false');
    if (missing.length) {
      setError(t('elearning.answerAllFirst'));
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.submitELearningExercises(
        courseId,
        exercises.map((ex) => ({ exerciseId: ex.id, answer: answers[ex.id] })),
      );
      setResults(data);
      setShowForm(false);
      onSubmitted?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTryAgain = () => {
    setShowForm(true);
    setAnswers({});
    setResults(null);
    setError('');
  };

  if (readOnly && !submission) {
    return <div className="student-empty-card">{t('elearning.noExercisesYet')}</div>;
  }

  if (!exercises.length) {
    return <div className="student-empty-card">{t('elearning.noExercisesYet')}</div>;
  }

  if (showingResults) {
    const pct = scoreData.maxScore > 0 ? Math.round((scoreData.score / scoreData.maxScore) * 100) : 0;
    const graded = resultExercises || (Array.isArray(scoreData.answers) ? scoreData.answers.map((a) => ({
      ...exercises.find((ex) => ex.id === a.questionId),
      yourAnswer: a.answer,
      isCorrect: a.isCorrect,
      pointsEarned: a.pointsEarned,
    })) : []);

    return (
      <section className="student-score-card">
        <span className="student-score-icon" aria-hidden>
          <AppIcon name="star" className="w-14 h-14 text-amber-500" />
        </span>
        <h2 className="student-score-title">{t('elearning.yourScore', { score: scoreData.score, max: scoreData.maxScore })}</h2>
        <p className="student-score-pct">{pct}%</p>
        <ul className="student-result-list">
          {graded.map((item, i) => (
            <li key={item?.id || i} className={item?.isCorrect ? 'student-result-correct' : 'student-result-wrong'}>
              <p className="font-semibold">{item?.prompt}</p>
              <p className="text-sm mt-1 inline-flex items-center gap-1.5 flex-wrap">
                {t('homework.yourAnswer')}: {formatAnswer(item, item?.yourAnswer, t)}
                <AppIcon name={item?.isCorrect ? 'check' : 'wrong'} className="w-4 h-4 shrink-0" />
              </p>
            </li>
          ))}
        </ul>
        {allowRetry && !readOnly && (
          <button type="button" onClick={handleTryAgain} className="course-big-btn course-big-btn-primary mt-5 w-full sm:w-auto">
            <IconLabel icon="refresh">{t('homework.tryAgain')}</IconLabel>
          </button>
        )}
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {submission && (
        <p className="text-sm text-violet-700 font-medium bg-violet-50 rounded-xl px-4 py-2">
          {t('homework.retryHint')}
        </p>
      )}
      {exercises.map((ex, i) => (
        <div key={ex.id} className="student-question-card">
          <p className="student-question-num">{t('homework.questionN', { n: i + 1, type: getQuestionTypeLabel(ex.type, t) })}</p>
          <p className="student-question-prompt">{ex.prompt}</p>
          <ExerciseInput
            exercise={ex}
            value={answers[ex.id] || ''}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [ex.id]: v }))}
            disabled={submitting}
          />
        </div>
      ))}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto text-lg px-8 py-3">
        {submitting ? (
          t('elearning.checking')
        ) : (
          <IconLabel icon="star">{submission ? t('elearning.checkAnswersAgain') : t('elearning.checkAnswers')}</IconLabel>
        )}
      </button>
    </form>
  );
}
