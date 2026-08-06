import { Link } from 'react-router-dom';
import {
  Users, MessageSquare, Wallet, ClipboardCheck, Clock, FileText,
  Bus, Sparkles, AlertCircle, GraduationCap, CalendarDays,
} from 'lucide-react';
import ModernStatCard from './ModernStatCard';
import DashboardShell from './DashboardShell';
import DashboardPanel from './DashboardPanel';
import DashQuickLink from './DashQuickLink';
import { formatCurrency } from '../../hooks/useDashboardData';
import { useTranslation } from '../../context/LanguageContext';

export default function ParentDashboard({ campusId, data, userName }) {
  const { t, language } = useTranslation();
  const base = `/campus/${campusId}`;
  const {
    children, unreadCount, recentMessages, pendingFees, upcomingHomework,
    homeworkGrades, eLearningGrades, transport, pendingRegistrations, childrenWithoutLogin,
  } = data;

  const presentToday = children.filter((c) => c.todayStatus === 'PRESENT').length;
  const feeTotal = pendingFees.reduce((sum, f) => sum + (f.amount || 0), 0);
  const todayLabel = new Date().toLocaleDateString(
    language === 'en' ? undefined : language,
    { weekday: 'long', month: 'long', day: 'numeric' },
  );

  const statusLabels = {
    PRESENT: { label: t('staffDash.attendance.present'), className: 'is-present' },
    ABSENT: { label: t('staffDash.attendance.absent'), className: 'is-absent' },
    LATE: { label: t('staffDash.attendance.late'), className: 'is-late' },
    EXCUSED: { label: t('staffDash.attendance.excused'), className: 'is-excused' },
  };
  const notRecordedStatus = { label: t('staffDash.attendance.notRecorded'), className: 'is-none' };

  return (
    <DashboardShell
      kicker={t('pages.dashboard.kickerParent')}
      title={t('staffDash.welcome', { name: userName })}
      description={t('staffDash.parent.description')}
      actions={(
        <span className="dash-date-chip">
          <CalendarDays className="w-3.5 h-3.5" aria-hidden />
          {todayLabel}
        </span>
      )}
      heroAside={(
        <div className="dash-pulse is-family">
          <div className="dash-pulse-core">
            <p className="dash-pulse-value">{presentToday}/{children.length || 0}</p>
            <p className="dash-pulse-label">{t('pages.dashboard.presentToday')}</p>
          </div>
        </div>
      )}
    >
      {children.length === 0 && !pendingRegistrations?.length && (
        <div className="dash-alert is-warn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="dash-alert-title">{t('staffDash.parent.noChildrenTitle')}</p>
            <p className="dash-alert-body">
              {t('staffDash.parent.noChildrenBeforeLink')}{' '}
              <Link to={`${base}/register-child`} className="font-semibold underline">{t('pages.registerChild.title')}</Link>{' '}
              {t('staffDash.parent.noChildrenAfterLink')}
            </p>
          </div>
        </div>
      )}

      {childrenWithoutLogin > 0 && (
        <div className="dash-alert is-info">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="dash-alert-title">{t('staffDash.parent.portalTitle')}</p>
            <p className="dash-alert-body">
              {childrenWithoutLogin > 1
                ? t('staffDash.parent.portalManyChildren', { count: childrenWithoutLogin })
                : t('staffDash.parent.portalOneChild', { count: childrenWithoutLogin })}
              {' '}
              <Link to={`${base}/child-accounts`} className="font-semibold underline">{t('staffDash.parent.portalManageLink')}</Link>
              {' '}{t('staffDash.parent.portalAfterLink')}
            </p>
          </div>
        </div>
      )}

      {pendingRegistrations?.length > 0 && (
        <DashboardPanel
          className="dash-applications"
          title={t('staffDash.parent.applicationsTitle')}
          description={t('staffDash.parent.applicationsPending', { count: pendingRegistrations.length })}
          action={<Link to={`${base}/my-registrations`} className="dash-link">{t('staffDash.viewAll')}</Link>}
        >
          <div className="dash-app-list">
            {pendingRegistrations.map((r) => (
              <Link
                key={r.id}
                to={`${base}/my-registrations/${r.id}`}
                className="dash-app-item"
              >
                <p className="dash-list-title">{r.firstName} {r.lastName}</p>
                <p className="dash-list-meta">
                  {r.registrationClass || t('staffDash.parent.classTbd')} · {t('staffDash.parent.submitted', { date: new Date(r.createdAt).toLocaleDateString() })}
                </p>
              </Link>
            ))}
          </div>
        </DashboardPanel>
      )}

      <div className="dash-metric-strip">
        <ModernStatCard
          index={0}
          icon={Users}
          label={t('staffDash.parent.myChildren')}
          value={children.length}
          sub={children.map((c) => c.class?.name).filter(Boolean).join(' · ') || t('staffDash.parent.notAssigned')}
          accent="green"
        />
        <ModernStatCard
          index={1}
          icon={ClipboardCheck}
          label={t('staffDash.parent.presentToday')}
          value={presentToday}
          sub={t('staffDash.parent.ofEnrolled', { count: children.length })}
          accent="blue"
        />
        <ModernStatCard
          index={2}
          icon={MessageSquare}
          label={t('staffDash.parent.unreadMessages')}
          value={unreadCount}
          sub={t('staffDash.parent.announcementsReplies')}
          accent="teal"
        />
        <ModernStatCard
          index={3}
          icon={Wallet}
          label={t('staffDash.parent.feesDue')}
          value={formatCurrency(feeTotal)}
          sub={t('staffDash.parent.pendingFeesCount', { count: pendingFees.length })}
          accent="gold"
        />
      </div>

      <div className="dash-role-grid">
        <DashboardPanel
          title={t('staffDash.parent.myChildren')}
          description={t('staffDash.parent.todaysAttendance')}
          action={<Link to={`${base}/attendance`} className="dash-link">{t('staffDash.parent.viewAttendance')}</Link>}
          flush
        >
          {children.length === 0 ? (
            <p className="dash-empty">{t('staffDash.parent.noChildrenOnAccount')}</p>
          ) : (
            <div className="dash-list">
              {children.map((child) => {
                const status = statusLabels[child.todayStatus] || notRecordedStatus;
                return (
                  <div key={child.id} className="dash-list-row">
                    <div className="dash-list-avatar">
                      {(child.firstName?.[0] || '') + (child.lastName?.[0] || '?')}
                    </div>
                    <div className="dash-list-main">
                      <p className="dash-list-title">{child.firstName} {child.lastName}</p>
                      <p className="dash-list-meta">{child.studentId} · {child.class?.name || t('ui.unassigned')}</p>
                    </div>
                    <span className={`dash-status-chip ${status.className}`}>{status.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title={t('staffDash.parent.schoolMessages')}
          description={t('staffDash.parent.announcementsConversations')}
          action={<Link to={`${base}/communication`} className="dash-link">{t('staffDash.parent.openInbox')}</Link>}
          flush
        >
          {recentMessages.length === 0 ? (
            <p className="dash-empty">{t('staffDash.parent.noMessagesYet')}</p>
          ) : (
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
          )}
        </DashboardPanel>

        <DashboardPanel title={t('staffDash.parent.quickAccess')}>
          <div className="dash-quick-list">
            <DashQuickLink to={`${base}/register-child`} icon={FileText} label={t('pages.registerChild.title')} />
            <DashQuickLink to={`${base}/my-registrations`} icon={ClipboardCheck} label={t('pages.myRegistrations.title')} badge={pendingRegistrations?.length || 0} />
            <DashQuickLink to={`${base}/communication`} icon={MessageSquare} label={t('pages.communication.titleMessages')} badge={unreadCount} />
            <DashQuickLink to={`${base}/marks`} icon={FileText} label={t('staffDash.parent.marksBulletin')} />
            <DashQuickLink to={`${base}/fees`} icon={Wallet} label={t('staffDash.parent.feesPayments')} badge={pendingFees.length} />
            <DashQuickLink to={`${base}/timetable`} icon={Clock} label={t('pages.timetable.titleParent')} />
            <DashQuickLink to={`${base}/homework`} icon={FileText} label={t('pages.homework.title')} badge={upcomingHomework.length} />
            <DashQuickLink to={`${base}/e-learning`} icon={GraduationCap} label={t('pages.elearning.title')} />
            <DashQuickLink to={`${base}/extracurricular`} icon={Sparkles} label={t('pages.activities.titleShort')} />
            {transport && <DashQuickLink to={`${base}/transport`} icon={Bus} label={t('staffDash.parent.schoolTransport')} />}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title={t('staffDash.parent.upcomingHomework')}
          description={t('staffDash.parent.dueSoonHomework')}
          action={<Link to={`${base}/homework`} className="dash-link">{t('staffDash.viewAll')}</Link>}
          flush
        >
          {upcomingHomework.length === 0 ? (
            <p className="dash-empty">{t('staffDash.parent.noUpcomingHomework')}</p>
          ) : (
            <div className="dash-list">
              {upcomingHomework.map((hw) => (
                <div key={hw.id} className="dash-list-row">
                  <div className="dash-list-main">
                    <p className="dash-list-title">{hw.title}</p>
                    <p className="dash-list-meta">
                      {hw.class?.name} · {t('staffDash.parent.dueDate', { date: new Date(hw.dueDate).toLocaleDateString() })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        {homeworkGrades?.length > 0 && (
          <DashboardPanel
            className="dash-span-2"
            title={t('staffDash.parent.homeworkPerformance')}
            description={t('staffDash.parent.homeworkPerformanceDesc')}
            action={<Link to={`${base}/homework`} className="dash-link">{t('staffDash.parent.viewHomework')}</Link>}
            flush
          >
            <div className="dash-list">
              {homeworkGrades.map((entry) => (
                <div key={entry.student.id} className="dash-grade-block">
                  <div className="dash-grade-head">
                    <p className="dash-list-title">{entry.student.firstName} {entry.student.lastName}</p>
                    <p className="dash-grade-meta">
                      <span className="font-semibold text-gray-900">{entry.completed}</span> {t('staffDash.parent.done')}
                      {entry.pending > 0 && (
                        <> · <span className="text-amber-700">{entry.pending}</span> {t('ui.pending').toLowerCase()}</>
                      )}
                      {entry.averagePercent != null && (
                        <> · <span className="font-semibold text-brand-700">{entry.averagePercent}%</span> {t('staffDash.parent.avg')}</>
                      )}
                    </p>
                  </div>
                  {entry.recentSubmissions?.length > 0 ? (
                    <ul className="dash-grade-subs">
                      {entry.recentSubmissions.slice(0, 3).map((s) => (
                        <li key={s.homeworkId}>
                          <Link to={`${base}/homework/${s.homeworkId}?studentId=${entry.student.id}`} className="dash-link">
                            {s.title}
                          </Link>
                          <span className="font-semibold">{s.score}/{s.maxScore}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="dash-list-meta">{t('staffDash.parent.noSubmissionsYet')}</p>
                  )}
                </div>
              ))}
            </div>
          </DashboardPanel>
        )}

        {eLearningGrades?.length > 0 && (
          <DashboardPanel
            className="dash-span-2"
            title={t('staffDash.parent.eLearningPerformance')}
            description={t('staffDash.parent.eLearningPerformanceDesc')}
            action={<Link to={`${base}/e-learning`} className="dash-link">{t('staffDash.parent.viewELearning')}</Link>}
            flush
          >
            <div className="dash-list">
              {eLearningGrades.map((entry) => (
                <div key={entry.student.id} className="dash-grade-block">
                  <div className="dash-grade-head">
                    <p className="dash-list-title">{entry.student.firstName} {entry.student.lastName}</p>
                    <p className="dash-grade-meta">
                      <span className="font-semibold text-gray-900">{entry.completed}</span> {t('staffDash.parent.done')}
                      {entry.pending > 0 && (
                        <> · <span className="text-amber-700">{entry.pending}</span> {t('ui.pending').toLowerCase()}</>
                      )}
                      {entry.averagePercent != null && (
                        <> · <span className="font-semibold text-brand-700">{entry.averagePercent}%</span> {t('staffDash.parent.avg')}</>
                      )}
                    </p>
                  </div>
                  {entry.recentSubmissions?.length > 0 ? (
                    <ul className="dash-grade-subs">
                      {entry.recentSubmissions.slice(0, 3).map((s) => (
                        <li key={s.courseId}>
                          <Link to={`${base}/e-learning/${s.courseId}?studentId=${entry.student.id}`} className="dash-link">
                            {s.title}
                          </Link>
                          <span className="font-semibold">{s.score}/{s.maxScore}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="dash-list-meta">{t('staffDash.parent.noExerciseSubmissions')}</p>
                  )}
                </div>
              ))}
            </div>
          </DashboardPanel>
        )}

        {pendingFees.length > 0 && (
          <DashboardPanel
            className="dash-span-2"
            title={t('staffDash.parent.pendingFees')}
            description={t('staffDash.parent.outstandingPayments')}
            action={<Link to={`${base}/fees`} className="dash-link">{t('staffDash.parent.payView')}</Link>}
            flush
          >
            <div className="dash-list">
              {pendingFees.slice(0, 4).map((fee) => (
                <div key={fee.id} className="dash-list-row">
                  <div className="dash-list-main">
                    <p className="dash-list-title">{fee.student?.firstName} {fee.student?.lastName}</p>
                    <p className="dash-list-meta">{fee.feeType} · {fee.status}</p>
                  </div>
                  <span className="font-semibold text-sm text-gray-900">{formatCurrency(fee.amount)}</span>
                </div>
              ))}
            </div>
          </DashboardPanel>
        )}
      </div>
    </DashboardShell>
  );
}
