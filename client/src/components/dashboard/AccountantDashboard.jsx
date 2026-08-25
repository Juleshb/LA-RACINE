import { Link } from 'react-router-dom';
import {
  Users, MessageSquare, Wallet, Bus, BarChart3, School, FileText,
  AlertCircle, CreditCard, CalendarDays, TrendingUp,
} from 'lucide-react';
import ModernStatCard from './ModernStatCard';
import DashboardShell from './DashboardShell';
import DashboardPanel from './DashboardPanel';
import DashQuickLink from './DashQuickLink';
import { FeeStatusChart, RegistrationChart } from './DashboardCharts';
import { feeStatusColors } from './ChartCard';
import { formatCurrency } from '../../hooks/useDashboardData';
import { buildAccountantRegistrationBreakdown } from '../../hooks/useAccountantDashboardData';
import { useTranslation } from '../../context/LanguageContext';

export default function AccountantDashboard({ campusId, data, userName }) {
  const { t, language } = useTranslation();
  const base = `/campus/${campusId}`;
  const {
    stats,
    fees,
    students,
    pendingFees,
    awaitingConfirmation,
    unreadCount,
    transport,
    feesByType,
  } = data;

  const registrationBreakdown = buildAccountantRegistrationBreakdown(students);
  const pendingTotal = pendingFees.reduce((sum, f) => sum + (f.amount || 0), 0);
  const collectionRate = stats.total > 0
    ? Math.round((stats.paid / stats.total) * 100)
    : 0;

  const todayLabel = new Date().toLocaleDateString(
    language === 'en' ? undefined : language,
    { weekday: 'long', month: 'long', day: 'numeric' },
  );

  const ringStyle = { '--dash-rate': `${Math.min(100, Math.max(0, collectionRate))}%` };

  return (
    <DashboardShell
      kicker={t('pages.dashboard.kickerAccountant')}
      title={t('staffDash.welcome', { name: userName })}
      description={t('staffDash.accountant.description')}
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
            <p className="dash-pulse-value">{collectionRate}%</p>
            <p className="dash-pulse-label">{t('staffDash.accountant.collectionRate')}</p>
          </div>
        </div>
      )}
    >
      {awaitingConfirmation.length > 0 && (
        <div className="dash-alert is-info">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="dash-alert-title">{t('staffDash.accountant.confirmationTitle')}</p>
            <p className="dash-alert-body">
              {t('staffDash.accountant.confirmationBody', { count: awaitingConfirmation.length })}
              {' '}
              <Link to={`${base}/fees`} className="font-semibold underline">
                {t('staffDash.accountant.recordPayments')}
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="dash-metric-strip">
        <ModernStatCard
          index={0}
          icon={Wallet}
          label={t('staffDash.feesCollected')}
          value={formatCurrency(stats.totalCollected)}
          sub={t('staffDash.paidRecords', { count: stats.paid || 0 })}
          accent="green"
        />
        <ModernStatCard
          index={1}
          icon={TrendingUp}
          label={t('staffDash.accountant.pendingAmount')}
          value={formatCurrency(pendingTotal)}
          sub={t('staffDash.accountant.pendingRecords', { count: stats.pending + stats.overdue })}
          accent="gold"
        />
        <ModernStatCard
          index={2}
          icon={Users}
          label={t('staffDash.totalStudents')}
          value={students.length}
          sub={t('staffDash.accountant.approvedStudents', {
            count: students.filter((s) => s.registrationStatus === 'APPROVED').length,
          })}
          accent="blue"
        />
        <ModernStatCard
          index={3}
          icon={MessageSquare}
          label={t('staffDash.accountant.unreadMessages')}
          value={unreadCount}
          sub={t('staffDash.accountant.feeInquiries')}
          accent="teal"
        />
      </div>

      <div className="dash-bento">
        <div className="dash-bento-main">
          <FeeStatusChart stats={stats} />
        </div>

        <Link to={`${base}/fees`} className="dash-spotlight dash-spotlight-fees">
          <span className="dash-spotlight-icon"><Wallet className="w-5 h-5" /></span>
          <span className="dash-spotlight-label">{t('staffDash.accountant.overdueFees')}</span>
          <span className="dash-spotlight-value">
            {stats.overdue || 0}
            <small>{t('staffDash.feeStatus.overdue')}</small>
          </span>
          <span className="dash-spotlight-meta">
            {t('staffDash.accountant.pendingCount', { count: stats.pending || 0 })}
          </span>
          <span className="dash-spotlight-cta">
            <Wallet className="w-4 h-4" />
            {t('staffDash.accountant.manageFees')}
          </span>
        </Link>

        {transport && (
          <Link to={`${base}/transport`} className="dash-spotlight dash-spotlight-transport">
            <span className="dash-spotlight-icon"><Bus className="w-5 h-5" /></span>
            <span className="dash-spotlight-label">{t('staffDash.accountant.transportPassengers')}</span>
            <span className="dash-spotlight-value">
              {transport.passengers ?? 0}
              <small>{t('staffDash.accountant.onRoutes')}</small>
            </span>
            <span className="dash-spotlight-meta">
              {t('staffDash.accountant.activeRoutes', { count: transport.routes ?? 0 })}
            </span>
            <span className="dash-spotlight-cta">
              <Bus className="w-4 h-4" />
              {t('staffDash.accountant.viewTransport')}
            </span>
          </Link>
        )}
      </div>

      <div className="dash-section">
        <div className="dash-section-label">
          <h2>{t('staffDash.accountant.sectionFinance')}</h2>
          <p>{t('staffDash.accountant.sectionFinanceDesc')}</p>
        </div>
        <div className="dash-charts-grid">
          <RegistrationChart data={registrationBreakdown} />

          {feesByType.length > 0 && (
            <DashboardPanel
              title={t('staffDash.accountant.feesByType')}
              description={t('staffDash.accountant.feesByTypeDesc')}
              flush
            >
              <div className="dash-list">
                {feesByType.slice(0, 6).map((row) => (
                  <div key={row.type} className="dash-list-row">
                    <div className="dash-list-main">
                      <p className="dash-list-title">{row.type.replace(/_/g, ' ')}</p>
                      <p className="dash-list-meta">{t('staffDash.accountant.typeRecords', { count: row.count })}</p>
                    </div>
                    <span className="dash-list-badge">{formatCurrency(row.amount)}</span>
                  </div>
                ))}
              </div>
            </DashboardPanel>
          )}
        </div>
      </div>

      <div className="dash-section">
        <div className="dash-section-label">
          <h2>{t('staffDash.accountant.sectionActivity')}</h2>
          <p>{t('staffDash.accountant.sectionActivityDesc')}</p>
        </div>
        <div className="dash-activity-grid">
          <DashboardPanel
            title={t('staffDash.accountant.outstandingFees')}
            description={t('staffDash.accountant.outstandingFeesDesc')}
            action={<Link to={`${base}/fees`} className="dash-link">{t('staffDash.viewAll')}</Link>}
            flush
          >
            {pendingFees.length === 0 ? (
              <p className="dash-empty">{t('staffDash.accountant.noOutstanding')}</p>
            ) : (
              <div className="dash-list">
                {pendingFees.slice(0, 6).map((fee) => (
                  <div key={fee.id} className="dash-list-row">
                    <div className="dash-list-avatar is-fee">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="dash-list-main">
                      <p className="dash-list-title">{fee.student.firstName} {fee.student.lastName}</p>
                      <p className="dash-list-meta">
                        {fee.feeType?.replace(/_/g, ' ') || t('staffDash.accountant.fee')} · {formatCurrency(fee.amount)}
                      </p>
                    </div>
                    <span className={feeStatusColors[fee.status]}>{fee.status}</span>
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel
            title={t('staffDash.recentFees')}
            description={t('staffDash.latestPayments')}
            action={<Link to={`${base}/fees`} className="dash-link">{t('staffDash.viewAll')}</Link>}
            flush
          >
            {fees.length === 0 ? (
              <p className="dash-empty">{t('staffDash.noFees')}</p>
            ) : (
              <div className="dash-list">
                {fees.filter((f) => f.status === 'PAID').slice(0, 5).map((fee) => (
                  <div key={fee.id} className="dash-list-row">
                    <div className="dash-list-avatar is-fee">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="dash-list-main">
                      <p className="dash-list-title">{fee.student.firstName} {fee.student.lastName}</p>
                      <p className="dash-list-meta">{formatCurrency(fee.amount)}</p>
                    </div>
                    <span className={feeStatusColors.PAID}>{fee.status}</span>
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel title={t('staffDash.accountant.quickAccess')}>
            <div className="dash-quick-list">
              <DashQuickLink to={`${base}/fees`} icon={Wallet} label={t('staffDash.accountant.recordPayment')} />
              <DashQuickLink to={`${base}/students/register`} icon={FileText} label={t('staffDash.accountant.admitStudent')} />
              <DashQuickLink to={`${base}/students`} icon={Users} label={t('pages.students.title')} />
              <DashQuickLink to={`${base}/reports`} icon={BarChart3} label={t('pages.reports.title')} />
              <DashQuickLink to={`${base}/communication`} icon={MessageSquare} label={t('staffDash.accountant.messages')} badge={unreadCount} />
              <DashQuickLink to={`${base}/transport`} icon={Bus} label={t('staffDash.accountant.transport')} />
              <DashQuickLink to={`${base}/id-cards`} icon={CreditCard} label={t('staffDash.accountant.idCards')} />
              <DashQuickLink to={`${base}/school`} icon={School} label={t('staffDash.manager.schoolProfile')} />
            </div>
          </DashboardPanel>
        </div>
      </div>
    </DashboardShell>
  );
}
