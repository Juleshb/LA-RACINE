import { useEffect, useState, useRef } from 'react';
import {
  MessageSquare, Send, Megaphone, Plus, ArrowLeft, CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSupportSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { useTranslation } from '../context/LanguageContext';

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

function categoryStyle(cat) {
  const map = {
    TRANSPORT: 'bg-amber-100 text-amber-800',
    FEES: 'bg-emerald-100 text-emerald-800',
    DISCIPLINE: 'bg-red-100 text-red-800',
  };
  return map[cat] || 'bg-gray-100 text-gray-700';
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
  const [viewTab, setViewTab] = useState('inbox'); // inbox | website
  const [contactError, setContactError] = useState('');
  const [visitorTyping, setVisitorTyping] = useState('');
  const messagesEndRef = useRef(null);
  const inquiryTypingTimer = useRef(null);
  const activeInquiryIdRef = useRef(null);

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
        setContactError(err.message || 'Failed to load contact messages');
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
    }
  }, [isParent, isSchool]);

  useEffect(() => {
    activeInquiryIdRef.current = activeInquiry?.id || null;
  }, [activeInquiry?.id]);

  // Realtime website contact chat
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
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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
      messages: [{
        body: item.body,
        senderLabel: item.createdBy || 'School',
        createdAt: item.createdAt,
        isMine: false,
      }],
    });
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !thread?.id) return;
    try {
      await api.replyCommunicationThread(thread.id, reply.trim());
      setReply('');
      const updated = await api.getCommunicationThread(thread.id);
      setThread(updated);
      loadInbox();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateThread = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createCommunicationThread(form);
      closeModal();
      loadInbox();
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
      alert(`Announcement sent to ${result.recipientsCount} parent(s).`);
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

  return (
    <div className="communication-page">
      <PageHeader
        title={isStudent || isParent || isTeacher
          ? t('pages.communication.titleMessages')
          : t('pages.communication.title')}
        description={isStudent
          ? t('pages.communication.descriptionStudent')
          : isParent
            ? t('pages.communication.descriptionParent')
            : isTeacher
              ? t('pages.communication.descriptionTeacher')
              : isSchool
                ? t('pages.communication.description')
                : t('pages.communication.descriptionStaff')}
        action={(
          <div className="flex gap-2">
            {isFamily && (
              <button type="button" className="btn-primary flex items-center gap-2" onClick={() => { setModal('thread'); setForm({ category: 'GENERAL' }); }}>
                <Send className="w-4 h-4" />
                {t('pages.communication.contactSchool')}
              </button>
            )}
            {isSchool && (
              <>
                <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => { setModal('broadcast'); setForm({ category: 'GENERAL', priority: 'NORMAL', targetType: 'ALL_PARENTS' }); }}>
                  <Megaphone className="w-4 h-4" />
                  {t('ui.announcement')}
                </button>
                <button type="button" className="btn-primary flex items-center gap-2" onClick={() => { setModal('thread'); setForm({ category: 'GENERAL' }); }}>
                  <Plus className="w-4 h-4" />
                  {t('ui.message')}
                </button>
              </>
            )}
          </div>
        )}
      />

      {isSchool && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-sm border ${viewTab === 'inbox' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
            onClick={() => setViewTab('inbox')}
          >
            {t('pages.communication.tabInbox')}
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-sm border ${viewTab === 'website' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
            onClick={() => { setViewTab('website'); loadContactInquiries(); }}
          >
            {t('pages.communication.tabWebsite')}
            {contactInquiries.filter((i) => i.status === 'OPEN').length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                {contactInquiries.filter((i) => i.status === 'OPEN').length}
              </span>
            )}
          </button>
        </div>
      )}

      {(viewTab === 'inbox' || !isSchool) && (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[60vh]">
        <div className={`lg:col-span-2 ${thread ? 'hidden lg:block' : ''}`}>
          <div className="card p-0 overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50/80">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('pages.communication.inbox')}</p>
            </div>
            <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
              {inbox.length === 0 ? (
                <p className="p-6 text-sm text-gray-500 text-center">{t('pages.communication.noMessages')}</p>
              ) : inbox.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => (item.type === 'thread' ? openThread(item.id) : openAnnouncement(item))}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${!item.isRead ? 'bg-brand-50/40' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!item.isRead && <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1 mb-1">
                        {item.type === 'transport_alert' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">{t('pages.communication.badgeTransport')}</span>
                        )}
                        {item.type === 'announcement' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">{t('pages.communication.badgeAnnouncement')}</span>
                        )}
                        {item.priority === 'URGENT' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">{t('pages.communication.urgent')}</span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${categoryStyle(item.category)}`}>
                          {CATEGORIES.find((c) => c.value === item.category) ? t(CATEGORIES.find((c) => c.value === item.category).labelKey) : item.category}
                        </span>
                      </div>
                      <p className="font-semibold text-sm text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{item.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(item.createdAt).toLocaleString()}
                        {item.studentName && ` · ${item.studentName}`}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`lg:col-span-3 ${!thread ? 'hidden lg:flex' : 'flex'} flex-col`}>
          {!thread ? (
            <div className="card flex-1 flex flex-col items-center justify-center text-gray-400 py-16">
              <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
              <p>{t('pages.communication.selectMessage')}</p>
            </div>
          ) : (
            <div className="card flex-1 flex flex-col p-0 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <button type="button" className="lg:hidden btn-secondary p-2" onClick={() => setThread(null)}>
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-gray-900 truncate">{thread.subject}</h3>
                  {thread.student && (
                    <p className="text-xs text-gray-500">
                      {t('pages.communication.reStudent', {
                        name: `${thread.student.firstName} ${thread.student.lastName}`,
                        className: thread.student.class?.name || '',
                      })}
                    </p>
                  )}
                </div>
                {isSchool && thread.id && thread.status === 'OPEN' && (
                  <button
                    type="button"
                    className="btn-secondary text-xs flex items-center gap-1"
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

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
                {(thread.messages || []).map((m) => (
                  <div
                    key={m.id || m.createdAt}
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.isMine ? 'ml-auto bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    {!m.isMine && (
                      <p className="text-[10px] font-semibold opacity-70 mb-1">{m.senderLabel}</p>
                    )}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`text-[10px] mt-1 ${m.isMine ? 'text-brand-100' : 'text-gray-400'}`}>
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {thread.id && !thread.isAnnouncement && (
                <form onSubmit={handleReply} className="p-4 border-t border-gray-100 flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder={t('pages.communication.replyPlaceholder')}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <button type="submit" className="btn-primary px-4" disabled={!reply.trim()}>
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {isSchool && viewTab === 'website' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[60vh]">
          <div className={`lg:col-span-2 ${activeInquiry ? 'hidden lg:block' : ''}`}>
            <div className="card p-0 overflow-hidden">
              <div className="p-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('pages.communication.websiteContactHeader')}</p>
                <button type="button" className="text-xs text-brand-700 hover:underline" onClick={loadContactInquiries}>{t('ui.refresh')}</button>
              </div>
              {contactError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border-b border-red-100">{contactError}</div>
              )}
              <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
                {contactInquiries.length === 0 ? (
                  <p className="p-6 text-sm text-gray-500 text-center">{t('pages.communication.noWebsiteMessages')}</p>
                ) : contactInquiries.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openInquiry(item.id)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${activeInquiry?.id === item.id ? 'bg-brand-50/50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{item.subject || t('pages.communication.generalInquiry')}</p>
                        <p className="text-xs text-gray-500 truncate">{item.email} · {item.name}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(item.createdAt).toLocaleString()}
                          {item.campus?.name ? ` · ${item.campus.name}` : ` · ${t('pages.communication.categoryGeneral')}`}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        item.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : item.status === 'REPLIED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`lg:col-span-3 ${!activeInquiry ? 'hidden lg:flex' : 'flex'} flex-col`}>
            {!activeInquiry ? (
              <div className="card flex-1 flex flex-col items-center justify-center text-gray-400 py-16">
                <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                <p>{t('pages.communication.selectWebsiteMessage')}</p>
              </div>
            ) : (
              <div className="card flex-1 flex flex-col p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                  <button type="button" className="lg:hidden btn-secondary p-2" onClick={() => setActiveInquiry(null)}>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-900 truncate">{activeInquiry.subject || t('pages.communication.generalInquiry')}</h3>
                    <p className="text-xs text-gray-500">{activeInquiry.name} · {activeInquiry.email}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
                  <div className="rounded-2xl px-4 py-3 text-sm bg-white border border-gray-200 text-gray-800">
                    <p className="text-[10px] font-semibold opacity-70 mb-1">Visitor · {activeInquiry.name}</p>
                    <p className="whitespace-pre-wrap">{activeInquiry.message}</p>
                    <p className="text-[10px] mt-1 text-gray-400">{new Date(activeInquiry.createdAt).toLocaleString()}</p>
                  </div>
                  {(activeInquiry.replies || []).map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm ${
                        m.isVisitor
                          ? 'bg-white border border-gray-200 text-gray-800'
                          : 'ml-auto bg-brand-600 text-white'
                      }`}
                    >
                      <p className={`text-[10px] font-semibold mb-1 ${m.isVisitor ? 'opacity-70' : 'opacity-80'}`}>
                        {m.isVisitor
                          ? `Visitor · ${activeInquiry.name}`
                          : (m.byName || `${m.repliedBy?.firstName || ''} ${m.repliedBy?.lastName || ''}`.trim() || 'School')}
                      </p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={`text-[10px] mt-1 ${m.isVisitor ? 'text-gray-400' : 'text-brand-100'}`}>
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {visitorTyping && (
                    <div className="text-xs text-gray-500 italic px-1">
                      {t('pages.communication.visitorTyping', { name: visitorTyping })}
                    </div>
                  )}
                </div>
                <form onSubmit={sendInquiryReply} className="p-4 border-t border-gray-100 flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder={t('pages.communication.replyVisitorPlaceholder')}
                    value={inquiryReply}
                    onChange={(e) => handleInquiryReplyChange(e.target.value)}
                    onBlur={() => emitStaffTyping(false)}
                  />
                  <button type="submit" className="btn-primary px-4" disabled={!inquiryReply.trim() || inquiryReplying}>
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </div>
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
              <select className="input" required value={form.studentId || ''} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                <option value="">{t('pages.communication.selectChild')}</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.className ? `(${c.className})` : ''}</option>
                ))}
              </select>
            </div>
          )}
          {isSchool && (
            <div>
              <label className="label">{t('pages.communication.studentOptional')}</label>
              <select className="input" value={form.studentId || ''} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                <option value="">{t('pages.communication.generalNoStudent')}</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} — {s.class?.name}</option>
                ))}
              </select>
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
              <select className="input" required value={form.targetStudentId || ''} onChange={(e) => setForm({ ...form, targetStudentId: e.target.value })}>
                <option value="">{t('ui.select')}</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
              </select>
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
        </FormSection>
      </FormModeModal>
    </div>
  );
}
