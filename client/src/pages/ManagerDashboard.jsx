import { Link } from 'react-router-dom';
import {
  UserPlus, Shield, Calendar, School, ArrowRight, CheckCircle2, Circle,
  GraduationCap, BookOpen, CalendarDays,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import DashboardOverview from '../components/dashboard/DashboardOverview';
import DashboardPanel from '../components/dashboard/DashboardPanel';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTranslation } from '../context/LanguageContext';

function QuickAction({ to, icon: Icon, label, description }) {
  return (
    <Link to={to} className="dash-quick-action">
      <div className="dash-quick-action-icon">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="dash-quick-action-title">{label}</p>
        <p className="dash-quick-action-desc">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
    </Link>
  );
}

function DashboardLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
    </div>
  );
}

export default function ManagerDashboard() {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const { campus, campusId, academicYear } = useCampus();
  const base = `/campus/${campusId}`;
  const { data, loading, error } = useDashboardData({ campusId, includeUsers: true });

  const setupSteps = data ? [
    { label: t('staffDash.manager.setupAcademicYear'), done: !!academicYear, to: `${base}/academic-years` },
    { label: t('staffDash.manager.setupTeachers'), done: data.teachers.length > 0, to: `${base}/teachers` },
    { label: t('staffDash.manager.setupClasses'), done: data.classes.length > 0, to: `${base}/classes` },
    { label: t('staffDash.manager.setupStudents'), done: data.students.length > 0, to: `${base}/students` },
    { label: t('staffDash.manager.setupUsers'), done: data.users.length > 0, to: `${base}/users` },
  ] : [];
  const setupComplete = setupSteps.every((s) => s.done);

  const todayLabel = new Date().toLocaleDateString(
    language === 'en' ? undefined : language,
    { weekday: 'long', month: 'long', day: 'numeric' },
  );

  if (loading) return <DashboardLoading />;
  if (error) {
    return <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>;
  }

  return (
    <div className="dash-manager">
      {!setupComplete && (
        <DashboardPanel
          className="dash-setup mb-6"
          title={t('staffDash.manager.campusSetup')}
          description={t('staffDash.manager.campusSetupDesc', { campus: campus.name })}
        >
          <div className="dash-setup-grid">
            {setupSteps.map((step) => (
              <Link
                key={step.label}
                to={step.to}
                className={`dash-setup-step ${step.done ? 'is-done' : ''}`}
              >
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                )}
                <span>{step.label}</span>
              </Link>
            ))}
          </div>
        </DashboardPanel>
      )}

      <DashboardPanel
        className="dash-manager-actions mb-6"
        title={t('staffDash.manager.quickActions')}
        description={t('staffDash.manager.managingCampus', { campus: campus.name })}
      >
        <div className="dash-quick-actions">
          <QuickAction to={`${base}/students`} icon={UserPlus} label={t('staffDash.manager.addStudent')} description={t('staffDash.manager.addStudentDesc')} />
          <QuickAction to={`${base}/teachers`} icon={GraduationCap} label={t('staffDash.manager.addTeacher')} description={t('staffDash.manager.addTeacherDesc')} />
          <QuickAction to={`${base}/classes`} icon={BookOpen} label={t('staffDash.manager.manageClasses')} description={t('staffDash.manager.manageClassesDesc')} />
          <QuickAction to={`${base}/users`} icon={Shield} label={t('staffDash.manager.userAccounts')} description={t('staffDash.manager.userAccountsDesc')} />
          <QuickAction to={`${base}/academic-years`} icon={Calendar} label={t('staffDash.manager.academicYear')} description={t('staffDash.manager.academicYearDesc')} />
          <QuickAction to={`${base}/school`} icon={School} label={t('staffDash.manager.schoolProfile')} description={t('staffDash.manager.schoolProfileDesc')} />
        </div>
      </DashboardPanel>

      <DashboardOverview
        campusId={campusId}
        data={data}
        shellProps={{
          kicker: t('staffDash.manager.roleEyebrow'),
          title: t('staffDash.manager.welcomeBack', { name: user.firstName }),
          description: [
            t('staffDash.manager.managingCampus', { campus: campus.name }),
            academicYear ? `${t('staffDash.manager.academicYearLabel')} ${academicYear.name}` : null,
          ].filter(Boolean).join(' · '),
          actions: (
            <>
              <span className="dash-date-chip">
                <CalendarDays className="w-3.5 h-3.5" aria-hidden />
                {todayLabel}
              </span>
              <Link to="/campuses" className="dash-ghost-btn">
                {t('staffDash.manager.allCampuses')}
              </Link>
            </>
          ),
        }}
      />
    </div>
  );
}
