import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, BookOpen, Wallet, UserCheck, TrendingUp, Award, CalendarDays,
} from 'lucide-react';
import ModernStatCard from './ModernStatCard';
import DashboardShell from './DashboardShell';
import DashboardPanel from './DashboardPanel';
import {
  AttendanceDonutChart,
  AttendanceTrendChart,
  FeeStatusChart,
  StudentsByClassChart,
  RegistrationChart,
  MarksRecordingChart,
  MarksByClassChart,
  MarksRecordingTrendChart,
} from './DashboardCharts';
import { feeStatusColors } from './ChartCard';
import {
  formatCurrency,
  buildStudentsByClass,
  buildRegistrationBreakdown,
} from '../../hooks/useDashboardData';
import { useTranslation } from '../../context/LanguageContext';

export default function DashboardOverview({ campusId, data, shellProps }) {
  const { t, language } = useTranslation();
  const { stats, students, classes, teachers, fees, marksStats } = data;
  const studentsByClass = buildStudentsByClass(students, classes);
  const registrationBreakdown = buildRegistrationBreakdown(students);
  const base = `/campus/${campusId}`;

  const todayLabel = new Date().toLocaleDateString(
    language === 'en' ? undefined : language,
    { weekday: 'long', month: 'long', day: 'numeric' },
  );

  const rate = stats.attendanceRate;
  const ringStyle = {
    '--dash-rate': `${Math.min(100, Math.max(0, rate ?? 0))}%`,
  };

  return (
    <DashboardShell
      brand={shellProps?.brand}
      kicker={shellProps?.kicker || t('pages.dashboard.kicker')}
      title={shellProps?.title || t('pages.dashboard.title')}
      description={shellProps?.description || t('pages.dashboard.description')}
      actions={shellProps?.actions || (
        <span className="dash-date-chip">
          <CalendarDays className="w-3.5 h-3.5" aria-hidden />
          {todayLabel}
        </span>
      )}
      heroAside={(
        <div className="dash-pulse" style={ringStyle}>
          <div className="dash-pulse-ring" aria-hidden />
          <div className="dash-pulse-core">
            <p className="dash-pulse-value">{rate != null ? `${rate}%` : '—'}</p>
            <p className="dash-pulse-label">{t('pages.dashboard.presentToday')}</p>
          </div>
        </div>
      )}
    >
      <div className="dash-metric-strip">
        <ModernStatCard
          index={0}
          icon={Users}
          label={t('staffDash.totalStudents')}
          value={stats.totalStudents}
          sub={t('staffDash.nClasses', { count: classes.length })}
          accent="green"
        />
        <ModernStatCard
          index={1}
          icon={GraduationCap}
          label={t('staffDash.teachers')}
          value={teachers.length}
          sub={t('staffDash.activeStaff')}
          accent="blue"
        />
        <ModernStatCard
          index={2}
          icon={BookOpen}
          label={t('staffDash.classes')}
          value={classes.length}
          sub={t('staffDash.thisYear')}
          accent="teal"
        />
        <ModernStatCard
          index={3}
          icon={Wallet}
          label={t('staffDash.feesCollected')}
          value={formatCurrency(stats.totalCollected)}
          sub={t('staffDash.paidRecords', { count: stats.paid || 0 })}
          accent="gold"
        />
      </div>

      <div className="dash-bento">
        <div className="dash-bento-main">
          <AttendanceDonutChart stats={stats} />
        </div>

        <Link to={`${base}/marks`} className="dash-spotlight dash-spotlight-marks">
          <span className="dash-spotlight-icon"><Award className="w-5 h-5" /></span>
          <span className="dash-spotlight-label">{t('staffDash.highlights.marksRecorded')}</span>
          <span className="dash-spotlight-value">
            {marksStats?.totalMarks || 0}
            <small>{t('staffDash.highlights.entries')}</small>
          </span>
          <span className="dash-spotlight-meta">
            {t('staffDash.highlights.marksMeta', {
              assessments: marksStats?.byAssessment?.length || 0,
              classes: marksStats?.byClass?.length || 0,
            })}
          </span>
          <span className="dash-spotlight-cta">
            <TrendingUp className="w-4 h-4" />
            {t('staffDash.highlights.recordMarks')}
          </span>
        </Link>

        <Link to={`${base}/attendance`} className="dash-spotlight dash-spotlight-att">
          <span className="dash-spotlight-icon"><UserCheck className="w-5 h-5" /></span>
          <span className="dash-spotlight-label">{t('staffDash.highlights.attendanceToday')}</span>
          <span className="dash-spotlight-value">
            {stats.presentToday}
            <small>{t('staffDash.highlights.presentLabel')}</small>
          </span>
          <span className="dash-spotlight-meta">
            {t('staffDash.highlights.attendanceMeta', {
              absent: stats.absentToday,
              late: stats.lateToday,
            })}
          </span>
          <span className="dash-spotlight-cta is-static">
            <TrendingUp className="w-4 h-4" />
            {rate != null ? `${rate}%` : '—'}
          </span>
        </Link>
      </div>

      <div className="dash-section">
        <div className="dash-section-label">
          <h2>{t('pages.dashboard.sectionTrends')}</h2>
          <p>{t('pages.dashboard.sectionTrendsDesc')}</p>
        </div>
        <div className="dash-charts-grid">
          <AttendanceTrendChart weeklyTrend={stats.weeklyTrend} />
          <MarksRecordingTrendChart weeklyRecording={marksStats?.weeklyRecording} />
          <MarksRecordingChart marksStats={marksStats} />
          <MarksByClassChart data={marksStats?.byClass || []} />
          <FeeStatusChart stats={stats} />
          <StudentsByClassChart data={studentsByClass} />
        </div>
      </div>

      <div className="dash-section">
        <div className="dash-section-label">
          <h2>{t('pages.dashboard.sectionActivity')}</h2>
          <p>{t('pages.dashboard.sectionActivityDesc')}</p>
        </div>
        <div className="dash-activity-grid">
          <RegistrationChart data={registrationBreakdown} />

          <DashboardPanel
            title={t('staffDash.recentStudents')}
            description={t('staffDash.latestEnrollments')}
            action={<Link to={`${base}/students`} className="dash-link">{t('staffDash.viewAll')}</Link>}
            flush
          >
            {students.length === 0 ? (
              <p className="dash-empty">{t('staffDash.noStudents')}</p>
            ) : (
              <div className="dash-list">
                {students.slice(0, 5).map((student) => (
                  <div key={student.id} className="dash-list-row">
                    <div className="dash-list-avatar">
                      {(student.firstName?.[0] || '') + (student.lastName?.[0] || '')}
                    </div>
                    <div className="dash-list-main">
                      <p className="dash-list-title">{student.firstName} {student.lastName}</p>
                      <p className="dash-list-meta">{student.studentId}</p>
                    </div>
                    <span className="dash-list-badge">{student.class?.name || t('ui.unassigned')}</span>
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
                {fees.slice(0, 5).map((fee) => (
                  <div key={fee.id} className="dash-list-row">
                    <div className="dash-list-avatar is-fee">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="dash-list-main">
                      <p className="dash-list-title">{fee.student.firstName} {fee.student.lastName}</p>
                      <p className="dash-list-meta">{formatCurrency(fee.amount)}</p>
                    </div>
                    <span className={feeStatusColors[fee.status]}>{fee.status}</span>
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>
        </div>
      </div>
    </DashboardShell>
  );
}
