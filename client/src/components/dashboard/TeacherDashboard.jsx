import { Link } from 'react-router-dom';
import {
  Users, MessageSquare, ClipboardCheck, Clock, FileText, BookOpen,
  Award, BookMarked, AlertCircle, Bus, Sparkles, CalendarDays,
} from 'lucide-react';
import ModernStatCard from './ModernStatCard';
import DashboardShell from './DashboardShell';
import DashboardPanel from './DashboardPanel';
import DashQuickLink from './DashQuickLink';
import { useTranslation } from '../../context/LanguageContext';

function formatTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

export default function TeacherDashboard({ campusId, data, userName }) {
  const { t, language } = useTranslation();
  const base = `/campus/${campusId}`;
  const {
    classes,
    courseCount,
    studentCount,
    todaySchedule,
    unreadCount,
    recentMessages,
    upcomingHomework,
    attendanceToday,
  } = data;

  const homeroomCount = classes.filter((c) => c.isHomeroom).length;
  const todayLabel = new Date().toLocaleDateString(
    language === 'en' ? undefined : language,
    { weekday: 'long', month: 'long', day: 'numeric' },
  );

  return (
    <DashboardShell
      kicker={t('pages.dashboard.kickerTeacher')}
      title={t('staffDash.welcome', { name: userName })}
      description={t('staffDash.teacher.description')}
      actions={(
        <span className="dash-date-chip">
          <CalendarDays className="w-3.5 h-3.5" aria-hidden />
          {todayLabel}
        </span>
      )}
      heroAside={(
        <div className="dash-pulse is-lessons">
          <div className="dash-pulse-core">
            <p className="dash-pulse-value">{todaySchedule.length}</p>
            <p className="dash-pulse-label">{t('pages.dashboard.lessonsToday')}</p>
          </div>
        </div>
      )}
    >
      {classes.length === 0 && (
        <div className="dash-alert is-warn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="dash-alert-title">{t('staffDash.teacher.noClassesTitle')}</p>
            <p className="dash-alert-body">{t('staffDash.teacher.noClassesBody')}</p>
          </div>
        </div>
      )}

      <div className="dash-metric-strip">
        <ModernStatCard
          index={0}
          icon={BookOpen}
          label={t('staffDash.teacher.myClasses')}
          value={classes.length}
          sub={homeroomCount ? t('staffDash.teacher.homeroomCount', { count: homeroomCount }) : t('staffDash.teacher.subjectClasses')}
          accent="green"
        />
        <ModernStatCard
          index={1}
          icon={Users}
          label={t('staffDash.teacher.students')}
          value={studentCount}
          sub={t('staffDash.teacher.acrossClasses')}
          accent="blue"
        />
        <ModernStatCard
          index={2}
          icon={BookMarked}
          label={t('staffDash.teacher.courses')}
          value={courseCount}
          sub={t('staffDash.teacher.subjectsYouTeach')}
          accent="teal"
        />
        <ModernStatCard
          index={3}
          icon={MessageSquare}
          label={t('staffDash.teacher.unreadMessages')}
          value={unreadCount}
          sub={t('staffDash.teacher.announcementsParentReplies')}
          accent="gold"
        />
      </div>

      <div className="dash-role-grid">
        <DashboardPanel
          title={t('staffDash.teacher.todaySchedule')}
          description={t('staffDash.teacher.lessonsInClasses')}
          action={<Link to={`${base}/timetable`} className="dash-link">{t('staffDash.teacher.fullTimetable')}</Link>}
          flush
        >
          {todaySchedule.length === 0 ? (
            <p className="dash-empty">{t('staffDash.teacher.noLessonsToday')}</p>
          ) : (
            <div className="dash-list">
              {todaySchedule.map((slot) => (
                <div key={slot.id} className="dash-list-row is-schedule">
                  <div className="dash-time-chip">
                    {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
                  </div>
                  <div className="dash-list-main">
                    <p className="dash-list-title">{slot.subject?.name || t('staffDash.teacher.lesson')}</p>
                    <p className="dash-list-meta">
                      {slot.class?.name}
                      {slot.room ? ` · ${t('staffDash.teacher.room', { room: slot.room })}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title={t('staffDash.teacher.attendanceToday')}
          description={t('staffDash.teacher.markedOfTotal', { marked: attendanceToday.marked, total: attendanceToday.total })}
          action={<Link to={`${base}/attendance`} className="dash-link">{t('staffDash.teacher.markAttendance')}</Link>}
        >
          <div className="dash-att-grid">
            <div className="dash-att-cell is-present">
              <p className="dash-att-value">{attendanceToday.present}</p>
              <p className="dash-att-label">{t('staffDash.attendance.present')}</p>
            </div>
            <div className="dash-att-cell is-absent">
              <p className="dash-att-value">{attendanceToday.absent}</p>
              <p className="dash-att-label">{t('staffDash.attendance.absent')}</p>
            </div>
            <div className="dash-att-cell is-late">
              <p className="dash-att-value">{attendanceToday.late}</p>
              <p className="dash-att-label">{t('staffDash.attendance.late')}</p>
            </div>
            <div className="dash-att-cell is-excused">
              <p className="dash-att-value">{attendanceToday.excused}</p>
              <p className="dash-att-label">{t('staffDash.attendance.excused')}</p>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel title={t('staffDash.teacher.quickAccess')}>
          <div className="dash-quick-list">
            <DashQuickLink to={`${base}/communication`} icon={MessageSquare} label={t('staffDash.teacher.messages')} badge={unreadCount} />
            <DashQuickLink to={`${base}/attendance`} icon={ClipboardCheck} label={t('staffDash.teacher.markAttendance')} />
            <DashQuickLink to={`${base}/marks`} icon={Award} label={t('staffDash.teacher.enterMarks')} />
            <DashQuickLink to={`${base}/homework`} icon={FileText} label={t('pages.homework.title')} badge={upcomingHomework.length} />
            <DashQuickLink to={`${base}/timetable`} icon={Clock} label={t('staffDash.teacher.myTimetable')} />
            <DashQuickLink to={`${base}/students`} icon={Users} label={t('staffDash.teacher.myStudents')} />
            <DashQuickLink to={`${base}/extracurricular`} icon={Sparkles} label={t('pages.activities.titleShort')} />
            <DashQuickLink to={`${base}/transport`} icon={Bus} label={t('staffDash.teacher.transport')} />
          </div>
        </DashboardPanel>

        <DashboardPanel
          title={t('staffDash.teacher.myClassesSection')}
          description={t('staffDash.teacher.homeroomAndSubject')}
          action={<Link to={`${base}/classes`} className="dash-link">{t('staffDash.viewAll')}</Link>}
          flush
        >
          {classes.length === 0 ? (
            <p className="dash-empty">{t('staffDash.teacher.noClassesAssigned')}</p>
          ) : (
            <div className="dash-list">
              {classes.slice(0, 5).map((cls) => (
                <div key={cls.id} className="dash-list-row">
                  <div className="dash-list-main">
                    <p className="dash-list-title">{cls.name}</p>
                    <p className="dash-list-meta">
                      {cls.studentCount === 1
                        ? t('staffDash.teacher.oneStudent')
                        : t('staffDash.teacher.nStudents', { count: cls.studentCount })}
                      {cls.isHomeroom ? ` · ${t('staffDash.teacher.homeroom')}` : ` · ${t('staffDash.teacher.subjectClass')}`}
                    </p>
                  </div>
                  <Link to={`${base}/attendance`} className="dash-link shrink-0">{t('staffDash.teacher.attendanceLink')}</Link>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        {recentMessages.length > 0 && (
          <DashboardPanel
            className="dash-span-2"
            title={t('staffDash.teacher.recentMessages')}
            description={t('staffDash.teacher.schoolAnnouncementsParents')}
            action={<Link to={`${base}/communication`} className="dash-link">{t('staffDash.teacher.openInbox')}</Link>}
            flush
          >
            <div className="dash-list">
              {recentMessages.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  to={`${base}/communication`}
                  className={`dash-list-row is-link ${!item.isRead ? 'is-unread' : ''}`}
                >
                  <div className="dash-list-main">
                    <p className="dash-list-title">{item.title}</p>
                    <p className="dash-list-meta">{item.body}</p>
                  </div>
                </Link>
              ))}
            </div>
          </DashboardPanel>
        )}
      </div>
    </DashboardShell>
  );
}
