import { Link } from 'react-router-dom';
import {
  Users, MessageSquare, ClipboardCheck, Clock, FileText, BookOpen,
  Award, BookMarked, ChevronRight, AlertCircle, Bus, Sparkles,
} from 'lucide-react';
import PageHeader from '../PageHeader';
import ModernStatCard from './ModernStatCard';
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

function formatTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

export default function TeacherDashboard({ campusId, data, userName }) {
  const { t } = useTranslation();
  const base = `/campus/${campusId}`;
  const {
    classes,
    courseCount,
    studentCount,
    todaySchedule,
    unreadCount,
    recentMessages,
    upcomingHomework,
    attendanceToday,
  } = data;

  const homeroomCount = classes.filter((c) => c.isHomeroom).length;

  return (
    <div className="teacher-dashboard">
      <PageHeader
        title={t('staffDash.welcome', { name: userName })}
        description={t('staffDash.teacher.description')}
      />

      {classes.length === 0 && (
        <div className="card mb-6 flex items-start gap-3 border-amber-200 bg-amber-50/80">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">{t('staffDash.teacher.noClassesTitle')}</p>
            <p className="text-sm text-amber-800 mt-1">{t('staffDash.teacher.noClassesBody')}</p>
          </div>
        </div>
      )}

      <div className="dashboard-kpi-grid">
        <ModernStatCard
          icon={BookOpen}
          label={t('staffDash.teacher.myClasses')}
          value={classes.length}
          sub={homeroomCount ? t('staffDash.teacher.homeroomCount', { count: homeroomCount }) : t('staffDash.teacher.subjectClasses')}
          accent="green"
        />
        <ModernStatCard
          icon={Users}
          label={t('staffDash.teacher.students')}
          value={studentCount}
          sub={t('staffDash.teacher.acrossClasses')}
          accent="blue"
        />
        <ModernStatCard
          icon={BookMarked}
          label={t('staffDash.teacher.courses')}
          value={courseCount}
          sub={t('staffDash.teacher.subjectsYouTeach')}
          accent="purple"
        />
        <ModernStatCard
          icon={MessageSquare}
          label={t('staffDash.teacher.unreadMessages')}
          value={unreadCount}
          sub={t('staffDash.teacher.announcementsParentReplies')}
          accent="gold"
        />
      </div>

      <div className="parent-dashboard-grid">
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{t('staffDash.teacher.todaySchedule')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('staffDash.teacher.lessonsInClasses')}</p>
            </div>
            <Link to={`${base}/timetable`} className="text-xs link">{t('staffDash.teacher.fullTimetable')}</Link>
          </div>
          {todaySchedule.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">{t('staffDash.teacher.noLessonsToday')}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {todaySchedule.map((slot) => (
                <div key={slot.id} className="p-4 flex items-start gap-3">
                  <div className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-1 rounded-lg tabular-nums shrink-0">
                    {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900">
                      {slot.subject?.name || t('staffDash.teacher.lesson')}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {slot.class?.name}
                      {slot.room ? ` · ${t('staffDash.teacher.room', { room: slot.room })}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{t('staffDash.teacher.attendanceToday')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('staffDash.teacher.markedOfTotal', { marked: attendanceToday.marked, total: attendanceToday.total })}
              </p>
            </div>
            <Link to={`${base}/attendance`} className="text-xs link">{t('staffDash.teacher.markAttendance')}</Link>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-50 p-3 text-center">
              <p className="text-lg font-bold text-green-800">{attendanceToday.present}</p>
              <p className="text-xs text-green-700">{t('staffDash.attendance.present')}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3 text-center">
              <p className="text-lg font-bold text-red-800">{attendanceToday.absent}</p>
              <p className="text-xs text-red-700">{t('staffDash.attendance.absent')}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-center">
              <p className="text-lg font-bold text-amber-800">{attendanceToday.late}</p>
              <p className="text-xs text-amber-700">{t('staffDash.attendance.late')}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-center">
              <p className="text-lg font-bold text-blue-800">{attendanceToday.excused}</p>
              <p className="text-xs text-blue-700">{t('staffDash.attendance.excused')}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 mb-3">{t('staffDash.teacher.quickAccess')}</h3>
          <div className="space-y-1">
            <QuickLink to={`${base}/communication`} icon={MessageSquare} label={t('staffDash.teacher.messages')} badge={unreadCount} />
            <QuickLink to={`${base}/attendance`} icon={ClipboardCheck} label={t('staffDash.teacher.markAttendance')} />
            <QuickLink to={`${base}/marks`} icon={Award} label={t('staffDash.teacher.enterMarks')} />
            <QuickLink to={`${base}/homework`} icon={FileText} label={t('pages.homework.title')} badge={upcomingHomework.length} />
            <QuickLink to={`${base}/timetable`} icon={Clock} label={t('staffDash.teacher.myTimetable')} />
            <QuickLink to={`${base}/students`} icon={Users} label={t('staffDash.teacher.myStudents')} />
            <QuickLink to={`${base}/bulletin-report`} icon={FileText} label={t('staffDash.teacher.bulletinReports')} />
            <QuickLink to={`${base}/extracurricular`} icon={Sparkles} label={t('pages.activities.titleShort')} />
            <QuickLink to={`${base}/transport`} icon={Bus} label={t('staffDash.teacher.transport')} />
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{t('staffDash.teacher.myClassesSection')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('staffDash.teacher.homeroomAndSubject')}</p>
            </div>
            <Link to={`${base}/classes`} className="text-xs link">{t('staffDash.viewAll')}</Link>
          </div>
          {classes.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">{t('staffDash.teacher.noClassesAssigned')}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {classes.slice(0, 5).map((cls) => (
                <div key={cls.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{cls.name}</p>
                    <p className="text-xs text-gray-500">
                      {cls.studentCount === 1
                        ? t('staffDash.teacher.oneStudent')
                        : t('staffDash.teacher.nStudents', { count: cls.studentCount })}
                      {cls.isHomeroom ? ` · ${t('staffDash.teacher.homeroom')}` : ` · ${t('staffDash.teacher.subjectClass')}`}
                    </p>
                  </div>
                  <Link to={`${base}/attendance`} className="text-xs link shrink-0">{t('staffDash.teacher.attendanceLink')}</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {recentMessages.length > 0 && (
          <div className="card p-0 overflow-hidden md:col-span-2">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{t('staffDash.teacher.recentMessages')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('staffDash.teacher.schoolAnnouncementsParents')}</p>
              </div>
              <Link to={`${base}/communication`} className="text-xs link">{t('staffDash.teacher.openInbox')}</Link>
            </div>
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
          </div>
        )}
      </div>
    </div>
  );
}
