import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import ChartCard from './ChartCard';
import { useTranslation } from '../../context/LanguageContext';

const ATTENDANCE_COLORS = {
  present: '#65a30d',
  absent: '#ef4444',
  late: '#f59e0b',
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dashboard-chart-tooltip">
      {label && <p className="dashboard-chart-tooltip-label">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} className="dashboard-chart-tooltip-row">
          <span className="dashboard-chart-tooltip-dot" style={{ background: entry.color || entry.fill }} />
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

export function AttendanceDonutChart({ stats }) {
  const { t } = useTranslation();
  const keys = ['present', 'absent', 'late'];
  const data = keys.map((key) => ({
    key,
    name: t(`staffDash.attendance.${key}`),
    value: stats[`${key}Today`] || 0,
  })).filter((item) => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartCard
      title={t('staffDash.charts.attendanceToday.title')}
      description={t('staffDash.charts.attendanceToday.description')}
    >
      {total === 0 ? (
        <div className="dashboard-chart-empty">{t('staffDash.charts.attendanceToday.empty')}</div>
      ) : (
        <div className="dashboard-donut-wrap">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={3}
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.key} fill={ATTENDANCE_COLORS[entry.key]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="dashboard-donut-center">
            <p className="dashboard-donut-rate">{stats.attendanceRate != null ? `${stats.attendanceRate}%` : '—'}</p>
            <p className="dashboard-donut-caption">{t('staffDash.charts.attendanceToday.presentRate')}</p>
          </div>
          <div className="dashboard-legend">
            {data.map((item) => (
              <div key={item.key} className="dashboard-legend-item">
                <span className="dashboard-legend-dot" style={{ background: ATTENDANCE_COLORS[item.key] }} />
                <span>{item.name}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export function AttendanceTrendChart({ weeklyTrend = [] }) {
  const { t } = useTranslation();
  const presentLabel = t('staffDash.attendance.present');
  const absentLabel = t('staffDash.attendance.absent');
  const lateLabel = t('staffDash.attendance.late');

  return (
    <ChartCard
      title={t('staffDash.charts.attendanceTrend.title')}
      description={t('staffDash.charts.attendanceTrend.description')}
    >
      {weeklyTrend.length === 0 ? (
        <div className="dashboard-chart-empty">{t('staffDash.charts.attendanceTrend.empty')}</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={weeklyTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#84cc16" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#84cc16" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="present" name={presentLabel} stroke="#65a30d" fill="url(#presentFill)" strokeWidth={2.5} />
            <Area type="monotone" dataKey="absent" name={absentLabel} stroke="#ef4444" fill="transparent" strokeWidth={2} />
            <Area type="monotone" dataKey="late" name={lateLabel} stroke="#f59e0b" fill="transparent" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function FeeStatusChart({ stats }) {
  const { t } = useTranslation();
  const data = [
    { name: t('staffDash.feeStatus.paid'), value: stats.paid || 0, color: '#65a30d' },
    { name: t('staffDash.feeStatus.pending'), value: stats.pending || 0, color: '#f59e0b' },
    { name: t('staffDash.feeStatus.overdue'), value: stats.overdue || 0, color: '#ef4444' },
  ];

  return (
    <ChartCard
      title={t('staffDash.charts.feeStatus.title')}
      description={t('staffDash.charts.feeStatus.description')}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barSize={42} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="value" name={t('staffDash.charts.records')} radius={[8, 8, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function StudentsByClassChart({ data }) {
  const { t } = useTranslation();

  return (
    <ChartCard
      title={t('staffDash.charts.studentsByClass.title')}
      description={t('staffDash.charts.studentsByClass.description')}
    >
      {data.length === 0 ? (
        <div className="dashboard-chart-empty">{t('staffDash.charts.studentsByClass.empty')}</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" name={t('staffDash.charts.students')} fill="#65a30d" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

const REGISTRATION_STATUS_KEYS = {
  Approved: 'registrationApproved',
  Pending: 'registrationPending',
  Rejected: 'registrationRejected',
};

export function RegistrationChart({ data }) {
  const { t } = useTranslation();
  const translatedData = data.map((entry) => ({
    ...entry,
    name: REGISTRATION_STATUS_KEYS[entry.name]
      ? t(`staffDash.charts.${REGISTRATION_STATUS_KEYS[entry.name]}`)
      : entry.name,
  }));

  return (
    <ChartCard
      title={t('staffDash.charts.registration.title')}
      description={t('staffDash.charts.registration.description')}
    >
      {data.length === 0 ? (
        <div className="dashboard-chart-empty">{t('staffDash.charts.registration.empty')}</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={translatedData} dataKey="value" nameKey="name" outerRadius={86} paddingAngle={2} stroke="none">
              {translatedData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

const MARKS_ASSESSMENT_COLORS = {
  TEST1: '#65a30d',
  TEST2: '#84cc16',
  EX: '#4d7c0f',
  SCORE: '#0ea5e9',
  Final: '#8b5cf6',
  CAT: '#f59e0b',
};

function marksBarColor(name) {
  const key = Object.keys(MARKS_ASSESSMENT_COLORS).find((k) => name.startsWith(k));
  return MARKS_ASSESSMENT_COLORS[key] || '#64748b';
}

export function MarksRecordingChart({ marksStats }) {
  const { t } = useTranslation();
  const byAssessment = marksStats?.byAssessment || [];
  const byTerm = marksStats?.byTerm || [];
  const hasData = byAssessment.length > 0 || byTerm.length > 0;
  const marksLabel = t('staffDash.charts.marks');

  return (
    <ChartCard
      title={t('staffDash.charts.marksRecording.title')}
      description={t('staffDash.charts.marksRecording.description', { count: marksStats?.totalMarks || 0 })}
    >
      {!hasData ? (
        <div className="dashboard-chart-empty">{t('staffDash.charts.marksRecording.empty')}</div>
      ) : (
        <div className="space-y-6">
          {byAssessment.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                {t('staffDash.charts.marksRecording.byAssessment')}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byAssessment} barSize={36} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name={marksLabel} radius={[8, 8, 0, 0]}>
                    {byAssessment.map((entry) => (
                      <Cell key={entry.name} fill={marksBarColor(entry.name)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {byTerm.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                {t('staffDash.charts.marksRecording.byTrimestre')}
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byTerm} barSize={42} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name={marksLabel} fill="#65a30d" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}

export function MarksByClassChart({ data }) {
  const { t } = useTranslation();

  return (
    <ChartCard
      title={t('staffDash.charts.marksByClass.title')}
      description={t('staffDash.charts.marksByClass.description')}
    >
      {data.length === 0 ? (
        <div className="dashboard-chart-empty">{t('staffDash.charts.marksByClass.empty')}</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" name={t('staffDash.charts.marks')} fill="#4d7c0f" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function MarksRecordingTrendChart({ weeklyRecording = [] }) {
  const { t } = useTranslation();

  return (
    <ChartCard
      title={t('staffDash.charts.marksActivity.title')}
      description={t('staffDash.charts.marksActivity.description')}
    >
      {weeklyRecording.every((day) => day.count === 0) ? (
        <div className="dashboard-chart-empty">{t('staffDash.charts.marksActivity.empty')}</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeklyRecording} barSize={28} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" name={t('staffDash.charts.marksSaved')} fill="#84cc16" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
