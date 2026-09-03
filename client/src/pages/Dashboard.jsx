import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import ManagerDashboard from './ManagerDashboard';
import DashboardOverview from '../components/dashboard/DashboardOverview';
import ParentDashboard from '../components/dashboard/ParentDashboard';
import TeacherDashboard from '../components/dashboard/TeacherDashboard';
import StudentDashboard from '../components/dashboard/StudentDashboard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useParentDashboardData } from '../hooks/useParentDashboardData';
import { useTeacherDashboardData } from '../hooks/useTeacherDashboardData';
import { useStudentDashboardData } from '../hooks/useStudentDashboardData';
import { useAccountantDashboardData } from '../hooks/useAccountantDashboardData';
import AccountantDashboard from '../components/dashboard/AccountantDashboard';
import { useActivitiesManagerDashboardData } from '../hooks/useActivitiesManagerDashboardData';
import ActivitiesManagerDashboard from '../components/dashboard/ActivitiesManagerDashboard';

function DashboardLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
    </div>
  );
}

function StaffDashboard() {
  const { campusId } = useCampus();
  const { data, loading, error } = useDashboardData({ campusId });

  if (loading) return <DashboardLoading />;
  if (error) {
    return <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>;
  }

  return <DashboardOverview campusId={campusId} data={data} />;
}

function ParentDashboardPage() {
  const { user } = useAuth();
  const { campusId } = useCampus();
  const { data, loading, error } = useParentDashboardData();

  if (loading) return <DashboardLoading />;
  if (error) {
    return <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>;
  }

  return (
    <ParentDashboard
      campusId={campusId}
      data={data}
      userName={user?.firstName || 'Parent'}
    />
  );
}

function TeacherDashboardPage() {
  const { user } = useAuth();
  const { campusId } = useCampus();
  const { data, loading, error } = useTeacherDashboardData();

  if (loading) return <DashboardLoading />;
  if (error) {
    return <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>;
  }

  return (
    <TeacherDashboard
      campusId={campusId}
      data={data}
      userName={user?.firstName || 'Teacher'}
    />
  );
}

function StudentDashboardPage() {
  const { user } = useAuth();
  const { campusId } = useCampus();
  const { data, loading, error } = useStudentDashboardData();

  if (loading) return <DashboardLoading />;
  if (error) {
    return <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>;
  }

  return (
    <StudentDashboard
      campusId={campusId}
      data={data}
      userName={user?.firstName || 'Student'}
    />
  );
}

function AccountantDashboardPage() {
  const { user } = useAuth();
  const { campusId } = useCampus();
  const { data, loading, error } = useAccountantDashboardData();

  if (loading) return <DashboardLoading />;
  if (error) {
    return <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>;
  }

  return (
    <AccountantDashboard
      campusId={campusId}
      data={data}
      userName={user?.firstName || 'Accountant'}
    />
  );
}

function ActivitiesManagerDashboardPage() {
  const { user } = useAuth();
  const { campusId } = useCampus();
  const { data, loading, error } = useActivitiesManagerDashboardData();

  if (loading) return <DashboardLoading />;
  if (error) {
    return <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>;
  }

  return (
    <ActivitiesManagerDashboard
      campusId={campusId}
      data={data}
      userName={user?.firstName || 'Manager'}
    />
  );
}

export default function Dashboard() {
  const { isManager, user } = useAuth();
  if (isManager) return <ManagerDashboard />;
  if (user?.role === 'PARENT') return <ParentDashboardPage />;
  if (user?.role === 'TEACHER') return <TeacherDashboardPage />;
  if (user?.role === 'STUDENT') return <StudentDashboardPage />;
  if (user?.role === 'ACCOUNTANT') return <AccountantDashboardPage />;
  if (user?.role === 'ACTIVITIES_MANAGER') return <ActivitiesManagerDashboardPage />;
  return <StaffDashboard />;
}
