import { Link } from 'react-router-dom';
import {
  UserPlus, Shield, Calendar, School, ArrowRight, CheckCircle2, Circle,
  GraduationCap, BookOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import DashboardOverview from '../components/dashboard/DashboardOverview';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTranslation } from '../context/LanguageContext';

function QuickAction({ to, icon: Icon, label, description }) {
  return (
    <Link to={to} className="quick-action">
      <div className="quick-action-icon">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
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
  const { t } = useTranslation();
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

  if (loading) return <DashboardLoading />;
  if (error) {
    return <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>;
  }

  return (
    <div>
      <div className="dashboard-hero mb-8">
        <div>
          <p className="dashboard-hero-eyebrow">{t('staffDash.manager.roleEyebrow')}</p>
          <h1 className="dashboard-hero-title">{t('staffDash.manager.welcomeBack', { name: user.firstName })}</h1>
          <p className="dashboard-hero-sub">
            {t('staffDash.manager.managingCampus', { campus: campus.name })}
            {academicYear && (
              <> · {t('staffDash.manager.academicYearLabel')}{' '}<span className="font-medium text-gray-800">{academicYear.name}</span></>
            )}
          </p>
        </div>
        <Link to="/campuses" className="btn-secondary text-sm shrink-0">
          {t('staffDash.manager.allCampuses')}
        </Link>
      </div>

      {!setupComplete && (
        <div className="card mb-8 border-brand-200 bg-gradient-to-r from-brand-50/80 to-white">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('staffDash.manager.campusSetup')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('staffDash.manager.campusSetupDesc', { campus: campus.name })}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {setupSteps.map((step) => (
              <Link
                key={step.label}
                to={step.to}
                className={`setup-step ${step.done ? 'setup-step-done' : ''}`}
              >
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                )}
                <span className="text-sm">{step.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="section-title mb-4">{t('staffDash.manager.quickActions')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <QuickAction to={`${base}/students`} icon={UserPlus} label={t('staffDash.manager.addStudent')} description={t('staffDash.manager.addStudentDesc')} />
          <QuickAction to={`${base}/teachers`} icon={GraduationCap} label={t('staffDash.manager.addTeacher')} description={t('staffDash.manager.addTeacherDesc')} />
          <QuickAction to={`${base}/classes`} icon={BookOpen} label={t('staffDash.manager.manageClasses')} description={t('staffDash.manager.manageClassesDesc')} />
          <QuickAction to={`${base}/users`} icon={Shield} label={t('staffDash.manager.userAccounts')} description={t('staffDash.manager.userAccountsDesc')} />
          <QuickAction to={`${base}/academic-years`} icon={Calendar} label={t('staffDash.manager.academicYear')} description={t('staffDash.manager.academicYearDesc')} />
          <QuickAction to={`${base}/school`} icon={School} label={t('staffDash.manager.schoolProfile')} description={t('staffDash.manager.schoolProfileDesc')} />
        </div>
      </div>

      <DashboardOverview campusId={campusId} data={data} />
    </div>
  );
}
