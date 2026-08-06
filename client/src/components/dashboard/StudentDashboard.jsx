import { Link } from 'react-router-dom';
import { BookOpen, Star } from 'lucide-react';
import { STUDENT_NAV_ITEMS } from '../../config/permissions';
import { translateStudentNavItem, useTranslation } from '../../context/LanguageContext';
import { useStudentPhotoUrl } from '../../hooks/useStudentPhotoUrl';
import HomeworkGradesSummary from '../homework/HomeworkGradesSummary';
import AppIcon from '../icons/AppIcon';
import StudentAvatar from '../student/StudentAvatar';

const TILE_COLORS = {
  LayoutDashboard: 'student-tile-sky',
  BookOpen: 'student-tile-rose',
  Library: 'student-tile-indigo',
  GraduationCap: 'student-tile-violet',
  Video: 'student-tile-cyan',
  Bot: 'student-tile-teal',
};

const TILE_ICONS = {
  LayoutDashboard: 'home',
  BookOpen: 'homework',
  Library: 'library',
  GraduationCap: 'learning',
  Video: 'video',
  Bot: 'ai',
};

export default function StudentDashboard({ campusId, data, userName }) {
  const { t, language } = useTranslation();
  const photoUrl = useStudentPhotoUrl(true);
  const base = `/campus/${campusId}`;
  const {
    student,
    upcomingHomework,
    homeworkGrades,
    eLibraryItems,
    eLearningCourses,
    onlineClasses = [],
  } = data;

  const liveOrSoon = onlineClasses.filter((s) => s.status === 'live' || s.status === 'starting_soon');
  const upcomingLive = onlineClasses.filter((s) => s.status === 'upcoming' || s.status === 'starting_soon' || s.status === 'live');
  const primaryLive = liveOrSoon[0] || null;
  const firstName = student?.firstName || userName || 'friend';

  const formatSessionWhen = (date) => {
    const d = new Date(date);
    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return t('dashboard.todayAt', { time });
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return t('dashboard.tomorrowAt', { time });
    return d.toLocaleString(language === 'en' ? undefined : language, {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  const formatDueDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(d);
    due.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / (24 * 60 * 60 * 1000));
    if (diff === 0) return t('dashboard.dueToday');
    if (diff === 1) return t('dashboard.dueTomorrow');
    if (diff < 0) return t('dashboard.overdue');
    return t('dashboard.dueInDays', { count: diff });
  };

  const statusLabel = (session) => {
    if (session.status === 'live') return t('common.liveNow');
    if (session.status === 'starting_soon') return t('common.startingSoon');
    return t('common.upcoming');
  };

  const tiles = STUDENT_NAV_ITEMS.filter((item) => item.to !== '').map((item) => {
    const translated = translateStudentNavItem(item, t);
    return {
      ...translated,
      to: `${base}${item.to ? `/${item.to}` : ''}`,
      badge: item.to === 'homework' ? upcomingHomework.length : item.to === 'online-classes' ? liveOrSoon.length : 0,
      color: TILE_COLORS[item.icon] || 'student-tile-sky',
      appIcon: TILE_ICONS[item.icon] || 'home',
    };
  });

  return (
    <div className="student-dashboard dash-page">
      <div className="dash-mesh" aria-hidden>
        <span className="dash-mesh-glow dash-mesh-a" />
        <span className="dash-mesh-glow dash-mesh-b" />
        <span className="dash-mesh-grid" />
      </div>

      <section className="student-hero">
        <div className="student-hero-content">
          <p className="student-hero-wave inline-flex items-center gap-2">
            {t('dashboard.hi', { name: firstName })}
            <AppIcon name="wave" className="w-6 h-6" />
          </p>
          <h1 className="student-hero-title">{t('dashboard.yourLearningSpace')}</h1>
          {student?.class?.name && (
            <p className="student-hero-class">{student.class.name}</p>
          )}
        </div>
        <StudentAvatar
          photoUrl={photoUrl}
          firstName={student?.firstName || firstName}
          lastName={student?.lastName}
          variant="dashboardHero"
        />
      </section>

      {!student && (
        <div className="student-alert">
          <p>{t('common.askTeacher')}</p>
        </div>
      )}

      {primaryLive && (
        <Link to={`${base}/online-classes?join=${primaryLive.id}`} className="student-live-hero-btn">
          <span className="student-live-badge student-live-badge-now">{t('common.live')}</span>
          <span className="flex-1 min-w-0">
            <strong className="block truncate">{primaryLive.title}</strong>
            <span className="text-sm opacity-90">
              {t('dashboard.tapToJoin', { status: statusLabel(primaryLive) })}
            </span>
          </span>
          <AppIcon name="video" className="w-8 h-8 shrink-0" />
        </Link>
      )}

      <section className="student-section">
        <h2 className="student-section-title">{t('common.tapToOpen')}</h2>
        <div className="student-home-grid">
          {tiles.map((tile) => (
            <Link key={tile.to} to={tile.to} className={`student-home-tile ${tile.color}`}>
              <span className="student-home-tile-icon" aria-hidden>
                <AppIcon name={tile.appIcon} className="w-10 h-10" />
              </span>
              <span className="student-home-tile-label">{tile.shortLabel || tile.label}</span>
              {tile.badge > 0 && (
                <span className="student-home-tile-badge">{tile.badge > 9 ? '9+' : tile.badge}</span>
              )}
            </Link>
          ))}
        </div>
      </section>

      <div className="student-cards-grid">
        {homeworkGrades?.completed > 0 && (
          <section className="student-card student-card-grades md:col-span-2">
            <div className="student-card-head">
              <Star className="w-5 h-5 text-amber-500" />
              <h3>{t('dashboard.myHomeworkScores')}</h3>
              <Link to={`${base}/homework`} className="student-card-link">{t('common.seeAll')}</Link>
            </div>
            <HomeworkGradesSummary summary={homeworkGrades} campusId={campusId} compact />
          </section>
        )}

        <section className="student-card student-card-homework">
          <div className="student-card-head">
            <BookOpen className="w-5 h-5" />
            <h3>{t('dashboard.homework')}</h3>
            <Link to={`${base}/homework`} className="student-card-link">{t('common.seeAll')}</Link>
          </div>
          {upcomingHomework.length === 0 ? (
            <p className="student-card-empty inline-flex items-center gap-2">
              {t('common.noHomework')}
              <AppIcon name="star" className="w-5 h-5 text-amber-500" />
            </p>
          ) : (
            <ul className="student-homework-list">
              {upcomingHomework.slice(0, 4).map((item) => (
                <li key={item.id} className="student-homework-item">
                  <span className="student-homework-icon" aria-hidden>
                    <AppIcon name="homework" className="w-7 h-7" />
                  </span>
                  <div>
                    <p className="student-homework-title">{item.title}</p>
                    <p className="student-homework-meta inline-flex items-center gap-1.5">
                      {item.mySubmission ? (
                        <>
                          {t('dashboard.score', { score: item.mySubmission.score, max: item.mySubmission.maxScore })}
                          <AppIcon name="star" className="w-4 h-4 text-amber-500" />
                        </>
                      ) : (
                        formatDueDate(item.dueDate)
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="student-card student-card-live">
          <div className="student-card-head">
            <AppIcon name="video" className="w-5 h-5" />
            <h3>{t('dashboard.liveClasses')}</h3>
            <Link to={`${base}/online-classes`} className="student-card-link">{t('common.seeAll')}</Link>
          </div>
          {upcomingLive.length === 0 ? (
            <p className="student-card-empty">{t('common.noLiveClasses')}</p>
          ) : (
            <ul className="student-homework-list">
              {upcomingLive.slice(0, 4).map((session) => (
                <li key={session.id} className="student-homework-item">
                  <span className="student-homework-icon" aria-hidden>
                    <AppIcon name="video" className="w-7 h-7" />
                  </span>
                  <div>
                    <p className="student-homework-title">{session.title}</p>
                    <p className="student-homework-meta">
                      {statusLabel(session)} · {formatSessionWhen(session.scheduledAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="student-card">
          <div className="student-card-head">
            <AppIcon name="library" className="w-5 h-5" />
            <h3>{t('dashboard.elibrary')}</h3>
            <Link to={`${base}/e-library`} className="student-card-link">{t('common.browse')}</Link>
          </div>
          {eLibraryItems.length === 0 ? (
            <p className="student-card-empty">{t('common.noBooks')}</p>
          ) : (
            <ul className="student-homework-list">
              {eLibraryItems.slice(0, 4).map((item) => (
                <li key={item.id} className="student-homework-item">
                  <span className="student-homework-icon" aria-hidden>
                    <AppIcon name="book" className="w-7 h-7" />
                  </span>
                  <div>
                    <p className="student-homework-title">{item.title}</p>
                    <p className="student-homework-meta">{item.author || item.category || t('common.digitalBook')}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="student-card">
          <div className="student-card-head">
            <AppIcon name="learning" className="w-5 h-5" />
            <h3>{t('dashboard.elearning')}</h3>
            <Link to={`${base}/e-learning`} className="student-card-link">{t('common.start')}</Link>
          </div>
          {eLearningCourses.length === 0 ? (
            <p className="student-card-empty">{t('common.noCourses')}</p>
          ) : (
            <ul className="student-homework-list">
              {eLearningCourses.slice(0, 4).map((course) => (
                <li key={course.id} className="student-homework-item">
                  <span className="student-homework-icon" aria-hidden>
                    <AppIcon name="learning" className="w-7 h-7" />
                  </span>
                  <div>
                    <p className="student-homework-title">{course.title}</p>
                    <p className="student-homework-meta">
                      {t('dashboard.lessonsExercises', {
                        lessons: course._count?.lessons || 0,
                        exercises: course._count?.exercises || 0,
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
