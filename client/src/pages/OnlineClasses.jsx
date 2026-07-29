import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Pencil, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StudentPageHeader from '../components/student/StudentPageHeader';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import ParentChildFilter from '../components/parent/ParentChildFilter';
import AppIcon from '../components/icons/AppIcon';
import InAppMeetingViewer from '../components/media/InAppMeetingViewer';
import { openMeetingInNewTab, getMinutesUntilJoin } from '../lib/meetingLinks';
import { useTranslation } from '../context/LanguageContext';

const EMPTY_FORM = {
  classId: '',
  subjectId: '',
  title: '',
  description: '',
  scheduledAt: '',
  durationMinutes: '45',
  meetingProvider: 'GOOGLE_MEET',
  meetingUrl: '',
  isPublished: true,
};

const PROVIDER_LABELS = {
  GOOGLE_MEET: 'Google Meet',
  ZOOM: 'Zoom',
};

const PROVIDER_HINTS = {
  GOOGLE_MEET: 'https://meet.google.com/abc-defg-hij',
  ZOOM: 'https://zoom.us/j/123456789',
};

function formatSessionWhen(date) {
  const d = new Date(date);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function canJoinSession(session) {
  return session.status === 'live' || session.status === 'starting_soon';
}

function formatCountdownLabel(minutes, t) {
  if (minutes <= 0) return t('common.joinOpensSoon');
  if (minutes < 60) {
    return minutes === 1 ? t('common.oneMinuteToJoin') : t('common.minutesToJoin', { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return t('common.hoursOnlyToJoin', { hours });
  return t('common.hoursToJoin', { hours, mins });
}

function JoinCountdown({ session }) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(() => formatCountdownLabel(getMinutesUntilJoin(session), t));

  useEffect(() => {
    const tick = () => setLabel(formatCountdownLabel(getMinutesUntilJoin(session), t));
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [session.scheduledAt, t]);

  return (
    <div className="online-class-countdown" aria-live="polite">
      <AppIcon name="clock" className="w-5 h-5" />
      <span>{label}</span>
    </div>
  );
}

function SessionCard({ session, isStudent, isParent, canManage, onEdit, onDelete, onJoin }) {
  const { t } = useTranslation();
  const provider = PROVIDER_LABELS[session.meetingProvider] || 'Online class';
  const joinable = canJoinSession(session);
  const isUpcoming = session.status === 'upcoming';
  const viewerRestricted = isStudent || isParent;
  const statusText = {
    live: t('common.liveNow'),
    starting_soon: t('common.startingSoon'),
    upcoming: t('common.upcoming'),
    ended: t('common.ended'),
  }[session.status] || session.statusLabel;

  return (
    <article className={`online-class-card online-class-card-${session.status}`}>
      <div className="online-class-card-head">
        <span className={`online-class-status online-class-status-${session.status}`}>
          {statusText}
        </span>
        <span className="online-class-provider">
          <AppIcon name={session.meetingProvider === 'ZOOM' ? 'video' : 'lesson'} className="w-4 h-4" />
          {provider}
        </span>
      </div>

      <h2 className="online-class-title">{session.title}</h2>
      {session.description && (
        <p className="online-class-desc">{session.description}</p>
      )}

      <ul className="online-class-meta">
        <li>{formatSessionWhen(session.scheduledAt)}</li>
        <li>{session.durationMinutes} {t('common.minUnit')}</li>
        {session.class?.name && <li>{session.class.name}</li>}
        {session.subject?.name && <li>{session.subject.name}</li>}
      </ul>

      <div className="online-class-actions">
        {viewerRestricted && isUpcoming && (
          <JoinCountdown session={session} />
        )}

        {(!viewerRestricted || !isUpcoming) && (viewerRestricted ? joinable : session.status !== 'ended') && (
          <button
            type="button"
            className={`online-class-join-btn ${joinable ? 'online-class-join-btn-live' : ''}`}
            disabled={viewerRestricted && !joinable}
            onClick={() => {
              if (viewerRestricted && !joinable) return;
              onJoin?.(session);
            }}
          >
            <ExternalLink className="w-5 h-5" />
            {joinable ? t('common.joinClass') : t('common.openClass')}
          </button>
        )}

        {canManage && (
          <div className="flex gap-2">
            <button type="button" onClick={() => onEdit(session)} className="btn-secondary text-sm px-3 py-2">
              <Pencil className="w-4 h-4 inline" /> {t('pageBody.onlineClasses.editButton')}
            </button>
            <button type="button" onClick={() => onDelete(session.id)} className="btn-secondary text-sm px-3 py-2 text-red-600">
              <Trash2 className="w-4 h-4 inline" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function OnlineClasses() {
  const { campusId } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isStudent = user?.role === 'STUDENT';
  const isParent = user?.role === 'PARENT';
  const canManage = !['STUDENT', 'PARENT'].includes(user?.role);

  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState(null);

  const viewerClassId = isParent
    ? children.find((c) => c.id === selectedChildId)?.classId
    : (isStudent ? undefined : (classFilter || undefined));

  const load = () => {
    api.getOnlineClasses(viewerClassId || undefined)
      .then(setSessions)
      .catch(console.error);
  };

  useEffect(() => { load(); }, [viewerClassId]);

  useEffect(() => {
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [viewerClassId]);

  const [searchParams, setSearchParams] = useSearchParams();
  const autoJoinedId = useRef(null);

  useEffect(() => {
    if (canManage) {
      api.getClasses().then(setClasses).catch(console.error);
    }
    if (isParent) {
      api.getParentChildren().then((list) => {
        setChildren(list);
        if (list.length) setSelectedChildId(list[0].id);
      }).catch(console.error);
    }
  }, [canManage, isParent]);

  useEffect(() => {
    if (!form.classId) {
      setCourses([]);
      return;
    }
    api.getCourses(form.classId).then(setCourses).catch(console.error);
  }, [form.classId]);

  const grouped = useMemo(() => {
    const live = sessions.filter((s) => s.status === 'live' || s.status === 'starting_soon');
    const upcoming = sessions.filter((s) => s.status === 'upcoming');
    const ended = sessions.filter((s) => s.status === 'ended');
    return { live, upcoming, ended };
  }, [sessions]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setShowForm(true);
  };

  const openEdit = (session) => {
    const dt = new Date(session.scheduledAt);
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditingId(session.id);
    setForm({
      classId: session.classId,
      subjectId: session.subjectId || '',
      title: session.title,
      description: session.description || '',
      scheduledAt: local,
      durationMinutes: String(session.durationMinutes || 45),
      meetingProvider: session.meetingProvider,
      meetingUrl: session.meetingUrl,
      isPublished: session.isPublished !== false,
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        durationMinutes: Number(form.durationMinutes) || 45,
        subjectId: form.subjectId || null,
      };
      if (editingId) {
        await api.updateOnlineClass(editingId, payload);
      } else {
        await api.createOnlineClass(payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('pageBody.onlineClasses.deleteConfirm'))) return;
    try {
      await api.deleteOnlineClass(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleJoinSession = (session) => {
    if (session.meetingProvider === 'GOOGLE_MEET') {
      openMeetingInNewTab(session.meetingUrl);
      return;
    }
    setActiveMeeting(session);
  };

  useEffect(() => {
    const joinId = searchParams.get('join');
    if (!joinId || !sessions.length || autoJoinedId.current === joinId) return;
    const session = sessions.find((s) => s.id === joinId);
    if (!session) return;
    if ((isStudent || isParent) && !canJoinSession(session)) {
      setSearchParams({}, { replace: true });
      return;
    }
    autoJoinedId.current = joinId;
    handleJoinSession(session);
    setSearchParams({}, { replace: true });
  }, [sessions, searchParams, isStudent, isParent, setSearchParams]);

  const renderSection = (title, items) => {
    if (!items.length) return null;
    return (
      <section className="mb-6">
        <h2 className="student-section-title mb-3">{title}</h2>
        <div className="online-class-grid">
          {items.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isStudent={isStudent}
              isParent={isParent}
              canManage={canManage}
              onEdit={openEdit}
              onDelete={handleDelete}
              onJoin={handleJoinSession}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className={isStudent ? 'student-page' : ''}>
      {isStudent ? (
        <StudentPageHeader
          icon="video"
          title={t('onlineClasses.title')}
          subtitle={t('onlineClasses.subtitle')}
          backTo={`/campus/${campusId}`}
        />
      ) : (
        <PageHeader
          title={t('pages.onlineClasses.title')}
          description={t('pages.onlineClasses.description')}
          action={canManage && (
            <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> {t('pages.onlineClasses.schedule')}
            </button>
          )}
        />
      )}

      {isParent && (
        <ParentChildFilter
          children={children}
          value={selectedChildId}
          onChange={setSelectedChildId}
        />
      )}

      {canManage && !isStudent && (
        <div className="mb-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">{t('ui.filterByClass')}</label>
            <select className="input min-w-[200px]" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">{t('ui.allClasses')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2 lg:hidden">
            <Plus className="w-4 h-4" /> {t('ui.scheduleClass')}
          </button>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="student-empty-card">
          {isStudent
            ? t('onlineClasses.emptyStudent')
            : t('pageBody.onlineClasses.emptyStaff')}
        </div>
      ) : (
        <>
          {renderSection(t('onlineClasses.liveSection'), grouped.live)}
          {renderSection(t('onlineClasses.upcomingSection'), grouped.upcoming)}
          {renderSection(t('onlineClasses.endedSection'), grouped.ended)}
        </>
      )}

      <FormModeModal
        open={showForm}
        mode={editingId ? 'edit' : 'create'}
        title={editingId ? t('pageBody.onlineClasses.editTitle') : t('pageBody.onlineClasses.scheduleTitle')}
        subtitle={t('pageBody.onlineClasses.formSubtitle')}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
        formId="online-class-form"
        submitLabel={editingId ? t('ui.saveChanges') : t('ui.scheduleClass')}
        submitting={submitting}
        error={error}
        size="lg"
      >
        <FormSection title={t('ui.classDetails')}>
          <div>
            <label className="label">{t('ui.class')} *</label>
            <select className="input" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, subjectId: '' })}>
              <option value="">{t('ui.selectClass')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('ui.subject')}</label>
            <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">{t('ui.optionalField')}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('ui.titleField')} *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('pageBody.onlineClasses.titlePlaceholder')} />
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('ui.description')}</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('ui.dateTime')} *</label>
            <input className="input" type="datetime-local" required value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('ui.durationMinutes')}</label>
            <input className="input" type="number" min="15" max="180" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('ui.platform')} *</label>
            <select className="input" value={form.meetingProvider} onChange={(e) => setForm({ ...form, meetingProvider: e.target.value })}>
              <option value="GOOGLE_MEET">Google Meet</option>
              <option value="ZOOM">Zoom</option>
            </select>
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('ui.meetingLink')} *</label>
            <input
              className="input"
              required
              value={form.meetingUrl}
              onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
              placeholder={PROVIDER_HINTS[form.meetingProvider]}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('pageBody.onlineClasses.meetingHint', { provider: PROVIDER_LABELS[form.meetingProvider] })}
            </p>
          </div>
          <div className="form-field-full md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              {t('ui.visibleToStudents')}
            </label>
          </div>
        </FormSection>
      </FormModeModal>

      {activeMeeting?.meetingProvider === 'ZOOM' && (
        <InAppMeetingViewer
          open
          onClose={() => setActiveMeeting(null)}
          title={activeMeeting.title}
          meetingUrl={activeMeeting.meetingUrl}
        />
      )}
    </div>
  );
}
