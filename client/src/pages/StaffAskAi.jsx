import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, Send } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import { useTranslation } from '../context/LanguageContext';

const SUGGESTIONS = {
  TEACHER: ['suggestAttendance', 'suggestMarks', 'suggestHomework', 'suggestLive'],
  ACCOUNTANT: ['suggestFees', 'suggestStudents', 'suggestAttendance'],
  ACTIVITIES_MANAGER: ['suggestActivities'],
  LIBRARIAN: ['suggestLibrary', 'suggestStudents'],
  HEAD_OF_DISCIPLINE: ['suggestAttendance', 'suggestStudents', 'suggestActivities'],
  DEFAULT: ['suggestStudents', 'suggestAttendance', 'suggestMarks', 'suggestFees'],
};

export default function StaffAskAi() {
  const { user } = useAuth();
  const { campusId } = useCampus();
  const { t, language } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const suggestionKeys = SUGGESTIONS[user?.role] || SUGGESTIONS.DEFAULT;

  const ask = async (text) => {
    const question = String(text || '').trim();
    if (!question || sending) return;
    const history = [...messages, { role: 'user', content: question }];
    setMessages(history);
    setDraft('');
    setError('');
    setSending(true);
    try {
      const reply = await api.askStaffGuide(
        history.map(({ role, content }) => ({ role, content })),
        language,
      );
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          explanation: reply.explanation || reply.answer || '',
          steps: Array.isArray(reply.steps) ? reply.steps : [],
          actions: Array.isArray(reply.actions) ? reply.actions : [],
        },
      ]);
    } catch (err) {
      setError(err.message || t('app.askAi.error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ask-racine-page">
      <header className="ask-racine-head">
        <span className="ask-racine-mark" aria-hidden>
          <Bot className="w-5 h-5" />
        </span>
        <div>
          <h1>{t('app.askAi.title')}</h1>
          <p>{t('app.askAi.lead')}</p>
        </div>
      </header>

      <div className="ask-racine-thread">
        {messages.length === 0 && (
          <div className="ask-racine-empty">
            <p>{t('app.askAi.emptyTitle')}</p>
            <div className="ask-racine-suggestions">
              {suggestionKeys.map((key) => (
                <button key={key} type="button" onClick={() => ask(t(`app.askAi.${key}`))}>
                  {t(`app.askAi.${key}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <article key={`${message.role}-${index}`} className={`ask-racine-msg is-${message.role}`}>
            <p className="ask-racine-msg-label">
              {message.role === 'user' ? t('app.askAi.you') : t('app.askAi.title')}
            </p>
            <p className="ask-racine-msg-body">{message.content || message.explanation}</p>
            {message.steps?.length > 0 && (
              <ol className="ask-racine-steps">
                {message.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
            {message.actions?.length > 0 && (
              <div className="ask-racine-actions">
                {message.steps?.length > 0 && <p>{t('app.askAi.thenOpen')}</p>}
                {message.actions.map((action) => (
                  <Link key={action.id} to={`/campus/${campusId}/${action.path}`}>
                    {action.label}
                    <ArrowRight className="w-4 h-4" aria-hidden />
                  </Link>
                ))}
              </div>
            )}
          </article>
        ))}

        {sending && <p className="ask-racine-thinking">{t('app.askAi.thinking')}</p>}
        {error && <p className="ask-racine-error">{error}</p>}
      </div>

      <form
        className="ask-racine-form"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('app.askAi.placeholder')}
          aria-label={t('app.askAi.placeholder')}
          disabled={sending}
        />
        <button type="submit" className="btn-primary" disabled={sending || !draft.trim()}>
          <Send className="w-4 h-4" aria-hidden />
          {t('app.askAi.send')}
        </button>
      </form>
    </div>
  );
}
