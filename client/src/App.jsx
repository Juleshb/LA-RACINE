import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ProtectedRoute, PublicRoute, RequirePermission } from './components/ProtectedRoute';
import { CampusProvider } from './context/CampusContext';
import HomeRedirect from './components/HomeRedirect';
import { PERMISSIONS } from './config/permissions';
import Login from './pages/Login';
import Campuses from './pages/Campuses';
import Dashboard from './pages/Dashboard';
import SchoolProfile from './pages/SchoolProfile';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Classes from './pages/Classes';
import Courses from './pages/Courses';
import Marks from './pages/Marks';
import Midterms from './pages/Midterms';
import BulletinReport from './pages/BulletinReport';
import Attendance from './pages/Attendance';
import Fees from './pages/Fees';
import CreateFee from './pages/CreateFee';
import FeeReceipt from './pages/FeeReceipt';
import AcademicYears from './pages/AcademicYears';
import Users from './pages/Users';
import Library from './pages/Library';
import ELibrary from './pages/ELibrary';
import ELibraryBook from './pages/ELibraryBook';
import ELearning from './pages/ELearning';
import ELearningCourse from './pages/ELearningCourse';
import Timetable from './pages/Timetable';
import Homework from './pages/Homework';
import HomeworkDetail from './pages/HomeworkDetail';
import OnlineClasses from './pages/OnlineClasses';
import Extracurricular from './pages/Extracurricular';
import Transport from './pages/Transport';
import Communication from './pages/Communication';
import ParentMyRegistrations from './pages/ParentMyRegistrations';
import ParentRegistrationDetail from './pages/ParentRegistrationDetail';
import ParentChildAccounts from './pages/ParentChildAccounts';
import ResetPassword from './pages/ResetPassword';
import SetNewPassword from './pages/SetNewPassword';
import StudentRegistration from './pages/StudentRegistration';
import StudentDetail from './pages/StudentDetail';
import StudentAiTutor from './pages/StudentAiTutor';
import IdCards from './pages/IdCards';
import VerifyBulletin from './pages/VerifyBulletin';
import Profile from './pages/Profile';
import ProfileShell from './components/ProfileShell';
import Reports from './pages/Reports';
import WebsiteCms from './pages/WebsiteCms';
import PublicLayout from './pages/public/PublicLayout';
import PublicHome from './pages/public/PublicHome';
import PublicAbout from './pages/public/PublicAbout';
import PublicAcademics from './pages/public/PublicAcademics';
import PublicProgramDetail from './pages/public/PublicProgramDetail';
import PublicCalendar from './pages/public/PublicCalendar';
import PublicCampuses from './pages/public/PublicCampuses';
import PublicNews from './pages/public/PublicNews';
import PublicNewsArticle from './pages/public/PublicNewsArticle';
import PublicEvents from './pages/public/PublicEvents';
import PublicGallery from './pages/public/PublicGallery';
import PublicAnnouncements from './pages/public/PublicAnnouncements';
import PublicAdmissions from './pages/public/PublicAdmissions';
import PublicOnlineRegistration from './pages/public/PublicOnlineRegistration';
import PublicContact from './pages/public/PublicContact';

export default function App() {
  return (
    <Routes>
      <Route path="/verify/bulletin/:token" element={<VerifyBulletin />} />

      <Route element={<PublicLayout />}>
        <Route index element={<PublicHome />} />
        <Route path="about" element={<PublicAbout />} />
        <Route path="academics" element={<PublicAcademics />} />
        <Route path="academics/:programSlug" element={<PublicProgramDetail />} />
        <Route path="calendar" element={<PublicCalendar />} />
        <Route path="locations" element={<PublicCampuses />} />
        <Route path="news" element={<PublicNews />} />
        <Route path="news/:articleIndex" element={<PublicNewsArticle />} />
        <Route path="announcements" element={<PublicAnnouncements />} />
        <Route path="announcements/:announcementIndex" element={<PublicAnnouncements />} />
        <Route path="events" element={<PublicEvents />} />
        <Route path="gallery" element={<PublicGallery />} />
        <Route path="admissions" element={<PublicAdmissions />} />
        <Route path="admissions/apply" element={<PublicOnlineRegistration />} />
        <Route path="contact" element={<PublicContact />} />
      </Route>

      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/set-new-password" element={<SetNewPassword />} />
        <Route path="app" element={<HomeRedirect />} />
        <Route path="profile" element={<ProfileShell />} />
        <Route path="campuses" element={<Campuses />} />

        <Route path="campus/:campusId" element={<CampusProvider />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="reports" element={<RequirePermission permission={PERMISSIONS.REPORTS}><Reports /></RequirePermission>} />
            <Route path="website" element={<RequirePermission permission={PERMISSIONS.WEBSITE}><WebsiteCms /></RequirePermission>} />
            <Route path="school" element={<RequirePermission permission={PERMISSIONS.SCHOOL}><SchoolProfile /></RequirePermission>} />
            <Route path="students" element={<RequirePermission permission={PERMISSIONS.STUDENTS}><Students /></RequirePermission>} />
            <Route path="students/register" element={<RequirePermission permission={PERMISSIONS.STUDENTS}><StudentRegistration /></RequirePermission>} />
            <Route path="students/:id" element={<RequirePermission permission={PERMISSIONS.STUDENTS}><StudentDetail /></RequirePermission>} />
            <Route path="id-cards" element={<RequirePermission permission={PERMISSIONS.STUDENTS}><IdCards /></RequirePermission>} />
            <Route path="teachers" element={<RequirePermission permission={PERMISSIONS.TEACHERS}><Teachers /></RequirePermission>} />
            <Route path="classes" element={<RequirePermission permission={PERMISSIONS.CLASSES}><Classes /></RequirePermission>} />
            <Route path="courses" element={<RequirePermission permission={PERMISSIONS.COURSES}><Courses /></RequirePermission>} />
            <Route path="marks" element={<RequirePermission permission={PERMISSIONS.MARKS}><Marks /></RequirePermission>} />
            <Route path="midterms" element={<RequirePermission permission={PERMISSIONS.MARKS}><Midterms /></RequirePermission>} />
            <Route path="bulletin-report" element={<RequirePermission permission={PERMISSIONS.MARKS} denyRoles={['TEACHER']}><BulletinReport /></RequirePermission>} />
            <Route path="attendance" element={<RequirePermission permission={PERMISSIONS.ATTENDANCE}><Attendance /></RequirePermission>} />
            <Route path="fees" element={<RequirePermission permission={PERMISSIONS.FEES}><Fees /></RequirePermission>} />
            <Route path="fees/new" element={<RequirePermission permission={PERMISSIONS.FEES}><CreateFee /></RequirePermission>} />
            <Route path="fees/:id" element={<RequirePermission permission={PERMISSIONS.FEES}><FeeReceipt /></RequirePermission>} />
            <Route path="library" element={<RequirePermission permission={PERMISSIONS.LIBRARY}><Library /></RequirePermission>} />
            <Route path="e-library" element={<RequirePermission permission={PERMISSIONS.E_LIBRARY}><ELibrary /></RequirePermission>} />
            <Route path="e-library/:bookId" element={<RequirePermission permission={PERMISSIONS.E_LIBRARY}><ELibraryBook /></RequirePermission>} />
            <Route path="e-learning" element={<RequirePermission permission={PERMISSIONS.E_LEARNING}><ELearning /></RequirePermission>} />
            <Route path="e-learning/:courseId" element={<RequirePermission permission={PERMISSIONS.E_LEARNING}><ELearningCourse /></RequirePermission>} />
            <Route path="ai-tutor" element={<RequirePermission permission={PERMISSIONS.AI_TUTOR}><StudentAiTutor /></RequirePermission>} />
            <Route path="timetable" element={<RequirePermission permission={PERMISSIONS.TIMETABLE}><Timetable /></RequirePermission>} />
            <Route path="homework" element={<RequirePermission permission={PERMISSIONS.HOMEWORK}><Homework /></RequirePermission>} />
            <Route path="homework/:homeworkId" element={<RequirePermission permission={PERMISSIONS.HOMEWORK}><HomeworkDetail /></RequirePermission>} />
            <Route path="online-classes" element={<RequirePermission permission={PERMISSIONS.ONLINE_CLASSES}><OnlineClasses /></RequirePermission>} />
            <Route path="extracurricular" element={<RequirePermission permission={PERMISSIONS.EXTRACURRICULAR}><Extracurricular /></RequirePermission>} />
            <Route path="transport" element={<RequirePermission permission={PERMISSIONS.TRANSPORT}><Transport /></RequirePermission>} />
            <Route path="communication" element={<RequirePermission permission={PERMISSIONS.COMMUNICATION}><Communication /></RequirePermission>} />
            <Route path="register-child" element={<RequirePermission permission={PERMISSIONS.REGISTRATION}><StudentRegistration isParent /></RequirePermission>} />
            <Route path="child-accounts" element={<RequirePermission permission={PERMISSIONS.REGISTRATION}><ParentChildAccounts /></RequirePermission>} />
            <Route path="my-registrations" element={<RequirePermission permission={PERMISSIONS.REGISTRATION}><ParentMyRegistrations /></RequirePermission>} />
            <Route path="my-registrations/:id" element={<RequirePermission permission={PERMISSIONS.REGISTRATION}><ParentRegistrationDetail /></RequirePermission>} />
            <Route path="academic-years" element={<RequirePermission permission={PERMISSIONS.ACADEMIC_YEAR}><AcademicYears /></RequirePermission>} />
            <Route path="users" element={<RequirePermission permission={PERMISSIONS.USERS}><Users /></RequirePermission>} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
