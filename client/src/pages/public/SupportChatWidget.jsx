import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../../components/icons/AppIcon';
import { api } from '../../lib/api';
import { getSupportSocket } from '../../lib/socket';
import { usePublicSite } from '../../hooks/usePublicSite';
import { supportT } from './supportChatI18n';

const SESSION_KEY = 'supportChatSession';
const SEEN_KEY = 'supportChatSeenAt';

function readSeenMap() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeSeenMap(map) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(map));
}

function schoolReplies(inquiry) {
  return (inquiry?.replies || []).filter((r) => !r.isVisitor);
}

function countUnreadForInquiry(inquiry, seenMap, options = {}) {
  if (!inquiry?.id) return 0;
  // Currently viewing this open chat → treated as read
  if (options.open && options.activeChatId === inquiry.id) return 0;
  const seenAt = seenMap[inquiry.id] ? new Date(seenMap[inquiry.id]).getTime() : 0;
  return schoolReplies(inquiry).filter((r) => new Date(r.createdAt).getTime() > seenAt).length;
}

function totalUnread(inquiries, seenMap, options = {}) {
  return (inquiries || []).reduce((sum, item) => sum + countUnreadForInquiry(item, seenMap, options), 0);
}

function markInquirySeen(inquiryId) {
  if (!inquiryId) return readSeenMap();
  const map = readSeenMap();
  map[inquiryId] = new Date().toISOString();
  writeSeenMap(map);
  return map;
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';
}

function buildChatMessages(item, t) {
  const messages = [
    {
      id: `visitor-${item.id}`,
      side: 'visitor',
      name: item.name || t.you,
      role: t.you,
      body: item.message,
      createdAt: item.createdAt,
    },
    ...(item.replies || []).map((r) => ({
      id: r.id,
      side: r.isVisitor ? 'visitor' : 'school',
      name: r.isVisitor ? (item.name || t.you) : (r.byName || t.supportFallback),
      role: r.isVisitor ? t.you : (r.byRole || t.supportRole),
      body: r.body,
      createdAt: r.createdAt,
    })),
  ];
  return messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export default function SupportChatWidget() {
  const { locale } = usePublicSite();
  const t = supportT(locale);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('new');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResult, setOtpResult] = useState(null);
  const [sessionToken, setSessionToken] = useState('');
  const [replyResult, setReplyResult] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);
  const [draft, setDraft] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [startForm, setStartForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [starting, setStarting] = useState(false);
  const [typingName, setTypingName] = useState('');
  const [seenMap, setSeenMap] = useState(() => readSeenMap());
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const lastInquiryRef = useRef(null);
  const openRef = useRef(false);
  const activeChatIdRef = useRef(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    const openWidget = () => setOpen(true);
    window.addEventListener('open-support-chat', openWidget);
    return () => window.removeEventListener('open-support-chat', openWidget);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return;
    api.getSupportChatSession(saved)
      .then((data) => {
        setSessionToken(data.sessionToken);
        setReplyResult(data.inquiries || []);
        setActiveChatId(data.inquiries?.[0]?.id || null);
        setOtpEmail(data.visitorEmail || '');
        setMode('continue');
        // Join all inquiry rooms for live unread updates
        const socket = getSupportSocket();
        (data.inquiries || []).forEach((item) => socket.emit('join_inquiry', item.id));
      })
      .catch(() => localStorage.removeItem(SESSION_KEY));
  }, []);

  const unreadCount = useMemo(
    () => totalUnread(replyResult, seenMap, { open, activeChatId }),
    [replyResult, seenMap, open, activeChatId],
  );

  const activeChat = useMemo(
    () => (replyResult || []).find((item) => item.id === activeChatId) || null,
    [replyResult, activeChatId],
  );

  const chatMessages = useMemo(
    () => (activeChat ? buildChatMessages(activeChat, t) : []),
    [activeChat, t],
  );

  const chattingWith = useMemo(() => {
    const names = [...new Set(
      (activeChat?.replies || [])
        .filter((r) => !r.isVisitor)
        .map((r) => r.byName)
        .filter(Boolean),
    )];
    return names.length ? names.join(', ') : t.supportFallback;
  }, [activeChat, t.supportFallback]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length, open, activeChatId, typingName]);

  useEffect(() => {
    const socket = getSupportSocket();
    const onUpdated = (inquiry) => {
      if (!inquiry?.id) return;
      setReplyResult((prev) => {
        if (!prev) return prev;
        const exists = prev.some((item) => item.id === inquiry.id);
        if (!exists) return [...prev, inquiry];
        return prev.map((item) => (item.id === inquiry.id ? inquiry : item));
      });
      setTypingName('');

      // If user is currently viewing this chat with drawer open, mark as read
      if (openRef.current && activeChatIdRef.current === inquiry.id) {
        setSeenMap(markInquirySeen(inquiry.id));
      }
    };
    const onTyping = (payload) => {
      if (!payload?.inquiryId || payload.inquiryId !== activeChatId) return;
      if (payload.role === 'visitor') return;
      setTypingName(payload.isTyping ? (payload.name || t.supportRole) : '');
    };

    socket.on('inquiry_updated', onUpdated);
    socket.on('typing', onTyping);
    return () => {
      socket.off('inquiry_updated', onUpdated);
      socket.off('typing', onTyping);
    };
  }, [activeChatId, t.supportRole]);

  useEffect(() => {
    const socket = getSupportSocket();
    if (lastInquiryRef.current) {
      socket.emit('leave_inquiry', lastInquiryRef.current);
    }
    if (activeChatId) {
      socket.emit('join_inquiry', activeChatId);
      lastInquiryRef.current = activeChatId;
    }
    setTypingName('');
  }, [activeChatId]);

  // Mark as read when opening drawer on active chat, or switching conversations
  useEffect(() => {
    if (!open || !activeChatId) return;
    setSeenMap(markInquirySeen(activeChatId));
  }, [open, activeChatId, activeChat?.replies?.length]);

  const emitTyping = (isTyping) => {
    if (!activeChatId || !activeChat) return;
    getSupportSocket().emit('typing', {
      inquiryId: activeChatId,
      name: activeChat.name || t.you,
      role: 'visitor',
      isTyping,
    });
  };

  const handleDraftChange = (value) => {
    setDraft(value);
    emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 1200);
  };

  const enterChat = (token, inquiries, email) => {
    setSessionToken(token);
    localStorage.setItem(SESSION_KEY, token);
    setReplyResult(inquiries || []);
    setActiveChatId(inquiries?.[0]?.id || null);
    if (email) setOtpEmail(email);
    const socket = getSupportSocket();
    (inquiries || []).forEach((item) => socket.emit('join_inquiry', item.id));
  };

  const startChat = async (e) => {
    e.preventDefault();
    setStarting(true);
    setOtpResult(null);
    try {
      const data = await api.startSupportChat({ ...startForm, locale });
      setOtpEmail(startForm.email);
      setOtpRequested(true);
      setMode('continue');
      setOtpResult({ type: 'success', text: data.message || t.startSuccess });
      setStartForm({ name: '', email: startForm.email, subject: '', message: '' });
    } catch (err) {
      setOtpResult({ type: 'error', text: err.message });
    } finally {
      setStarting(false);
    }
  };

  const requestOtp = async (e) => {
    e.preventDefault();
    setOtpLoading(true);
    setOtpResult(null);
    try {
      const data = await api.requestContactRepliesOtp(otpEmail, locale);
      setOtpRequested(true);
      setOtpResult({ type: 'success', text: data.message || t.otpSent });
    } catch (err) {
      setOtpResult({ type: 'error', text: err.message });
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setOtpLoading(true);
    setOtpResult(null);
    try {
      const data = await api.verifyContactRepliesOtp(otpEmail, otpCode);
      enterChat(data.sessionToken, data.inquiries || [], data.visitorEmail);
      setOtpResult({ type: 'success', text: t.connected });
    } catch (err) {
      setOtpResult({ type: 'error', text: err.message });
    } finally {
      setOtpLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!draft.trim() || !activeChat || !sessionToken) return;
    setSendingMsg(true);
    emitTyping(false);
    try {
      const updated = await api.sendSupportChatMessage({
        sessionToken,
        inquiryId: activeChat.id,
        body: draft.trim(),
      });
      setReplyResult((prev) => (prev || []).map((item) => (item.id === updated.id ? updated : item)));
      setDraft('');
    } catch (err) {
      setOtpResult({ type: 'error', text: err.message });
      if (String(err.message || '').toLowerCase().includes('expired')) {
        localStorage.removeItem(SESSION_KEY);
        setSessionToken('');
        setReplyResult(null);
      }
    } finally {
      setSendingMsg(false);
    }
  };

  const logoutChat = () => {
    if (activeChatId) getSupportSocket().emit('leave_inquiry', activeChatId);
    localStorage.removeItem(SESSION_KEY);
    setSessionToken('');
    setReplyResult(null);
    setActiveChatId(null);
    setOtpCode('');
    setOtpRequested(false);
    setMode('new');
    setTypingName('');
  };

  const inChat = Boolean(sessionToken && replyResult?.length);

  return (
    <>
      <button
        type="button"
        className={`ps-support-fab ${open ? 'is-hidden' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={t.openAria}
      >
        <AppIcon name="chat" className="w-[22px] h-[22px]" />
        <span>{t.help}</span>
        {unreadCount > 0 && (
          <span className="ps-support-unread" aria-label={`${unreadCount} unread`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <div className={`ps-support-drawer ${open ? 'is-open' : ''}`} role="dialog" aria-label={t.title}>
        <div className="ps-support-drawer-header">
          <div>
            <p className="ps-support-eyebrow">{t.eyebrow}</p>
            <h3>{t.title}</h3>
          </div>
          <button type="button" className="ps-support-close" onClick={() => setOpen(false)} aria-label={t.closeAria}>
            <AppIcon name="close" className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="ps-support-drawer-body">
          {!inChat ? (
            <div className="ps-support-auth">
              <div className="ps-support-tabs">
                <button type="button" className={mode === 'new' ? 'is-active' : ''} onClick={() => setMode('new')}>
                  {t.newChat}
                </button>
                <button type="button" className={mode === 'continue' ? 'is-active' : ''} onClick={() => setMode('continue')}>
                  {t.continueChat}
                </button>
              </div>

              {otpResult && (
                <div className={`ps-contact-alert ${otpResult.type === 'success' ? 'ps-contact-alert--success' : 'ps-contact-alert--error'}`}>
                  {otpResult.text}
                </div>
              )}

              {mode === 'new' ? (
                <form className="ps-support-auth-form" onSubmit={startChat}>
                  <p className="ps-support-intro">{t.startIntro}</p>
                  <label className="ps-contact-label">{t.yourName}</label>
                  <input className="ps-contact-input" required value={startForm.name} onChange={(e) => setStartForm({ ...startForm, name: e.target.value })} />
                  <label className="ps-contact-label" style={{ marginTop: '0.65rem' }}>{t.email}</label>
                  <input className="ps-contact-input" type="email" required value={startForm.email} onChange={(e) => setStartForm({ ...startForm, email: e.target.value })} />
                  <label className="ps-contact-label" style={{ marginTop: '0.65rem' }}>{t.subject}</label>
                  <input className="ps-contact-input" value={startForm.subject} onChange={(e) => setStartForm({ ...startForm, subject: e.target.value })} placeholder={t.subjectPlaceholder} />
                  <label className="ps-contact-label" style={{ marginTop: '0.65rem' }}>{t.message}</label>
                  <textarea className="ps-contact-input ps-contact-textarea" required rows={4} value={startForm.message} onChange={(e) => setStartForm({ ...startForm, message: e.target.value })} />
                  <button type="submit" className="ps-btn ps-btn-primary" style={{ marginTop: '1rem', width: '100%' }} disabled={starting}>
                    {starting ? t.starting : t.startBtn}
                  </button>
                </form>
              ) : (
                <form className="ps-support-auth-form" onSubmit={otpRequested ? verifyOtp : requestOtp}>
                  <p className="ps-support-intro">{t.continueIntro}</p>
                  <label className="ps-contact-label">{t.email}</label>
                  <input className="ps-contact-input" type="email" required value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} />
                  {otpRequested && (
                    <>
                      <label className="ps-contact-label" style={{ marginTop: '0.65rem' }}>{t.otpCode}</label>
                      <input className="ps-contact-input" required value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder={t.otpPlaceholder} />
                    </>
                  )}
                  <button type="submit" className="ps-btn ps-btn-primary" style={{ marginTop: '1rem', width: '100%' }} disabled={otpLoading}>
                    {otpLoading ? t.pleaseWait : otpRequested ? t.openChat : t.sendOtp}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="ps-support-chat">
              <div className="ps-support-threads">
                {replyResult.map((item) => {
                  const staff = [...new Set((item.replies || []).filter((r) => !r.isVisitor).map((r) => r.byName).filter(Boolean))];
                  const itemUnread = countUnreadForInquiry(item, seenMap, { open, activeChatId });
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`ps-support-thread ${activeChatId === item.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setActiveChatId(item.id);
                        setSeenMap(markInquirySeen(item.id));
                      }}
                    >
                      <span className="ps-chat-avatar">{initials(staff[0] || t.supportRole)}</span>
                      <span>
                        <strong>{item.subject || t.title}</strong>
                        <small>{t.with}: {staff.length ? staff.join(', ') : t.supportFallback}</small>
                      </span>
                      {itemUnread > 0 && <span className="ps-support-thread-unread">{itemUnread}</span>}
                    </button>
                  );
                })}
              </div>

              {activeChat && (
                <div className="ps-support-messages-wrap">
                  <div className="ps-support-chat-head">
                    <div>
                      <strong>{activeChat.subject || t.title}</strong>
                      <span>{t.you} ({activeChat.name}) · {chattingWith}</span>
                    </div>
                    <button type="button" className="ps-support-logout" onClick={logoutChat}>{t.logout}</button>
                  </div>
                  <div className="ps-support-messages">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`ps-chat-row ${msg.side === 'visitor' ? 'is-visitor' : 'is-school'}`}
                      >
                        <div className="ps-chat-avatar" title={msg.name}>{initials(msg.name)}</div>
                        <div className="ps-chat-bubble">
                          <div className="ps-chat-bubble-meta">
                            <strong>{msg.name}</strong>
                            <span>{msg.role}</span>
                            <time>{new Date(msg.createdAt).toLocaleString(locale)}</time>
                          </div>
                          <p>{msg.body}</p>
                        </div>
                      </div>
                    ))}
                    {typingName && (
                      <div className="ps-typing-indicator">
                        <span className="ps-typing-dots"><i /><i /><i /></span>
                        {typingName} {t.typing}
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <form className="ps-support-composer" onSubmit={sendMessage}>
                    <input
                      className="ps-contact-input"
                      placeholder={t.typePlaceholder}
                      value={draft}
                      onChange={(e) => handleDraftChange(e.target.value)}
                      onBlur={() => emitTyping(false)}
                    />
                    <button type="submit" className="ps-btn ps-btn-primary" disabled={!draft.trim() || sendingMsg}>
                      <AppIcon name="send" className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {open && <button type="button" className="ps-support-backdrop" aria-label={t.closeAria} onClick={() => setOpen(false)} />}
    </>
  );
}
