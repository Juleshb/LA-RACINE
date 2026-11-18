import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useTranslation } from '../../context/LanguageContext';

const LEVELS = ['easy', 'medium', 'hard', 'impossible'];

function blankQuestion() {
  return { prompt: '', options: ['', '', '', ''], answer: 0, note: '' };
}

function blankQuiz() {
  return {
    id: null,
    title: '',
    description: '',
    level: 'easy',
    isPublished: false,
    questions: [blankQuestion()],
  };
}

function fromRecord(quiz) {
  const questions = (quiz.questions || []).map((question) => ({
    prompt: question.prompt || '',
    options: [...(question.options || []), '', '', '', ''].slice(0, 4),
    answer: Number(question.answer) || 0,
    note: question.note || '',
  }));
  return {
    id: quiz.id,
    title: quiz.title || '',
    description: quiz.description || '',
    level: quiz.level || 'easy',
    isPublished: Boolean(quiz.isPublished),
    questions: questions.length ? questions : [blankQuestion()],
  };
}

export default function ScienceQuizDesk({ onClose, onChanged }) {
  const { t } = useTranslation();
  const [quizzes, setQuizzes] = useState([]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.getScienceQuizzes().then(setQuizzes).catch((err) => setError(err.message));
  };

  useEffect(() => { load(); }, []);

  const openQuiz = async (quiz) => {
    setError('');
    setMessage('');
    try {
      const detail = await api.getScienceQuiz(quiz.id);
      setDraft(fromRecord(detail));
    } catch (err) {
      setError(err.message);
    }
  };

  const updateQuestion = (index, patch) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, itemIndex) => (
        itemIndex === index ? { ...question, ...patch } : question
      )),
    }));
  };

  const updateOption = (index, optionIndex, value) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, itemIndex) => {
        if (itemIndex !== index) return question;
        const options = [...question.options];
        options[optionIndex] = value;
        return { ...question, options };
      }),
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      setError(t('scienceQuiz.needTitle'));
      return;
    }
    const questions = draft.questions.filter((question) => question.prompt.trim());
    if (draft.isPublished && !questions.some((question) => question.options.every((option) => option.trim()))) {
      setError(t('scienceQuiz.needQuestion'));
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    const payload = { ...draft, questions };
    try {
      const saved = draft.id
        ? await api.updateScienceQuiz(draft.id, payload)
        : await api.createScienceQuiz(payload);
      setDraft(fromRecord(saved));
      setMessage(t('scienceQuiz.saved'));
      load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) {
      setDraft(null);
      return;
    }
    if (!window.confirm(t('scienceQuiz.confirmDelete'))) return;
    setSaving(true);
    setError('');
    try {
      await api.deleteScienceQuiz(draft.id);
      setDraft(null);
      setMessage('');
      load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="quiz-manage">
      <div className="quiz-manage-head">
        <div>
          <h2>{t('scienceQuiz.manageQuizzes')}</h2>
          <p>{t('scienceQuiz.manageHint')}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>{t('scienceQuiz.backToPlay')}</button>
      </div>
      {message && <p className="quiz-manage-note is-ok">{message}</p>}
      {error && <p className="quiz-manage-note is-bad">{error}</p>}
      <div className="quiz-manage-grid">
        <aside className="quiz-manage-list">
          <button type="button" className="btn-primary" onClick={() => { setDraft(blankQuiz()); setError(''); setMessage(''); }}>
            {t('scienceQuiz.newQuiz')}
          </button>
          {!quizzes.length && <p className="quiz-manage-empty">{t('scienceQuiz.emptySchool')}</p>}
          {quizzes.map((quiz) => (
            <button
              key={quiz.id}
              type="button"
              className={`quiz-manage-item ${draft?.id === quiz.id ? 'is-on' : ''}`}
              onClick={() => openQuiz(quiz)}
            >
              <span className="quiz-manage-item-title">{quiz.title}</span>
              <span className="quiz-manage-item-meta">
                {t(`scienceQuiz.levels.${quiz.level}`)} · {t('scienceQuiz.questionCount', { count: quiz.questionCount })}
                {' · '}
                {quiz.isPublished ? t('scienceQuiz.published') : t('scienceQuiz.draft')}
              </span>
            </button>
          ))}
        </aside>

        {draft ? (
          <form className="quiz-manage-form" onSubmit={save}>
            <label className="label" htmlFor="quiz-title">{t('scienceQuiz.quizTitle')}</label>
            <input id="quiz-title" className="input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
            <label className="label" htmlFor="quiz-description">{t('scienceQuiz.description')}</label>
            <textarea id="quiz-description" className="input" rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            <div className="quiz-manage-row">
              <label className="label" htmlFor="quiz-level">{t('scienceQuiz.chooseLevel')}</label>
              <select id="quiz-level" className="input" value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value })}>
                {LEVELS.map((level) => <option key={level} value={level}>{t(`scienceQuiz.levels.${level}`)}</option>)}
              </select>
              <label className="quiz-manage-publish">
                <input type="checkbox" checked={draft.isPublished} onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })} />
                {t('scienceQuiz.published')}
              </label>
            </div>

            {draft.questions.map((question, index) => (
              <fieldset key={index} className="quiz-q">
                <legend>{t('scienceQuiz.question')} {index + 1}</legend>
                <textarea
                  className="input"
                  rows={2}
                  value={question.prompt}
                  placeholder={t('scienceQuiz.question')}
                  onChange={(event) => updateQuestion(index, { prompt: event.target.value })}
                />
                <div className="quiz-q-options">
                  {question.options.map((option, optionIndex) => (
                    <label key={optionIndex} className="quiz-q-option">
                      <input
                        type="radio"
                        name={`correct-${index}`}
                        checked={question.answer === optionIndex}
                        onChange={() => updateQuestion(index, { answer: optionIndex })}
                        aria-label={t('scienceQuiz.correct')}
                      />
                      <input
                        className="input"
                        value={option}
                        placeholder={`${t('scienceQuiz.option')} ${optionIndex + 1}`}
                        onChange={(event) => updateOption(index, optionIndex, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <input
                  className="input"
                  value={question.note}
                  placeholder={t('scienceQuiz.note')}
                  onChange={(event) => updateQuestion(index, { note: event.target.value })}
                />
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => {
                    const next = draft.questions.filter((_, itemIndex) => itemIndex !== index);
                    setDraft({ ...draft, questions: next.length ? next : [blankQuestion()] });
                  }}
                >
                  {t('ui.delete')}
                </button>
              </fieldset>
            ))}

            <div className="quiz-manage-actions">
              <button type="button" className="btn-secondary" onClick={() => setDraft({ ...draft, questions: [...draft.questions, blankQuestion()] })}>
                {t('scienceQuiz.addQuestion')}
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>{t('scienceQuiz.saveQuiz')}</button>
              <button type="button" className="btn-secondary" onClick={remove} disabled={saving}>{t('scienceQuiz.deleteQuiz')}</button>
            </div>
          </form>
        ) : (
          <div className="quiz-manage-empty">{t('scienceQuiz.pickOrCreate')}</div>
        )}
      </div>
    </div>
  );
}
