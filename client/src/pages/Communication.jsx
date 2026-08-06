import { useEffect, useMemo, useState, useRef } from 'react';
import {
  MessageSquare, Send, Megaphone, Plus, ArrowLeft, CheckCircle2,
  Globe, Inbox, Mail, Phone, RefreshCw, Search, Sparkles, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSupportSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { useTranslation } from '../context/LanguageContext';
import StudentSelect from '../components/StudentSelect';

const CATEGORIES = [
  { value: 'GENERAL', labelKey: 'pages.communication.categoryGeneral' },
  { value: 'ACADEMICS', labelKey: 'pages.communication.categoryAcademics' },
  { value: 'FEES', labelKey: 'pages.communication.categoryFees' },
  { value: 'TRANSPORT', labelKey: 'pages.communication.categoryTransport' },
  { value: 'DISCIPLINE', labelKey: 'pages.communication.categoryDiscipline' },
  { value: 'EVENTS', labelKey: 'pages.communication.categoryEvents' },
  { value: 'ATTENDANCE', labelKey: 'pages.communication.categoryAttendance' },
];

const TARGETS = [
  { value: 'ALL_PARENTS', labelKey: 'pages.communication.targetAllParents' },
  { value: 'CLASS', labelKey: 'pages.communication.targetClass' },
  { value: 'STUDENT', labelKey: 'pages.communication.targetStudent' },
];

function categoryClass(cat) {
  const map = {
    TRANSPORT: 'is-transport',
    FEES: 'is-fees',
    DISCIPLINE: 'is-discipline',
    ACADEMICS: 'is-academics',
    EVENTS: 'is-events',
    ATTENDANCE: 'is-attendance',
  };
  return map[cat] || 'is-general';
}

function formatWhen(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleString([], {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function CategoryBadge({ category, t }) {
  const found = CATEGORIES.find((c) => c.value === category);
  return (
    <span className={`comm-chip ${categoryClass(category)}`}>
      {found ? t(found.labelKey) : category}
    </span>
  );
}

export default function Communication() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isParent = user?.role === 'PARENT';
  const isStudent = user?.role === 'STUDENT';
  const isTeacher = user?.role === 'TEACHER';
  const isSchool = !['PARENT', 'STUDENT'].includes(user?.role);
  const isFamily = isParent || isStudent;

  const [inbox, setInbox] = useState([]);
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState('');
  const [children, setChildren] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [contactInquiries, setContactInquiries] = useState([]);
  const [activeInquiry, setActiveInquiry] = useState(null);
  const [inquiryReply, setInquiryReply] = useState('');
  const [inquiryReplying, setInquiryReplying] = useState(false);
  const [viewTab, setViewTab] = useState('inbox');
  const [contactError, setContactError] = useState('');
  const [visitorTyping, setVisitorTyping] = useState('');
  const [inboxQuery, setInboxQuery] = useState('');
  const [websiteQuery, setWebsiteQuery] = useState('');
  const [channels, setChannels] = useState({
    inApp: true,
    sms: { configured: false },
    email: { configured: false },
  });
  const [deliveryResult, setDeliveryResult] = useState(null);
  const messagesEndRef = useRef(null);
  const inquiryEndRef = useRef(null);
  const inquiryTypingTimer = useRef(null);
  const activeInquiryIdRef = useRef(null);

  const unreadCount = useMemo(
    () => inbox.filter((item) => !item.isRead).length,
    [inbox],
  );
  const openWebsiteCount = useMemo(
    () => contactInquiries.filter((i) => i.status === 'OPEN').length,
    [contactInquiries],
  );

  const filteredInbox = useMemo(() => {
    const q = inboxQuery.trim().toLowerCase();
    if (!q) return inbox;
    return inbox.filter((item) => {
      const haystack = [
        item.title,
        item.body,
        item.studentName,
        item.category,
        item.type,
        item.createdBy,
        item.priority,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [inbox, inboxQuery]);

  const filteredInquiries = useMemo(() => {
    const q = websiteQuery.trim().toLowerCase();
    if (!q) return contactInquiries;
    return contactInquiries.filter((item) => {
      const haystack = [
        item.subject,
        item.name,
        item.email,
        item.status,
        item.campus?.name,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [contactInquiries, websiteQuery]);

  const pageTitle = isStudent || isParent || isTeacher
    ? t('pages.communication.titleMessages')
    : t('pages.communication.title');
  const pageDescription = isStudent
    ? t('pages.communication.descriptionStudent')
    : isParent
      ? t('pages.communication.descriptionParent')
      : isTeacher
        ? t('pages.communication.descriptionTeacher')
        : isSchool
          ? t('pages.communication.description')
          : t('pages.communication.descriptionStaff');

  const loadInbox = () => {
    api.getCommunicationInbox().then((data) => setInbox(data.items || [])).catch(console.error);
  };

  const loadContactInquiries = () => {
    if (!isSchool) return;
    setContactError('');
    api.getAdminContactInquiries()
      .then(setContactInquiries)
      .catch((err) => {
        console.error(err);
        setContactError(err.message || t('pages.communication.contactLoadFailed'));
        setContactInquiries([]);
      });
  };

  useEffect(() => {
    loadInbox();
    if (isParent) {
      api.getCommunicationChildren().then(setChildren).catch(console.error);
    }
    if (isSchool) {
      api.getClasses().then(setClasses).catch(console.error);
      api.getStudents().then(setStudents).catch(console.error);
      loadContactInquiries();
      api.getCommunicationChannels()
        .then(setChannels)
        .catch(() => setChannels({
          inApp: true,
          sms: { configured: false },
          email: { configured: false },
        }));
    }
  }, [isParent, isSchool]);

  useEffect(() => {
    activeInquiryIdRef.current = activeInquiry?.id || null;
  }, [activeInquiry?.id]);

  useEffect(() => {
    if (!isSchool) return undefined;
    const socket = getSupportSocket();
    socket.emit('join_admin_contact');

    const upsertInquiry = (inquiry) => {
      if (!inquiry?.id) return;
      setContactInquiries((prev) => {
        const others = (prev || []).filter((item) => item.id !== inquiry.id);
        return [
          {
            id: inquiry.id,
            name: inquiry.name,
            email: inquiry.email,
            subject: inquiry.subject,
            status: inquiry.status,
            createdAt: inquiry.createdAt,
            updatedAt: inquiry.updatedAt,
            campus: inquiry.campus,
            _count: { replies: inquiry.replies?.length || 0 },
          },
          ...others,
        ];
      });
      if (activeInquiryIdRef.current === inquiry.id) {
        setActiveInquiry(inquiry);
        setVisitorTyping('');
      }
    };

    const onCreated = (inquiry) => upsertInquiry(inquiry);
    const onUpdated = (inquiry) => upsertInquiry(inquiry);
    const onTyping = (payload) => {
      if (!payload?.inquiryId || payload.inquiryId !== activeInquiryIdRef.current) return;
      if (payload.role !== 'visitor') return;
      setVisitorTyping(payload.isTyping ? (payload.name || 'Visitor') : '');
    };

    socket.on('inquiry_created', onCreated);
    socket.on('inquiry_updated', onUpdated);
    socket.on('typing', onTyping);

    return () => {
      socket.off('inquiry_created', onCreated);
      socket.off('inquiry_updated', onUpdated);
      socket.off('typing', onTyping);
    };
  }, [isSchool]);

  useEffect(() => {
    if (!isSchool) return undefined;
    const socket = getSupportSocket();
    if (activeInquiry?.id) {
      socket.emit('join_inquiry', activeInquiry.id);
      return () => socket.emit('leave_inquiry', activeInquiry.id);
    }
    return undefined;
  }, [isSchool, activeInquiry?.id]);

  useEffect(() => {
    if (thread) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [thread?.id, thread?.messages?.length]);

  useEffect(() => {
    if (activeInquiry) {
      setTimeout(() => inquiryEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [activeInquiry?.id, activeInquiry?.replies?.length, visitorTyping]);

  const openInquiry = async (id) => {
    const detail = await api.getAdminContactInquiry(id);
    setActiveInquiry(detail);
    setVisitorTyping('');
  };

  const emitStaffTyping = (isTyping) => {
    if (!activeInquiry?.id || !user) return;
    getSupportSocket().emit('typing', {
      inquiryId: activeInquiry.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Support',
      role: 'staff',
      isTyping,
    });
  };

  const handleInquiryReplyChange = (value) => {
    setInquiryReply(value);
    emitStaffTyping(true);
    if (inquiryTypingTimer.current) clearTimeout(inquiryTypingTimer.current);
    inquiryTypingTimer.current = setTimeout(() => emitStaffTyping(false), 1200);
  };

  const sendInquiryReply = async (e) => {
    e.preventDefault();
    if (!activeInquiry?.id || !inquiryReply.trim()) return;
    setInquiryReplying(true);
    emitStaffTyping(false);
    try {
      await api.replyAdminContactInquiry(activeInquiry.id, inquiryReply.trim());
      const next = await api.getAdminContactInquiry(activeInquiry.id);
      setActiveInquiry(next);
      setInquiryReply('');
      loadContactInquiries();
    } catch (err) {
      alert(err.message);
    } finally {
      setInquiryReplying(false);
    }
  };

  const openThread = async (id) => {
    const data = await api.getCommunicationThread(id);
    setThread(data);
  };

  const openAnnouncement = async (item) => {
    if (!item.isRead && isFamily && item.type === 'announcement') {
      await api.markBroadcastRead(item.id);
      loadInbox();
    }
    setThread({
      isAnnouncement: true,
      subject: item.title,
      category: item.category,
      delivery: item.delivery || null,
      messages: [{
        body: item.body,
        senderLabel: item.createdBy || t('pages.communication.schoolLabel'),
        createdAt: item.createdAt,
        isMine: false,
      }],
    });
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !thread?.id) return;
    try {
      const result = await api.replyCommunicationThread(thread.id, reply.trim());
      setReply('');
      const updated = await api.getCommunicationThread(thread.id);
      setThread(updated);
      loadInbox();
      if (isSchool && result?.email && channels.email?.configured) {
        setDeliveryResult({
          recipientsCount: 1,
          inApp: { recipientsCount: 1, readable: true },
          sms: null,
          email: result.email,
          wantedSms: false,
          wantedEmail: true,
        });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateThread = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await api.createCommunicationThread(form);
      closeModal();
      loadInbox();
      if (isSchool && result?.email && channels.email?.configured) {
        setDeliveryResult({
          recipientsCount: 1,
          inApp: { recipientsCount: 1, readable: true },
          sms: null,
          email: result.email,
          wantedSms: false,
          wantedEmail: true,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await api.createCommunicationBroadcast(form);
      setDeliveryResult({
        recipientsCount: result.recipientsCount || 0,
        inApp: result.delivery?.inApp || {
          recipientsCount: result.recipientsCount || 0,
          readable: true,
        },
        sms: result.sms || result.delivery?.sms || null,
        email: result.email || result.delivery?.email || null,
        wantedSms: Boolean(form.sendSms),
        wantedEmail: form.sendEmail !== false,
      });
      closeModal();
      loadInbox();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setModal(null);
    setForm({});
    setError('');
    setSubmitting(false);
  };

  const statusLabel = (status) => {
    if (status === 'OPEN') return t('pages.communication.statusOpen');
    if (status === 'REPLIED') return t('pages.communication.statusReplied');
    return status;
  };

  return (
    <div className="comm-page">
      <div className="comm-ambient" aria-hidden>
        <span className="comm-blob comm-blob-a" />
        <span className="comm-blob comm-blob-b" />
      </div>

      {deliveryResult && (
        <div className="comm-delivery-overlay" role="dialog" aria-modal="true" aria-labelledby="comm-delivery-title">
          <button type="button" className="comm-delivery-scrim" aria-label={t('ui.close')} onClick={() => setDeliveryResult(null)} />
          <div className="comm-delivery-card">
            <div className="comm-delivery-head">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="comm-panel-kicker">{t('pages.communication.deliveryKicker')}</p>
                <h2 id="comm-delivery-title">{t('pages.communication.deliveryTitle')}</h2>
              </div>
              <button type="button" className="comm-icon-btn" onClick={() => setDeliveryResult(null)} aria-label={t('ui.close')}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="comm-delivery-grid">
              <div className="comm-delivery-channel is-ok">
                <span className="comm-delivery-icon"><Inbox className="w-4 h-4" /></span>
                <div>
                  <p className="comm-delivery-label">{t('pages.communication.channelSystem')}</p>
                  <p className="comm-delivery-value">
                    {t('pages.communication.deliveryInApp', { count: deliveryResult.recipientsCount })}
                  </p>
                  <p className="comm-delivery-note">{t('pages.communication.deliveryInAppNote')}</p>
                </div>
              </div>

              <div className={`comm-delivery-channel ${!deliveryResult.wantedSms ? 'is-muted' : deliveryResult.sms?.sent > 0 ? 'is-ok' : 'is-warn'}`}>
                <span className="comm-delivery-icon"><Phone className="w-4 h-4" /></span>
                <div>
                  <p className="comm-delivery-label">{t('pages.communication.channelSms')}</p>
                  {!deliveryResult.wantedSms ? (
                    <p className="comm-delivery-value">{t('pages.communication.deliveryNotRequested')}</p>
                  ) : deliveryResult.sms ? (
                    <>
                      <p className="comm-delivery-value">
                        {t('pages.communication.smsSummary', {
                          sent: deliveryResult.sms.sent || 0,
                          failed: deliveryResult.sms.failed || 0,
                          skipped: deliveryResult.sms.skipped || 0,
                        })}
                      </p>
                      {deliveryResult.sms.error && (
                        <p className="comm-delivery-note is-error">{deliveryResult.sms.error}</p>
                      )}
                    </>
                  ) : (
                    <p className="comm-delivery-value">{t('pages.communication.smsNoResponse')}</p>
                  )}
                </div>
              </div>

              <div className={`comm-delivery-channel ${!deliveryResult.wantedEmail ? 'is-muted' : deliveryResult.email?.sent > 0 ? 'is-ok' : 'is-warn'}`}>
                <span className="comm-delivery-icon"><Mail className="w-4 h-4" /></span>
                <div>
                  <p className="comm-delivery-label">{t('pages.communication.channelEmail')}</p>
                  {!deliveryResult.wantedEmail ? (
                    <p className="comm-delivery-value">{t('pages.communication.deliveryNotRequested')}</p>
                  ) : deliveryResult.email ? (
                    <>
                      <p className="comm-delivery-value">
                        {t('pages.communication.emailSummary', {
                          sent: deliveryResult.email.sent || 0,
                          failed: deliveryResult.email.failed || 0,
                          skipped: deliveryResult.email.skipped || 0,
                        })}
                      </p>
                      {deliveryResult.email.error && (
                        <p className="comm-delivery-note is-error">{deliveryResult.email.error}</p>
                      )}
                    </>
                  ) : (
                    <p className="comm-delivery-value">{t('pages.communication.emailNoResponse')}</p>
                  )}
                </div>
              </div>
            </div>

            <button type="button" className="comm-btn comm-btn-primary comm-delivery-done" onClick={() => setDeliveryResult(null)}>
              {t('pages.communication.deliveryGotIt')}
            </button>
          </div>
        </div>
      )}

      <header className="comm-header">
        <div className="comm-header-copy">
          <p className="comm-kicker">
            <Sparkles className="w-3.5 h-3.5" />
            {t('pages.communication.kicker')}
          </p>
          <h1 className="comm-title">{pageTitle}</h1>
          <p className="comm-desc">{pageDescription}</p>
        </div>

        <div className="comm-header-actions">
          {unreadCount > 0 && (
            <span className="comm-stat-pill">{t('pages.communication.unreadCount', { count: unreadCount })}</span>
          )}
          {isFamily && (
            <button
              type="button"
              className="comm-btn comm-btn-primary"
              onClick={() => { setModal('thread'); setForm({ category: 'GENERAL' }); }}
            >
              <Send className="w-4 h-4" />
              {t('pages.communication.contactSchool')}
            </button>
          )}
          {isSchool && (
            <>
              <button
                type="button"
                className="comm-btn"
                onClick={() => {
                  setModal('broadcast');
                  setForm({
                    category: 'GENERAL',
                    priority: 'NORMAL',
                    targetType: 'ALL_PARENTS',
                    sendSms: false,
                    sendEmail: Boolean(channels.email?.configured),
                  });
                }}
              >
                <Megaphone className="w-4 h-4" />
                {t('ui.announcement')}
              </button>
              <button
                type="button"
                className="comm-btn comm-btn-primary"
                onClick={() => { setModal('thread'); setForm({ category: 'GENERAL' }); }}
              >
                <Plus className="w-4 h-4" />
                {t('ui.message')}
              </button>
            </>
          )}
        </div>
      </header>

      {isSchool && (
        <div className="comm-tabs" role="tablist" aria-label={t('pages.communication.title')}>
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'inbox'}
            className={`comm-tab ${viewTab === 'inbox' ? 'is-active' : ''}`}
            onClick={() => setViewTab('inbox')}
          >
            <Inbox className="w-4 h-4" />
            {t('pages.communication.tabInbox')}
            {unreadCount > 0 && <em>{unreadCount}</em>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'website'}
            className={`comm-tab ${viewTab === 'website' ? 'is-active' : ''}`}
            onClick={() => { setViewTab('website'); loadContactInquiries(); }}
          >
            <Globe className="w-4 h-4" />
            {t('pages.communication.tabWebsite')}
            {openWebsiteCount > 0 && <em>{openWebsiteCount}</em>}
          </button>
        </div>
      )}

      {(viewTab === 'inbox' || !isSchool) && (
        <div className={`comm-shell ${thread ? 'has-thread' : ''}`}>
          <aside className={`comm-list-panel ${thread ? 'is-hidden-mobile' : ''}`}>
            <div className="comm-panel-head">
              <div>
                <p className="comm-panel-kicker">{t('pages.communication.inbox')}</p>
                <h2>{t('pages.communication.conversations')}</h2>
              </div>
              <button type="button" className="comm-icon-btn" onClick={loadInbox} title={t('ui.refresh')} aria-label={t('ui.refresh')}>
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="comm-search">
              <Search className="comm-search-icon" aria-hidden />
              <input
                type="search"
                className="comm-search-input"
                value={inboxQuery}
                onChange={(e) => setInboxQuery(e.target.value)}
                placeholder={t('pages.communication.searchPlaceholder')}
                aria-label={t('pages.communication.searchPlaceholder')}
              />
              {inboxQuery && (
                <button
                  type="button"
                  className="comm-search-clear"
                  onClick={() => setInboxQuery('')}
                  aria-label={t('ui.close')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="comm-list-scroll">
              {inbox.length === 0 ? (
                <div className="comm-empty-list">
                  <MessageSquare className="w-8 h-8" />
                  <p>{t('pages.communication.noMessages')}</p>
                </div>
              ) : filteredInbox.length === 0 ? (
                <div className="comm-empty-list">
                  <Search className="w-8 h-8" />
                  <p>{t('ui.noSearchResults')}</p>
                </div>
              ) : filteredInbox.map((item) => {
                const active = thread && (
                  (item.type === 'thread' && thread.id === item.id)
                  || (item.type !== 'thread' && thread.isAnnouncement && thread.subject === item.title)
                );
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => (item.type === 'thread' ? openThread(item.id) : openAnnouncement(item))}
                    className={`comm-list-item ${!item.isRead ? 'is-unread' : ''} ${active ? 'is-active' : ''}`}
                  >
                    <div className="comm-list-item-top">
                      {!item.isRead && <span className="comm-unread-dot" aria-hidden />}
                      <div className="comm-chip-row">
                        {item.type === 'transport_alert' && (
                          <span className="comm-chip is-transport">{t('pages.communication.badgeTransport')}</span>
                        )}
                        {item.type === 'announcement' && (
                          <span className="comm-chip is-announcement">{t('pages.communication.badgeAnnouncement')}</span>
                        )}
                        {item.priority === 'URGENT' && (
                          <span className="comm-chip is-urgent">{t('pages.communication.urgent')}</span>
                        )}
                        <CategoryBadge category={item.category} t={t} />
                      </div>
                      <time className="comm-list-time">{formatWhen(item.createdAt)}</time>
                    </div>
                    <p className="comm-list-title">{item.title}</p>
                    <p className="comm-list-preview">{item.body}</p>
                    {item.studentName && (
                      <p className="comm-list-meta">{item.studentName}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className={`comm-thread-panel ${!thread ? 'is-hidden-mobile' : ''}`}>
            {!thread ? (
              <div className="comm-thread-empty">
                <span className="comm-thread-empty-icon" aria-hidden>
                  <MessageSquare className="w-7 h-7" />
                </span>
                <p className="comm-thread-empty-title">{t('pages.communication.selectMessage')}</p>
                <p className="comm-thread-empty-sub">{t('pages.communication.selectMessageHint')}</p>
              </div>
            ) : (
              <>
                <div className="comm-thread-head">
                  <button type="button" className="comm-icon-btn lg-hidden" onClick={() => setThread(null)} aria-label={t('common.backHome')}>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3>{thread.subject}</h3>
                    {thread.student && (
                      <p>
                        {t('pages.communication.reStudent', {
                          name: `${thread.student.firstName} ${thread.student.lastName}`,
                          className: thread.student.class?.name || '',
                        })}
                      </p>
                    )}
                    {thread.category && (
                      <div className="mt-1.5">
                        <CategoryBadge category={thread.category} t={t} />
                      </div>
                    )}
                  </div>
                  {isSchool && thread.id && thread.status === 'OPEN' && (
                    <button
                      type="button"
                      className="comm-btn comm-btn-sm"
                      onClick={async () => {
                        await api.updateThreadStatus(thread.id, 'RESOLVED');
                        openThread(thread.id);
                        loadInbox();
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('pages.communication.resolve')}
                    </button>
                  )}
                </div>

                <div className="comm-thread-scroll">
                  {(thread.messages || []).map((m) => (
                    <div
                      key={m.id || m.createdAt}
                      className={`comm-bubble ${m.isMine ? 'is-mine' : 'is-theirs'}`}
                    >
                      {!m.isMine && m.senderLabel && (
                        <p className="comm-bubble-sender">{m.senderLabel}</p>
                      )}
                      <p className="comm-bubble-body">{m.body}</p>
                      <time className="comm-bubble-time">{formatWhen(m.createdAt)}</time>
                    </div>
                  ))}
                  {thread.isAnnouncement && thread.delivery && (
                    <div className="comm-read-status">
                      <p>
                        {t('pages.communication.readStatus', {
                          read: thread.delivery.readCount || 0,
                          total: thread.delivery.recipientsCount || 0,
                        })}
                      </p>
                      {thread.delivery.sms && (
                        <p>
                          {t('pages.communication.channelSms')}:{' '}
                          {t('pages.communication.smsSummary', {
                            sent: thread.delivery.sms.sent || 0,
                            failed: thread.delivery.sms.failed || 0,
                            skipped: thread.delivery.sms.skipped || 0,
                          })}
                        </p>
                      )}
                      {thread.delivery.email && (
                        <p>
                          {t('pages.communication.channelEmail')}:{' '}
                          {t('pages.communication.emailSummary', {
                            sent: thread.delivery.email.sent || 0,
                            failed: thread.delivery.email.failed || 0,
                            skipped: thread.delivery.email.skipped || 0,
                          })}
                        </p>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {thread.id && !thread.isAnnouncement && (
                  <form onSubmit={handleReply} className="comm-composer">
                    <input
                      className="comm-composer-input"
                      placeholder={t('pages.communication.replyPlaceholder')}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      aria-label={t('pages.communication.replyPlaceholder')}
                    />
                    <button type="submit" className="comm-send" disabled={!reply.trim()} aria-label={t('pages.communication.sendMessage')}>
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {isSchool && viewTab === 'website' && (
        <div className={`comm-shell ${activeInquiry ? 'has-thread' : ''}`}>
          <aside className={`comm-list-panel ${activeInquiry ? 'is-hidden-mobile' : ''}`}>
            <div className="comm-panel-head">
              <div>
                <p className="comm-panel-kicker">{t('pages.communication.tabWebsite')}</p>
                <h2>{t('pages.communication.websiteContactHeader')}</h2>
              </div>
              <button type="button" className="comm-icon-btn" onClick={loadContactInquiries} title={t('ui.refresh')} aria-label={t('ui.refresh')}>
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {contactError && (
              <div className="comm-inline-error">{contactError}</div>
            )}

            <div className="comm-search">
              <Search className="comm-search-icon" aria-hidden />
              <input
                type="search"
                className="comm-search-input"
                value={websiteQuery}
                onChange={(e) => setWebsiteQuery(e.target.value)}
                placeholder={t('pages.communication.searchWebsitePlaceholder')}
                aria-label={t('pages.communication.searchWebsitePlaceholder')}
              />
              {websiteQuery && (
                <button
                  type="button"
                  className="comm-search-clear"
                  onClick={() => setWebsiteQuery('')}
                  aria-label={t('ui.close')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="comm-list-scroll">
              {contactInquiries.length === 0 ? (
                <div className="comm-empty-list">
                  <Globe className="w-8 h-8" />
                  <p>{t('pages.communication.noWebsiteMessages')}</p>
                </div>
              ) : filteredInquiries.length === 0 ? (
                <div className="comm-empty-list">
                  <Search className="w-8 h-8" />
                  <p>{t('ui.noSearchResults')}</p>
                </div>
              ) : filteredInquiries.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openInquiry(item.id)}
                  className={`comm-list-item ${activeInquiry?.id === item.id ? 'is-active' : ''} ${item.status === 'OPEN' ? 'is-unread' : ''}`}
                >
                  <div className="comm-list-item-top">
                    <span className={`comm-chip ${item.status === 'OPEN' ? 'is-urgent' : item.status === 'REPLIED' ? 'is-fees' : 'is-general'}`}>
                      {statusLabel(item.status)}
                    </span>
                    <time className="comm-list-time">{formatWhen(item.createdAt)}</time>
                  </div>
                  <p className="comm-list-title">{item.subject || t('pages.communication.generalInquiry')}</p>
                  <p className="comm-list-preview">{item.email} · {item.name}</p>
                  <p className="comm-list-meta">
                    {item.campus?.name || t('pages.communication.categoryGeneral')}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <section className={`comm-thread-panel ${!activeInquiry ? 'is-hidden-mobile' : ''}`}>
            {!activeInquiry ? (
              <div className="comm-thread-empty">
                <span className="comm-thread-empty-icon" aria-hidden>
                  <Globe className="w-7 h-7" />
                </span>
                <p className="comm-thread-empty-title">{t('pages.communication.selectWebsiteMessage')}</p>
                <p className="comm-thread-empty-sub">{t('pages.communication.selectWebsiteHint')}</p>
              </div>
            ) : (
              <>
                <div className="comm-thread-head">
                  <button type="button" className="comm-icon-btn lg-hidden" onClick={() => setActiveInquiry(null)} aria-label={t('common.backHome')}>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3>{activeInquiry.subject || t('pages.communication.generalInquiry')}</h3>
                    <p>{activeInquiry.name} · {activeInquiry.email}</p>
                  </div>
                </div>

                <div className="comm-thread-scroll">
                  <div className="comm-bubble is-theirs">
                    <p className="comm-bubble-sender">
                      {t('pages.communication.visitorLabel', { name: activeInquiry.name })}
                    </p>
                    <p className="comm-bubble-body">{activeInquiry.message}</p>
                    <time className="comm-bubble-time">{formatWhen(activeInquiry.createdAt)}</time>
                  </div>
                  {(activeInquiry.replies || []).map((m) => (
                    <div
                      key={m.id}
                      className={`comm-bubble ${m.isVisitor ? 'is-theirs' : 'is-mine'}`}
                    >
                      <p className="comm-bubble-sender">
                        {m.isVisitor
                          ? t('pages.communication.visitorLabel', { name: activeInquiry.name })
                          : (m.byName || `${m.repliedBy?.firstName || ''} ${m.repliedBy?.lastName || ''}`.trim() || t('pages.communication.schoolLabel'))}
                      </p>
                      <p className="comm-bubble-body">{m.body}</p>
                      <time className="comm-bubble-time">{formatWhen(m.createdAt)}</time>
                    </div>
                  ))}
                  {visitorTyping && (
                    <p className="comm-typing">{t('pages.communication.visitorTyping', { name: visitorTyping })}</p>
                  )}
                  <div ref={inquiryEndRef} />
                </div>

                <form onSubmit={sendInquiryReply} className="comm-composer">
                  <input
                    className="comm-composer-input"
                    placeholder={t('pages.communication.replyVisitorPlaceholder')}
                    value={inquiryReply}
                    onChange={(e) => handleInquiryReplyChange(e.target.value)}
                    onBlur={() => emitStaffTyping(false)}
                    aria-label={t('pages.communication.replyVisitorPlaceholder')}
                  />
                  <button
                    type="submit"
                    className="comm-send"
                    disabled={!inquiryReply.trim() || inquiryReplying}
                    aria-label={t('pages.communication.sendMessage')}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      <FormModeModal
        open={modal === 'thread'}
        mode="create"
        title={isStudent || isParent ? t('pages.communication.modalThreadFamilyTitle') : t('pages.communication.modalThreadSchoolTitle')}
        subtitle={isStudent ? t('pages.communication.modalThreadFamilySubtitle') : isParent ? t('pages.communication.modalThreadParentSubtitle') : t('pages.communication.modalThreadSchoolSubtitle')}
        onClose={closeModal}
        onSubmit={handleCreateThread}
        formId="thread-form"
        submitLabel={t('pages.communication.sendMessage')}
        submitting={submitting}
        error={error}
        size="lg"
      >
        <FormSection title={t('pages.communication.sectionMessage')}>
          {isParent && (
            <div>
              <label className="label">{t('pages.communication.aboutChild')}</label>
              <StudentSelect
                required
                students={children}
                value={form.studentId || ''}
                onChange={(studentId) => setForm({ ...form, studentId })}
                emptyLabel={t('pages.communication.selectChild')}
                getLabel={(c) => `${c.name}${c.className ? ` (${c.className})` : ''}`}
              />
            </div>
          )}
          {isSchool && (
            <div>
              <label className="label">{t('pages.communication.studentOptional')}</label>
              <StudentSelect
                students={students}
                value={form.studentId || ''}
                onChange={(studentId) => setForm({ ...form, studentId })}
                emptyLabel={t('pages.communication.generalNoStudent')}
                getLabel={(s) => `${s.firstName} ${s.lastName} — ${s.class?.name || ''}`}
              />
            </div>
          )}
          <div>
            <label className="label">{t('pages.communication.subjectLabel')}</label>
            <input className="input" required value={form.subject || ''} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('ui.category')}</label>
            <select className="input" value={form.category || 'GENERAL'} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
            </select>
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('ui.message')} *</label>
            <textarea className="input" required rows={4} value={form.body || ''} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
        </FormSection>
      </FormModeModal>

      <FormModeModal
        open={modal === 'broadcast'}
        mode="create"
        title={t('pages.communication.modalBroadcastTitle')}
        subtitle={t('pages.communication.modalBroadcastSubtitle')}
        onClose={closeModal}
        onSubmit={handleBroadcast}
        formId="broadcast-form"
        submitLabel={t('pages.communication.sendToParents')}
        submitting={submitting}
        error={error}
        size="lg"
      >
        <FormSection title={t('pages.communication.sectionAnnouncement')}>
          <div>
            <label className="label">{t('pages.communication.sendTo')}</label>
            <select className="input" value={form.targetType || 'ALL_PARENTS'} onChange={(e) => setForm({ ...form, targetType: e.target.value })}>
              {TARGETS.map((item) => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
            </select>
          </div>
          {form.targetType === 'CLASS' && (
            <div>
              <label className="label">{t('ui.class')} *</label>
              <select className="input" required value={form.targetClassId || ''} onChange={(e) => setForm({ ...form, targetClassId: e.target.value })}>
                <option value="">{t('ui.select')}</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {form.targetType === 'STUDENT' && (
            <div>
              <label className="label">{t('ui.student')} *</label>
              <StudentSelect
                required
                students={students}
                value={form.targetStudentId || ''}
                onChange={(targetStudentId) => setForm({ ...form, targetStudentId })}
                emptyLabel={t('ui.select')}
                getLabel={(s) => `${s.firstName} ${s.lastName}`}
              />
            </div>
          )}
          <div>
            <label className="label">{t('ui.category')}</label>
            <select className="input" value={form.category || 'GENERAL'} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('pages.communication.priority')}</label>
            <select className="input" value={form.priority || 'NORMAL'} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="NORMAL">{t('pages.communication.priorityNormal')}</option>
              <option value="URGENT">{t('pages.communication.priorityUrgent')}</option>
            </select>
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('pages.communication.titleRequired')}</label>
            <input className="input" required value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('ui.message')} *</label>
            <textarea className="input" required rows={4} value={form.body || ''} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div className="form-field-full md:col-span-2 space-y-2">
            <label className="comm-sms-option">
              <input
                type="checkbox"
                className="mt-1 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                checked={Boolean(form.sendSms)}
                disabled={!channels.sms?.configured}
                onChange={(e) => setForm({ ...form, sendSms: e.target.checked })}
              />
              <span>
                <span className="comm-sms-title">{t('pages.communication.sendSmsTitle')}</span>
                <span className="comm-sms-hint">
                  {channels.sms?.configured
                    ? t('pages.communication.sendSmsHint')
                    : (channels.sms?.reason || t('pages.communication.smsNotConfigured'))}
                </span>
              </span>
            </label>
            <label className="comm-sms-option">
              <input
                type="checkbox"
                className="mt-1 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                checked={Boolean(form.sendEmail)}
                disabled={!channels.email?.configured}
                onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })}
              />
              <span>
                <span className="comm-sms-title">{t('pages.communication.sendEmailTitle')}</span>
                <span className="comm-sms-hint">
                  {channels.email?.configured
                    ? t('pages.communication.sendEmailHintOn')
                    : (channels.email?.reason || t('pages.communication.emailNotConfigured'))}
                </span>
              </span>
            </label>
            <p className="text-xs text-gray-500 px-1">
              {t('pages.communication.alwaysInApp')}
            </p>
          </div>
        </FormSection>
      </FormModeModal>
    </div>
  );
}
