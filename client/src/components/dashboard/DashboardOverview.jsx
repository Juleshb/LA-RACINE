import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, BookOpen, Wallet, UserCheck, TrendingUp, Award,
} from 'lucide-react';
import ModernStatCard from './ModernStatCard';
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

export default function DashboardOverview({ campusId, data }) {
  const { t } = useTranslation();
  const { stats, students, classes, teachers, fees, marksStats } = data;
  const studentsByClass = buildStudentsByClass(students, classes);
  const registrationBreakdown = buildRegistrationBreakdown(students);
  const base = `/campus/${campusId}`;

  return (
    <div className="dashboard-overview">
      <div className="dashboard-kpi-grid">
        <ModernStatCard
          icon={Users}
          label={t('staffDash.totalStudents')}
          value={stats.totalStudents}
          sub={t('staffDash.nClasses', { count: classes.length })}
          accent="green"
        />
        <ModernStatCard
          icon={GraduationCap}
          label={t('staffDash.teachers')}
          value={teachers.length}
          sub={t('staffDash.activeStaff')}
          accent="blue"
        />
        <ModernStatCard
          icon={BookOpen}
          label={t('staffDash.classes')}
          value={classes.length}
          sub={t('staffDash.thisYear')}
          accent="purple"
        />
        <ModernStatCard
          icon={Wallet}
          label={t('staffDash.feesCollected')}
          value={formatCurrency(stats.totalCollected)}
          sub={t('staffDash.paidRecords', { count: stats.paid || 0 })}
          accent="gold"
        />
      </div>

      <div className="dashboard-charts-grid">
        <AttendanceDonutChart stats={stats} />
        <AttendanceTrendChart weeklyTrend={stats.weeklyTrend} />
        <MarksRecordingChart marksStats={marksStats} />
        <MarksRecordingTrendChart weeklyRecording={marksStats?.weeklyRecording} />
        <MarksByClassChart data={marksStats?.byClass || []} />
        <FeeStatusChart stats={stats} />
        <StudentsByClassChart data={studentsByClass} />
      </div>

      <div className="dashboard-bottom-grid">
        <RegistrationChart data={registrationBreakdown} />

        <div className="dashboard-list-card">
          <div className="dashboard-list-header">
            <div>
              <h3 className="dashboard-chart-title">{t('staffDash.recentStudents')}</h3>
              <p className="dashboard-chart-desc">{t('staffDash.latestEnrollments')}</p>
            </div>
            <Link to={`${base}/students`} className="text-sm link">{t('staffDash.viewAll')}</Link>
          </div>
          {students.length === 0 ? (
            <p className="dashboard-chart-empty">{t('staffDash.noStudents')}</p>
          ) : (
            <div className="dashboard-list">
              {students.slice(0, 5).map((student) => (
                <div key={student.id} className="dashboard-list-row">
                  <div className="dashboard-list-avatar">
                    {(student.firstName?.[0] || '') + (student.lastName?.[0] || '')}
                  </div>
                  <div className="dashboard-list-main">
                    <p className="dashboard-list-title">{student.firstName} {student.lastName}</p>
                    <p className="dashboard-list-meta">{student.studentId}</p>
                  </div>
                  <span className="dashboard-list-badge">{student.class?.name || t('ui.unassigned')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-list-card">
          <div className="dashboard-list-header">
            <div>
              <h3 className="dashboard-chart-title">{t('staffDash.recentFees')}</h3>
              <p className="dashboard-chart-desc">{t('staffDash.latestPayments')}</p>
            </div>
            <Link to={`${base}/fees`} className="text-sm link">{t('staffDash.viewAll')}</Link>
          </div>
          {fees.length === 0 ? (
            <p className="dashboard-chart-empty">{t('staffDash.noFees')}</p>
          ) : (
            <div className="dashboard-list">
              {fees.slice(0, 5).map((fee) => (
                <div key={fee.id} className="dashboard-list-row">
                  <div className="dashboard-list-avatar dashboard-list-avatar-fee">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="dashboard-list-main">
                    <p className="dashboard-list-title">{fee.student.firstName} {fee.student.lastName}</p>
                    <p className="dashboard-list-meta">{formatCurrency(fee.amount)}</p>
                  </div>
                  <span className={feeStatusColors[fee.status]}>{fee.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-highlight-card">
          <div className="dashboard-highlight-icon">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="dashboard-highlight-label">{t('staffDash.highlights.marksRecorded')}</p>
            <p className="dashboard-highlight-value">
              {marksStats?.totalMarks || 0}{' '}
              <span className="text-base font-medium text-gray-500">{t('staffDash.highlights.entries')}</span>
            </p>
            <p className="dashboard-highlight-sub">
              {t('staffDash.highlights.marksMeta', {
                assessments: marksStats?.byAssessment?.length || 0,
                classes: marksStats?.byClass?.length || 0,
              })}
            </p>
          </div>
          <Link to={`${base}/marks`} className="dashboard-highlight-stat">
            <TrendingUp className="w-4 h-4" />
            <span>{t('staffDash.highlights.recordMarks')}</span>
          </Link>
        </div>

        <div className="dashboard-highlight-card">
          <div className="dashboard-highlight-icon">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="dashboard-highlight-label">{t('staffDash.highlights.attendanceToday')}</p>
            <p className="dashboard-highlight-value">
              {stats.presentToday}{' '}
              <span className="text-base font-medium text-gray-500">{t('staffDash.highlights.presentLabel')}</span>
            </p>
            <p className="dashboard-highlight-sub">
              {t('staffDash.highlights.attendanceMeta', {
                absent: stats.absentToday,
                late: stats.lateToday,
              })}
            </p>
          </div>
          <div className="dashboard-highlight-stat">
            <TrendingUp className="w-4 h-4" />
            <span>{stats.attendanceRate != null ? `${stats.attendanceRate}%` : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
