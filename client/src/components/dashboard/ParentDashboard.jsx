import { Link } from 'react-router-dom';
import {
  Users, MessageSquare, Wallet, ClipboardCheck, Clock, FileText,
  Bus, Sparkles, ChevronRight, AlertCircle, GraduationCap,
} from 'lucide-react';
import PageHeader from '../PageHeader';
import ModernStatCard from './ModernStatCard';
import { formatCurrency } from '../../hooks/useDashboardData';
import { useTranslation } from '../../context/LanguageContext';

function QuickLink({ to, icon: Icon, label, badge }) {
  return (
    <Link to={to} className="parent-quick-link">
      <div className="parent-quick-link-icon">
        <Icon className="w-5 h-5" />
      </div>
      <span className="flex-1 font-medium text-sm">{label}</span>
      {badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-gray-300" />
    </Link>
  );
}

export default function ParentDashboard({ campusId, data, userName }) {
  const { t } = useTranslation();
  const base = `/campus/${campusId}`;
  const { children, unreadCount, recentMessages, pendingFees, upcomingHomework, homeworkGrades, eLearningGrades, transport, pendingRegistrations, childrenWithoutLogin } = data;

  const presentToday = children.filter((c) => c.todayStatus === 'PRESENT').length;
  const feeTotal = pendingFees.reduce((sum, f) => sum + (f.amount || 0), 0);

  const statusLabels = {
    PRESENT: { label: t('staffDash.attendance.present'), className: 'bg-green-100 text-green-800' },
    ABSENT: { label: t('staffDash.attendance.absent'), className: 'bg-red-100 text-red-800' },
    LATE: { label: t('staffDash.attendance.late'), className: 'bg-amber-100 text-amber-800' },
    EXCUSED: { label: t('staffDash.attendance.excused'), className: 'bg-blue-100 text-blue-800' },
  };
  const notRecordedStatus = { label: t('staffDash.attendance.notRecorded'), className: 'bg-gray-100 text-gray-600' };

  return (
    <div className="parent-dashboard">
      <PageHeader
        title={t('staffDash.welcome', { name: userName })}
        description={t('staffDash.parent.description')}
      />

      {children.length === 0 && !pendingRegistrations?.length && (
        <div className="card mb-6 flex items-start gap-3 border-amber-200 bg-amber-50/80">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">{t('staffDash.parent.noChildrenTitle')}</p>
            <p className="text-sm text-amber-800 mt-1">
              {t('staffDash.parent.noChildrenBeforeLink')}{' '}
              <Link to={`${base}/register-child`} className="font-semibold underline">{t('pages.registerChild.title')}</Link>{' '}
              {t('staffDash.parent.noChildrenAfterLink')}
            </p>
          </div>
        </div>
      )}

      {childrenWithoutLogin > 0 && (
        <div className="card mb-6 flex items-start gap-3 border-sky-200 bg-sky-50/80">
          <AlertCircle className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sky-900 text-sm">{t('staffDash.parent.portalTitle')}</p>
            <p className="text-sm text-sky-800 mt-1">
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
        <div className="card mb-6 border-amber-200 bg-amber-50/50">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold text-amber-900">{t('staffDash.parent.applicationsTitle')}</h3>
              <p className="text-sm text-amber-800 mt-0.5">{t('staffDash.parent.applicationsPending', { count: pendingRegistrations.length })}</p>
            </div>
            <Link to={`${base}/my-registrations`} className="text-sm link">{t('staffDash.viewAll')}</Link>
          </div>
          <div className="space-y-2">
            {pendingRegistrations.map((r) => (
              <Link
                key={r.id}
                to={`${base}/my-registrations/${r.id}`}
                className="block p-3 rounded-lg bg-white border border-amber-100 hover:border-amber-200 transition-colors"
              >
                <p className="font-medium text-sm text-gray-900">
                  {r.firstName} {r.lastName}
                </p>
                <p className="text-xs text-gray-500">
                  {r.registrationClass || t('staffDash.parent.classTbd')} · {t('staffDash.parent.submitted', { date: new Date(r.createdAt).toLocaleDateString() })}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="dashboard-kpi-grid">
        <ModernStatCard
          icon={Users}
          label={t('staffDash.parent.myChildren')}
          value={children.length}
          sub={children.map((c) => c.class?.name).filter(Boolean).join(' · ') || t('staffDash.parent.notAssigned')}
          accent="green"
        />
        <ModernStatCard
          icon={ClipboardCheck}
          label={t('staffDash.parent.presentToday')}
          value={presentToday}
          sub={t('staffDash.parent.ofEnrolled', { count: children.length })}
          accent="blue"
        />
        <ModernStatCard
          icon={MessageSquare}
          label={t('staffDash.parent.unreadMessages')}
          value={unreadCount}
          sub={t('staffDash.parent.announcementsReplies')}
          accent="purple"
        />
        <ModernStatCard
          icon={Wallet}
          label={t('staffDash.parent.feesDue')}
          value={formatCurrency(feeTotal)}
          sub={t('staffDash.parent.pendingFeesCount', { count: pendingFees.length })}
          accent="gold"
        />
      </div>

      <div className="parent-dashboard-grid">
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{t('staffDash.parent.myChildren')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('staffDash.parent.todaysAttendance')}</p>
            </div>
            <Link to={`${base}/attendance`} className="text-xs link">{t('staffDash.parent.viewAttendance')}</Link>
          </div>
          {children.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">{t('staffDash.parent.noChildrenOnAccount')}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {children.map((child) => {
                const status = statusLabels[child.todayStatus] || notRecordedStatus;
                return (
                  <div key={child.id} className="p-4 flex items-center gap-3">
                    <div className="dashboard-list-avatar">
                      {(child.firstName?.[0] || '') + (child.lastName?.[0] || '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">
                        {child.firstName} {child.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{child.studentId} · {child.class?.name || t('ui.unassigned')}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{t('staffDash.parent.schoolMessages')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('staffDash.parent.announcementsConversations')}</p>
            </div>
            <Link to={`${base}/communication`} className="text-xs link">{t('staffDash.parent.openInbox')}</Link>
          </div>
          {recentMessages.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">{t('staffDash.parent.noMessagesYet')}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentMessages.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  to={`${base}/communication`}
                  className={`block p-4 hover:bg-gray-50 transition-colors ${!item.isRead ? 'bg-brand-50/30' : ''}`}
                >
                  <p className="font-medium text-sm text-gray-900 truncate">{item.title}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{item.body}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 mb-3">{t('staffDash.parent.quickAccess')}</h3>
          <div className="space-y-1">
            <QuickLink to={`${base}/register-child`} icon={FileText} label={t('pages.registerChild.title')} />
            <QuickLink to={`${base}/my-registrations`} icon={ClipboardCheck} label={t('pages.myRegistrations.title')} badge={pendingRegistrations?.length || 0} />
            <QuickLink to={`${base}/communication`} icon={MessageSquare} label={t('pages.communication.titleMessages')} badge={unreadCount} />
            <QuickLink to={`${base}/marks`} icon={FileText} label={t('staffDash.parent.marksBulletin')} />
            <QuickLink to={`${base}/fees`} icon={Wallet} label={t('staffDash.parent.feesPayments')} badge={pendingFees.length} />
            <QuickLink to={`${base}/timetable`} icon={Clock} label={t('pages.timetable.titleParent')} />
            <QuickLink to={`${base}/homework`} icon={FileText} label={t('pages.homework.title')} badge={upcomingHomework.length} />
            <QuickLink to={`${base}/e-learning`} icon={GraduationCap} label={t('pages.elearning.title')} />
            <QuickLink to={`${base}/extracurricular`} icon={Sparkles} label={t('pages.activities.titleShort')} />
            {transport && <QuickLink to={`${base}/transport`} icon={Bus} label={t('staffDash.parent.schoolTransport')} />}
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{t('staffDash.parent.upcomingHomework')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('staffDash.parent.dueSoonHomework')}</p>
            </div>
            <Link to={`${base}/homework`} className="text-xs link">{t('staffDash.viewAll')}</Link>
          </div>
          {upcomingHomework.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">{t('staffDash.parent.noUpcomingHomework')}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {upcomingHomework.map((hw) => (
                <div key={hw.id} className="p-4">
                  <p className="font-medium text-sm text-gray-900">{hw.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {hw.class?.name} · {t('staffDash.parent.dueDate', { date: new Date(hw.dueDate).toLocaleDateString() })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {homeworkGrades?.length > 0 && (
          <div className="card p-0 overflow-hidden md:col-span-2">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{t('staffDash.parent.homeworkPerformance')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('staffDash.parent.homeworkPerformanceDesc')}</p>
              </div>
              <Link to={`${base}/homework`} className="text-xs link">{t('staffDash.parent.viewHomework')}</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {homeworkGrades.map((entry) => (
                <div key={entry.student.id} className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="font-semibold text-sm text-gray-900">
                      {entry.student.firstName} {entry.student.lastName}
                    </p>
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{entry.completed}</span> {t('staffDash.parent.done')}
                      {entry.pending > 0 && (
                        <> · <span className="text-amber-700">{entry.pending}</span> {t('ui.pending').toLowerCase()}</>
                      )}
                      {entry.averagePercent != null && (
                        <> · <span className="font-semibold text-brand-700">{entry.averagePercent}%</span> {t('staffDash.parent.avg')}</>
                      )}
                    </div>
                  </div>
                  {entry.recentSubmissions?.length > 0 ? (
                    <ul className="space-y-1.5">
                      {entry.recentSubmissions.slice(0, 3).map((s) => (
                        <li key={s.homeworkId} className="flex items-center justify-between text-sm">
                          <Link
                            to={`${base}/homework/${s.homeworkId}?studentId=${entry.student.id}`}
                            className="text-brand-700 hover:underline truncate"
                          >
                            {s.title}
                          </Link>
                          <span className="font-semibold shrink-0 ml-2">{s.score}/{s.maxScore}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500">{t('staffDash.parent.noSubmissionsYet')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {eLearningGrades?.length > 0 && (
          <div className="card p-0 overflow-hidden md:col-span-2">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{t('staffDash.parent.eLearningPerformance')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('staffDash.parent.eLearningPerformanceDesc')}</p>
              </div>
              <Link to={`${base}/e-learning`} className="text-xs link">{t('staffDash.parent.viewELearning')}</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {eLearningGrades.map((entry) => (
                <div key={entry.student.id} className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="font-semibold text-sm text-gray-900">
                      {entry.student.firstName} {entry.student.lastName}
                    </p>
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{entry.completed}</span> {t('staffDash.parent.done')}
                      {entry.pending > 0 && (
                        <> · <span className="text-amber-700">{entry.pending}</span> {t('ui.pending').toLowerCase()}</>
                      )}
                      {entry.averagePercent != null && (
                        <> · <span className="font-semibold text-brand-700">{entry.averagePercent}%</span> {t('staffDash.parent.avg')}</>
                      )}
                    </div>
                  </div>
                  {entry.recentSubmissions?.length > 0 ? (
                    <ul className="space-y-1.5">
                      {entry.recentSubmissions.slice(0, 3).map((s) => (
                        <li key={s.courseId} className="flex items-center justify-between text-sm">
                          <Link
                            to={`${base}/e-learning/${s.courseId}?studentId=${entry.student.id}`}
                            className="text-brand-700 hover:underline truncate"
                          >
                            {s.title}
                          </Link>
                          <span className="font-semibold shrink-0 ml-2">{s.score}/{s.maxScore}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500">{t('staffDash.parent.noExerciseSubmissions')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingFees.length > 0 && (
          <div className="card p-0 overflow-hidden md:col-span-2">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{t('staffDash.parent.pendingFees')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('staffDash.parent.outstandingPayments')}</p>
              </div>
              <Link to={`${base}/fees`} className="text-xs link">{t('staffDash.parent.payView')}</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {pendingFees.slice(0, 4).map((fee) => (
                <div key={fee.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {fee.student?.firstName} {fee.student?.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{fee.feeType} · {fee.status}</p>
                  </div>
                  <span className="font-semibold text-sm text-gray-900">{formatCurrency(fee.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
