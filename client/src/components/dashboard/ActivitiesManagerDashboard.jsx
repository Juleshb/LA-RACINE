import { Link } from 'react-router-dom';
import {
  Sparkles, UserCheck, Users, BarChart3, AlertCircle, CalendarDays,
} from 'lucide-react';
import ModernStatCard from './ModernStatCard';
import DashboardShell from './DashboardShell';
import DashboardPanel from './DashboardPanel';
import DashQuickLink from './DashQuickLink';
import { useTranslation } from '../../context/LanguageContext';

export default function ActivitiesManagerDashboard({ campusId, data, userName }) {
  const { t, language } = useTranslation();
  const base = `/campus/${campusId}`;
  const {
    activeCount,
    totalCount,
    enrollments,
    nearlyFull,
    full,
    externalInstructors,
    byCategory,
    recentActivities,
  } = data;

  const todayLabel = new Date().toLocaleDateString(
    language === 'en' ? undefined : language,
    { weekday: 'long', month: 'long', day: 'numeric' },
  );

  const ringStyle = { '--dash-rate': `${Math.min(100, Math.max(0, activeCount ? 100 : 0))}%` };

  return (
    <DashboardShell
      kicker={t('pages.dashboard.kickerActivitiesManager')}
      title={t('staffDash.welcome', { name: userName })}
      description={t('staffDash.activitiesManager.description')}
      actions={(
        <span className="dash-date-chip">
          <CalendarDays className="w-3.5 h-3.5" aria-hidden />
          {todayLabel}
        </span>
      )}
      heroAside={(
        <div className="dash-pulse is-finance" style={ringStyle}>
          <div className="dash-pulse-ring" aria-hidden />
          <div className="dash-pulse-core">
            <p className="dash-pulse-value">{activeCount}</p>
            <p className="dash-pulse-label">{t('staffDash.activitiesManager.activeClubs')}</p>
          </div>
        </div>
      )}
    >
      {(nearlyFull.length > 0 || full.length > 0) && (
        <div className="dash-alert is-info">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="dash-alert-title">{t('staffDash.activitiesManager.capacityTitle')}</p>
            <p className="dash-alert-body">
              {t('staffDash.activitiesManager.capacityBody', {
                full: full.length,
                nearly: nearlyFull.length,
              })}
              {' '}
              <Link to={`${base}/extracurricular`} className="font-semibold underline">
                {t('staffDash.activitiesManager.manageActivities')}
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="dash-metric-strip">
        <ModernStatCard
          index={0}
          icon={Sparkles}
          label={t('staffDash.activitiesManager.totalActivities')}
          value={totalCount}
          sub={t('staffDash.activitiesManager.activeOfTotal', { active: activeCount, total: totalCount })}
          accent="teal"
        />
        <ModernStatCard
          index={1}
          icon={UserCheck}
          label={t('staffDash.activitiesManager.totalEnrollments')}
          value={enrollments}
          sub={t('staffDash.activitiesManager.acrossClubs')}
          accent="blue"
        />
        <ModernStatCard
          index={2}
          icon={Users}
          label={t('staffDash.activitiesManager.externalCoaches')}
          value={externalInstructors.length}
          sub={t('staffDash.activitiesManager.registeredCoaches')}
          accent="gold"
        />
      </div>

      <div className="dash-bento">
        <div className="dash-bento-main">
          <DashboardPanel
            title={t('staffDash.activitiesManager.sectionClubs')}
            description={t('staffDash.activitiesManager.sectionClubsDesc')}
            action={(
              <Link to={`${base}/extracurricular`} className="text-sm font-medium text-brand-700 hover:underline">
                {t('staffDash.activitiesManager.manageActivities')}
              </Link>
            )}
          >
            {recentActivities.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                {t('staffDash.activitiesManager.noActivities')}
              </p>
            ) : (
              <ul className="dash-list">
                {recentActivities.map((a) => (
                  <li key={a.id} className="dash-list-item">
                    <div className="min-w-0">
                      <p className="dash-list-title">{a.name}</p>
                      <p className="dash-list-meta">
                        {[a.category, a.schedule, a.instructorName].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <span className="dash-list-badge">
                      {a.enrolled}{a.maxStudents ? ` / ${a.maxStudents}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardPanel>
        </div>

        <div className="dash-bento-side space-y-4">
          <DashboardPanel
            title={t('staffDash.activitiesManager.byCategory')}
            description={t('staffDash.activitiesManager.byCategoryDesc')}
          >
            {byCategory.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">—</p>
            ) : (
              <ul className="space-y-2">
                {byCategory.map((row) => (
                  <li key={row.category} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">{row.category}</span>
                    <span className="text-gray-500">
                      {t('staffDash.activitiesManager.categoryStats', {
                        clubs: row.activities,
                        enrolled: row.enrollments,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardPanel>

          <DashboardPanel
            title={t('staffDash.activitiesManager.quickAccess')}
            description={t('staffDash.activitiesManager.quickAccessDesc')}
          >
            <div className="grid grid-cols-1 gap-2">
              <DashQuickLink
                to={`${base}/extracurricular`}
                icon={Sparkles}
                label={t('staffDash.activitiesManager.manageActivities')}
              />
              <DashQuickLink
                to={`${base}/reports`}
                icon={BarChart3}
                label={t('staffDash.activitiesManager.reports')}
              />
            </div>
          </DashboardPanel>
        </div>
      </div>
    </DashboardShell>
  );
}
