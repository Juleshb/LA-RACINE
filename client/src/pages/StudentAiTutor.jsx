import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Bot, Calculator, CircleHelp, FlaskConical, Gauge, History, Languages,
  Loader2, MessageCirclePlus, Pause, Play, Send, SkipBack, SkipForward,
  Sparkles, Square, Trash2, Volume2, VolumeX, X,
} from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { api } from '../lib/api';
import AiMarkdown from '../components/student/AiMarkdown';
import SpokenTextHighlight from '../components/student/SpokenTextHighlight';
import AiTutorGuide, { AiTutorGuideTrigger } from '../components/student/AiTutorGuide';
import {
  cycleSpeechPlayerRate,
  detectSpeechLang,
  getAutoSpeakPref,
  getSpeechRatePref,
  isSpeechSupported,
  pauseSpeechPlayer,
  resumeSpeechPlayer,
  setAutoSpeakPref,
  speechNext,
  speechPrevious,
  startSpeechPlayer,
  stopSpeaking,
  subscribeSpeechPlayer,
  warmSpeechVoices,
} from '../lib/speech';

const GUIDE_SEEN_KEY = 'laracine_ai_guide_seen';

const TOPICS = [
  { key: 'aiTutor.suggestMath', icon: Calculator, tone: 'math' },
  { key: 'aiTutor.suggestScience', icon: FlaskConical, tone: 'science' },
  { key: 'aiTutor.suggestHomework', icon: BookOpen, tone: 'study' },
  { key: 'aiTutor.suggestFrench', icon: Languages, tone: 'lang' },
];

function TypingDots() {
  return (
    <span className="ai-tutor-typing" aria-hidden>
      <i /><i /><i />
    </span>
  );
}

function MessageBubble({
  role,
  content,
  isStreaming,
  name,
  canSpeak,
  isSpeaking,
  onSpeak,
  speakLabel,
  speechHighlight,
}) {
  const isUser = role === 'user';
  const showTyping = isStreaming && !content;

  return (
    <div className={`ai-tutor-msg ${isUser ? 'is-user' : 'is-ai'} ${isStreaming ? 'is-streaming' : ''} ${isSpeaking ? 'is-speaking' : ''}`}>
      {!isUser && (
        <span className="ai-tutor-avatar" aria-hidden>
          <Bot className="w-4 h-4" />
        </span>
      )}
      <div className="ai-tutor-bubble-wrap">
        {!isUser && (
          <div className="ai-tutor-msg-meta">
            <p className="ai-tutor-msg-name">{name}</p>
            {canSpeak && content && !isStreaming && (
              <button
                type="button"
                className={`ai-tutor-speak-btn ${isSpeaking ? 'is-active' : ''}`}
                onClick={onSpeak}
                aria-label={speakLabel}
                title={speakLabel}
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        <div className={`ai-tutor-bubble ${isSpeaking ? 'is-speaking' : ''}`}>
          {showTyping ? (
            <TypingDots />
          ) : isUser ? (
            <p className="ai-tutor-user-text">{content}</p>
          ) : isSpeaking && speechHighlight?.sentences?.length ? (
            <SpokenTextHighlight
              sentences={speechHighlight.sentences}
              activeIndex={speechHighlight.index}
              wordStart={speechHighlight.wordStart}
              wordEnd={speechHighlight.wordEnd}
              paused={speechHighlight.paused}
            />
          ) : (
            <AiMarkdown content={content} streaming={isStreaming} />
          )}
        </div>
      </div>
    </div>
  );
}

function VoicePlayerBar({ player, t }) {
  if (!player?.active) return null;
  const paused = player.status === 'paused';
  const speedLabel = `${player.rate}×`;

  return (
    <div className="ai-glass ai-tutor-player" role="group" aria-label={t('aiTutor.voicePlayer')}>
      <div className="ai-tutor-player-info">
        <p className="ai-tutor-player-kicker">{t('aiTutor.nowPlaying')}</p>
        <p className="ai-tutor-player-preview">{player.preview || t('aiTutor.assistantName')}</p>
        <p className="ai-tutor-player-progress">
          {t('aiTutor.sentenceProgress', { current: player.index + 1, total: player.total })}
        </p>
      </div>

      <div className="ai-tutor-player-controls">
        <button
          type="button"
          className="ai-tutor-player-btn"
          onClick={speechPrevious}
          aria-label={t('aiTutor.prevSentence')}
          title={t('aiTutor.prevSentence')}
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          type="button"
          className="ai-tutor-player-btn ai-tutor-player-btn-main"
          onClick={paused ? resumeSpeechPlayer : pauseSpeechPlayer}
          aria-label={paused ? t('aiTutor.resume') : t('aiTutor.pause')}
          title={paused ? t('aiTutor.resume') : t('aiTutor.pause')}
        >
          {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
        </button>

        <button
          type="button"
          className="ai-tutor-player-btn"
          onClick={speechNext}
          disabled={!player.canNext}
          aria-label={t('aiTutor.nextSentence')}
          title={t('aiTutor.nextSentence')}
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <button
          type="button"
          className="ai-tutor-player-btn ai-tutor-player-speed"
          onClick={cycleSpeechPlayerRate}
          aria-label={t('aiTutor.changeSpeed')}
          title={t('aiTutor.changeSpeed')}
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>{speedLabel}</span>
        </button>

        <button
          type="button"
          className="ai-tutor-player-btn"
          onClick={stopSpeaking}
          aria-label={t('aiTutor.stopSpeak')}
          title={t('aiTutor.stopSpeak')}
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
}

function formatChatWhen(date, language) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(language === 'en' ? undefined : language, {
    month: 'short',
    day: 'numeric',
  });
}

export default function StudentAiTutor() {
  const { campusId } = useParams();
  const { t, language } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const speechOk = isSpeechSupported();
  const [autoSpeak, setAutoSpeak] = useState(() => speechOk && getAutoSpeakPref());
  const [player, setPlayer] = useState(() => ({
    active: false,
    status: 'idle',
    index: 0,
    total: 0,
    rate: getSpeechRatePref(),
    messageIndex: null,
    canPrev: false,
    canNext: false,
    preview: '',
    sentences: [],
    wordStart: 0,
    wordEnd: 0,
  }));
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const autoSpeakRef = useRef(autoSpeak);

  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);

  const scrollThreadToBottom = useCallback((smooth = true) => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    return api.getStudentAiChats()
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    warmSpeechVoices();
    const unsub = speechOk ? subscribeSpeechPlayer(setPlayer) : () => {};
    api.getStudentAiStatus()
      .then((data) => setConfigured(Boolean(data?.configured)))
      .catch(() => setConfigured(false));
    loadHistory();
    try {
      if (localStorage.getItem(GUIDE_SEEN_KEY) !== '1') {
        setGuideOpen(true);
      }
    } catch {
      /* ignore */
    }
    return () => {
      unsub();
      stopSpeaking();
    };
  }, [loadHistory, speechOk]);

  const closeGuide = () => {
    setGuideOpen(false);
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    scrollThreadToBottom(true);
  }, [messages, sending, scrollThreadToBottom]);

  useEffect(() => {
    autoResize(inputRef.current);
  }, [input]);

  const toggleAutoSpeak = () => {
    if (!speechOk) return;
    setAutoSpeak((prev) => {
      const next = !prev;
      setAutoSpeakPref(next);
      if (!next) stopSpeaking();
      return next;
    });
  };

  const speakMessage = useCallback((index, content) => {
    if (!speechOk || !content) return;
    const lang = detectSpeechLang(content, language);
    startSpeechPlayer({
      raw: content,
      lang,
      rate: getSpeechRatePref(),
      messageIndex: index,
    });
  }, [language, speechOk]);

  const persistChat = async (id, nextMessages) => {
    try {
      const saved = await api.saveStudentAiChat({ id: id || undefined, messages: nextMessages });
      setConversationId(saved.id);
      loadHistory();
      return saved.id;
    } catch (err) {
      console.error(err);
      return id;
    }
  };

  const send = async (text) => {
    const content = String(text || '').trim();
    if (!content || sending || !configured) return;

    stopSpeaking();
    setError('');
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const nextMessages = [...messages, { role: 'user', content }];
    setMessages([...nextMessages, { role: 'assistant', content: '', streaming: true }]);
    setSending(true);

    try {
      let assistantText = '';
      await api.streamStudentAiChat(
        { messages: nextMessages },
        {
          onChunk: (chunk) => {
            assistantText += chunk;
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === 'assistant') {
                copy[copy.length - 1] = {
                  ...last,
                  content: `${last.content || ''}${chunk}`,
                  streaming: true,
                };
              }
              return copy;
            });
          },
        },
      );

      const finalAssistant = assistantText || t('aiTutor.emptyReply');
      const finalMessages = [...nextMessages, { role: 'assistant', content: finalAssistant }];
      setMessages(finalMessages);
      await persistChat(conversationId, finalMessages);

      if (autoSpeakRef.current && speechOk && finalAssistant) {
        speakMessage(finalMessages.length - 1, finalAssistant);
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'assistant' && m.streaming)));
      setError(err.message || t('aiTutor.error'));
      setInput(content);
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const startNewChat = () => {
    if (sending) return;
    stopSpeaking();
    setMessages([]);
    setConversationId(null);
    setError('');
    inputRef.current?.focus();
  };

  const openChat = async (id) => {
    if (sending || loadingChat) return;
    stopSpeaking();
    setLoadingChat(true);
    setError('');
    try {
      const chat = await api.getStudentAiChat(id);
      setConversationId(chat.id);
      setMessages((chat.messages || []).map((m) => ({ role: m.role, content: m.content })));
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 919px)').matches) {
        setHistoryOpen(false);
      }
      requestAnimationFrame(() => scrollThreadToBottom(false));
    } catch (err) {
      setError(err.message || t('aiTutor.error'));
    } finally {
      setLoadingChat(false);
    }
  };

  const removeChat = async (id, e) => {
    e?.stopPropagation?.();
    if (sending) return;
    if (!window.confirm(t('aiTutor.deleteConfirm'))) return;
    try {
      await api.deleteStudentAiChat(id);
      if (conversationId === id) startNewChat();
      loadHistory();
    } catch (err) {
      setError(err.message || t('aiTutor.error'));
    }
  };

  const empty = messages.length === 0 && !loadingChat;

  return (
    <div className={`ai-tutor-page ${historyOpen ? 'has-history' : ''}`}>
      <div className="ai-tutor-ambient" aria-hidden>
        <span className="ai-tutor-blob ai-tutor-blob-a" />
        <span className="ai-tutor-blob ai-tutor-blob-b" />
        <span className="ai-tutor-blob ai-tutor-blob-c" />
      </div>

      <AiTutorGuide open={guideOpen} onClose={closeGuide} t={t} />

      {historyOpen && (
        <button
          type="button"
          className="ai-tutor-history-scrim"
          aria-label={t('ui.close')}
          onClick={() => setHistoryOpen(false)}
        />
      )}

      {historyOpen && (
        <aside className="ai-glass ai-tutor-history" aria-label={t('aiTutor.history')}>
          <div className="ai-tutor-history-head">
            <div>
              <p className="ai-tutor-history-kicker">{t('aiTutor.history')}</p>
              <h2>{t('aiTutor.historyTitle')}</h2>
            </div>
            <button
              type="button"
              className="ai-glass-icon-btn"
              onClick={() => setHistoryOpen(false)}
              aria-label={t('ui.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="ai-tutor-history-scroll">
            {historyLoading ? (
              <p className="ai-tutor-history-empty">{t('ui.loading')}</p>
            ) : history.length === 0 ? (
              <p className="ai-tutor-history-empty">{t('aiTutor.historyEmpty')}</p>
            ) : (
              <ul className="ai-tutor-history-list">
                {history.map((chat) => (
                  <li key={chat.id}>
                    <button
                      type="button"
                      className={`ai-tutor-history-item ${conversationId === chat.id ? 'is-active' : ''}`}
                      onClick={() => openChat(chat.id)}
                      disabled={loadingChat}
                    >
                      <span className="ai-tutor-history-title">{chat.title}</span>
                      <span className="ai-tutor-history-meta">
                        {formatChatWhen(chat.updatedAt, language)}
                        {' · '}
                        {t('aiTutor.messageCount', { count: chat.messageCount })}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="ai-tutor-history-delete"
                      onClick={(e) => removeChat(chat.id, e)}
                      title={t('ui.delete')}
                      aria-label={t('ui.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ai-tutor-history-foot">
            <button type="button" className="ai-glass-btn" onClick={startNewChat} disabled={sending}>
              <MessageCirclePlus className="w-4 h-4" />
              {t('aiTutor.newChat')}
            </button>
          </div>
        </aside>
      )}

      <section className="ai-glass ai-tutor-stage">
        <header className="ai-tutor-chrome">
          <div className="ai-tutor-chrome-left">
            <Link to={`/campus/${campusId}`} className="ai-glass-icon-btn" title={t('common.backHome')}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="ai-tutor-brand-mark" aria-hidden>
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="ai-tutor-brand-title">{t('aiTutor.title')}</h1>
              <p className="ai-tutor-brand-sub">
                <span className={`ai-tutor-status-dot ${configured ? 'is-on' : 'is-off'}`} />
                {configured ? t('aiTutor.statusReady') : t('aiTutor.statusOff')}
                {conversationId ? ` · ${t('aiTutor.savedChat')}` : ''}
              </p>
            </div>
          </div>

          <div className="ai-tutor-chrome-actions">
            <AiTutorGuideTrigger onClick={() => setGuideOpen(true)} t={t} />
            {speechOk && (
              <button
                type="button"
                className={`ai-glass-btn ${autoSpeak ? 'is-active' : ''}`}
                onClick={toggleAutoSpeak}
                title={autoSpeak ? t('aiTutor.voiceOn') : t('aiTutor.voiceOff')}
                aria-pressed={autoSpeak}
                aria-label={autoSpeak ? t('aiTutor.voiceOn') : t('aiTutor.voiceOff')}
              >
                {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="ai-btn-label">{t('aiTutor.voice')}</span>
              </button>
            )}
            <button
              type="button"
              className={`ai-glass-btn ${historyOpen ? 'is-active' : ''}`}
              onClick={() => setHistoryOpen((v) => !v)}
              disabled={sending}
            >
              <History className="w-4 h-4" />
              <span className="ai-btn-label">{t('aiTutor.history')}</span>
              {history.length > 0 && <em>{history.length}</em>}
            </button>
            <button
              type="button"
              className="ai-glass-btn ai-glass-btn-primary"
              onClick={startNewChat}
              disabled={sending || (empty && !conversationId)}
            >
              <MessageCirclePlus className="w-4 h-4" />
              <span className="ai-btn-label">{t('aiTutor.newChat')}</span>
            </button>
          </div>
        </header>

        {!configured && (
          <div className="ai-tutor-banner is-warn" role="status">
            {t('aiTutor.notConfigured')}
          </div>
        )}

        <div
          ref={threadRef}
          className="ai-tutor-thread"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {loadingChat ? (
            <div className="ai-tutor-loading-chat">
              <Loader2 className="w-6 h-6 animate-spin text-teal-700" />
              <p>{t('ui.loading')}</p>
            </div>
          ) : empty ? (
            <div className="ai-tutor-empty">
              <div className="ai-tutor-hero">
                <span className="ai-tutor-hero-orb" aria-hidden>
                  <Bot className="w-8 h-8" />
                </span>
                <h2>{t('aiTutor.welcomeTitle')}</h2>
                <p>{t('aiTutor.welcomeBody')}</p>
                <p className="ai-tutor-lang-note">{t('aiTutor.languageNote')}</p>
                {speechOk && (
                  <p className="ai-tutor-voice-note">{t('aiTutor.voiceHint')}</p>
                )}
                <button
                  type="button"
                  className="ai-glass-btn ai-tutor-guide-cta"
                  onClick={() => setGuideOpen(true)}
                >
                  <CircleHelp className="w-4 h-4" />
                  {t('aiTutor.guideOpen')}
                </button>
                <ol className="ai-tutor-quick-steps" aria-label={t('aiTutor.guideStepsTitle')}>
                  <li><span>1</span>{t('aiTutor.guideStep1')}</li>
                  <li><span>2</span>{t('aiTutor.guideStep2')}</li>
                  <li><span>3</span>{t('aiTutor.guideStep3')}</li>
                </ol>
              </div>
              <div className="ai-tutor-topics" role="list">
                {TOPICS.map(({ key, icon: Icon, tone }) => (
                  <button
                    key={key}
                    type="button"
                    role="listitem"
                    className={`ai-glass ai-tutor-topic ai-tutor-topic-${tone}`}
                    onClick={() => send(t(key))}
                    disabled={sending || !configured}
                  >
                    <span className="ai-tutor-topic-icon" aria-hidden>
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="ai-tutor-topic-text">{t(key)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ai-tutor-messages">
              {messages.map((m, index) => (
                <MessageBubble
                  key={`${m.role}-${index}`}
                  role={m.role}
                  content={m.content}
                  isStreaming={Boolean(m.streaming)}
                  name={t('aiTutor.assistantName')}
                  canSpeak={speechOk && m.role === 'assistant'}
                  isSpeaking={player.active && player.messageIndex === index}
                  speechHighlight={
                    player.active && player.messageIndex === index
                      ? {
                          sentences: player.sentences,
                          index: player.index,
                          wordStart: player.wordStart,
                          wordEnd: player.wordEnd,
                          paused: player.status === 'paused',
                        }
                      : null
                  }
                  onSpeak={() => speakMessage(index, m.content)}
                  speakLabel={t('aiTutor.speak')}
                />
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="ai-tutor-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setError('')}>{t('ui.close')}</button>
          </div>
        )}

        <VoicePlayerBar player={player} t={t} />

        <form
          className="ai-tutor-dock"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="ai-glass ai-tutor-composer-card">
            <label className="ai-tutor-composer-label" htmlFor="ai-tutor-input">
              {t('aiTutor.writeLabel')}
            </label>
            <div className="ai-tutor-input-shell">
              <textarea
                id="ai-tutor-input"
                ref={inputRef}
                className="ai-tutor-input"
                rows={1}
                value={input}
                disabled={sending || !configured || loadingChat}
                placeholder={t('aiTutor.placeholder')}
                aria-label={t('aiTutor.placeholder')}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <button
                type="submit"
                className="ai-tutor-send"
                disabled={sending || !configured || loadingChat || !input.trim()}
                aria-label={t('aiTutor.send')}
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            <p className="ai-tutor-hint">
              {sending
                ? t('aiTutor.thinking')
                : autoSpeak && speechOk
                  ? t('aiTutor.hintVoice')
                  : t('aiTutor.hint')}
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
