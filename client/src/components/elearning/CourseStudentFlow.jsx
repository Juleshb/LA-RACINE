import { useMemo, useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import EmbeddedYouTube from '../media/EmbeddedYouTube';
import CourseExerciseQuiz from './CourseExerciseQuiz';
import AppIcon, { IconLabel } from '../icons/AppIcon';

const STORAGE_KEY = (courseId) => `lrs-elearning-watched-${courseId}`;

function loadWatched(courseId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(courseId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveWatched(courseId, set) {
  try {
    localStorage.setItem(STORAGE_KEY(courseId), JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function getVideoLessons(lessons) {
  return (lessons || []).filter((l) => l.youtubeId || l.videoUrl);
}

function getInitialLessonIndex(course, watched) {
  const videos = getVideoLessons(course.lessons);
  const idx = videos.findIndex((l) => !watched.has(l.id));
  return idx >= 0 ? idx : 0;
}

function getInitialPhase(course, watched) {
  const exercises = course.exercises || [];
  const videos = getVideoLessons(course.lessons);
  const allWatched = videos.length === 0 || videos.every((l) => watched.has(l.id));
  if (course.mySubmission) return 'done';
  if (allWatched && exercises.length > 0) return 'quiz';
  return 'watch';
}

export default function CourseStudentFlow({ course, onSubmitted }) {
  const { t } = useTranslation();
  const lessons = course.lessons || [];
  const exercises = course.exercises || [];
  const hasVideos = lessons.some((l) => l.youtubeId || l.videoUrl);
  const hasSubmission = Boolean(course.mySubmission);

  const [watched, setWatched] = useState(() => loadWatched(course.id));
  const [lessonIndex, setLessonIndex] = useState(() => getInitialLessonIndex(course, loadWatched(course.id)));
  const [phase, setPhase] = useState(() => getInitialPhase(course, loadWatched(course.id)));
  const [quizFormKey, setQuizFormKey] = useState(0);

  const videoLessons = useMemo(() => getVideoLessons(lessons), [lessons]);
  const textOnlyLessons = useMemo(
    () => lessons.filter((l) => !l.youtubeId && !l.videoUrl),
    [lessons],
  );

  const allVideosWatched = videoLessons.length === 0
    || videoLessons.every((l) => watched.has(l.id));

  const currentLesson = videoLessons[lessonIndex] || null;
  const watchProgress = videoLessons.length
    ? Math.round((videoLessons.filter((l) => watched.has(l.id)).length / videoLessons.length) * 100)
    : 100;

  const markWatched = (lessonId) => {
    const next = new Set(watched);
    next.add(lessonId);
    setWatched(next);
    saveWatched(course.id, next);
  };

  const goToWatch = (fromStart = false) => {
    if (fromStart) setLessonIndex(0);
    setPhase('watch');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToQuiz = (freshAttempt = false) => {
    if (freshAttempt) setQuizFormKey((k) => k + 1);
    setPhase('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDoneWatching = () => {
    if (currentLesson) markWatched(currentLesson.id);
    if (lessonIndex < videoLessons.length - 1) {
      setLessonIndex((i) => i + 1);
      return;
    }
    if (exercises.length > 0) {
      goToQuiz(true);
    }
  };

  const handleQuizSubmitted = (data) => {
    setPhase('done');
    onSubmitted?.(data);
  };

  const stepWatchActive = phase === 'watch';
  const stepQuizActive = phase === 'quiz';
  const stepDoneActive = phase === 'done';
  const stepWatchDone = allVideosWatched || stepQuizActive || stepDoneActive;
  const stepQuizDone = stepDoneActive;

  return (
    <div className="course-student-flow">
      <div className="course-step-track" aria-label={t('elearning.courseProgress')}>
        <button type="button" className={`course-step course-step-btn ${stepWatchActive ? 'course-step-active' : ''} ${stepWatchDone ? 'course-step-done' : ''}`} onClick={() => goToWatch(false)}>
          <span className="course-step-dot">1</span>
          <span className="course-step-label">
            <IconLabel icon="video">{t('elearning.watch')}</IconLabel>
          </span>
        </button>
        <div className={`course-step-line ${stepWatchDone ? 'course-step-line-done' : ''}`} />
        <button
          type="button"
          className={`course-step course-step-btn ${stepQuizActive ? 'course-step-active' : ''} ${stepQuizDone ? 'course-step-done' : ''} ${!stepWatchDone ? 'course-step-locked' : ''}`}
          onClick={() => stepWatchDone && goToQuiz(true)}
          disabled={!stepWatchDone}
        >
          <span className="course-step-dot">2</span>
          <span className="course-step-label">
            <IconLabel icon="questions">{t('elearning.questionsStep')}</IconLabel>
          </span>
        </button>
        <div className={`course-step-line ${stepQuizDone ? 'course-step-line-done' : ''}`} />
        <div className={`course-step ${stepDoneActive ? 'course-step-done' : 'course-step-locked'}`}>
          <span className="course-step-dot">3</span>
          <span className="course-step-label">
            <IconLabel icon="trophy">{t('elearning.doneStep')}</IconLabel>
          </span>
        </div>
      </div>

      {phase === 'watch' && hasVideos && (
        <section className="course-phase-card course-phase-watch">
          <div className="course-phase-head">
            <span className="course-phase-icon" aria-hidden>
              <AppIcon name="video" className="w-12 h-12" />
            </span>
            <div>
              <h2 className="course-phase-title">{t('elearning.stepWatchTitle')}</h2>
              <p className="course-phase-sub">
                {t('elearning.lessonProgress', { current: lessonIndex + 1, total: videoLessons.length })}
                {watchProgress > 0 && ` · ${t('elearning.percentComplete', { percent: watchProgress })}`}
              </p>
            </div>
          </div>

          {currentLesson && (
            <article className="student-material-card student-material-lesson">
              <h3 className="student-material-label mb-2">{currentLesson.title}</h3>
              {currentLesson.description && (
                <p className="student-material-text mb-3">{currentLesson.description}</p>
              )}
              <EmbeddedYouTube
                youtubeId={currentLesson.youtubeId}
                videoUrl={currentLesson.videoUrl}
                title={currentLesson.title}
              />
            </article>
          )}

          {textOnlyLessons.length > 0 && lessonIndex === 0 && (
            <div className="course-read-cards">
              {textOnlyLessons.map((l) => (
                <div key={l.id} className="student-material-card student-material-intro">
                  <h3 className="student-material-label">{l.title}</h3>
                  {l.description && <p className="student-material-text">{l.description}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="course-phase-actions">
            <button type="button" onClick={handleDoneWatching} className="course-big-btn course-big-btn-primary">
              {lessonIndex < videoLessons.length - 1 ? (
                <IconLabel icon="arrowRight">{t('elearning.finishedNextLesson')}</IconLabel>
              ) : exercises.length > 0 ? (
                <IconLabel icon="questions">{t('elearning.finishedGoQuestions')}</IconLabel>
              ) : (
                <IconLabel icon="trophy">{t('elearning.finishedWatching')}</IconLabel>
              )}
            </button>
            {exercises.length > 0 && allVideosWatched && (
              <button type="button" onClick={() => goToQuiz(true)} className="course-big-btn course-big-btn-secondary">
                <IconLabel icon="questions">{t('elearning.skipToQuestions')}</IconLabel>
              </button>
            )}
          </div>
        </section>
      )}

      {phase === 'quiz' && exercises.length > 0 && (
        <section className="course-phase-card course-phase-quiz course-phase-reveal">
          <div className="course-phase-head">
            <span className="course-phase-icon" aria-hidden>
              <AppIcon name="celebrate" className="w-12 h-12" />
            </span>
            <div>
              <h2 className="course-phase-title">{t('elearning.stepQuizTitle')}</h2>
              <p className="course-phase-sub">
                {hasSubmission
                  ? t('elearning.quizRetryHint')
                  : t('elearning.quizAfterWatch')}
              </p>
            </div>
          </div>
          <CourseExerciseQuiz
            key={quizFormKey}
            courseId={course.id}
            exercises={exercises}
            submission={course.mySubmission}
            startInForm
            onSubmitted={handleQuizSubmitted}
          />
          <div className="course-phase-actions mt-4">
            {hasVideos && (
              <button type="button" onClick={() => goToWatch(false)} className="course-big-btn course-big-btn-secondary">
                <IconLabel icon="video">{t('elearning.watchVideosAgain')}</IconLabel>
              </button>
            )}
          </div>
        </section>
      )}

      {phase === 'done' && exercises.length > 0 && (
        <section className="course-phase-card course-phase-done">
          <CourseExerciseQuiz
            courseId={course.id}
            exercises={exercises}
            submission={course.mySubmission}
            startInForm={false}
            onSubmitted={handleQuizSubmitted}
          />
          <div className="course-phase-actions mt-4 flex-col sm:flex-row">
            {hasVideos && (
              <button type="button" onClick={() => goToWatch(true)} className="course-big-btn course-big-btn-secondary">
                <IconLabel icon="video">{t('elearning.watchLessonsAgain')}</IconLabel>
              </button>
            )}
            <button type="button" onClick={() => goToQuiz(true)} className="course-big-btn course-big-btn-primary">
              <IconLabel icon="pencil">{t('elearning.tryQuestionsAgain')}</IconLabel>
            </button>
          </div>
        </section>
      )}

      {phase === 'watch' && !hasVideos && exercises.length > 0 && (
        <section className="course-phase-card">
          <p className="student-material-text text-center mb-4">{t('elearning.noVideosJumpQuiz')}</p>
          <button type="button" onClick={() => goToQuiz(true)} className="course-big-btn course-big-btn-primary w-full">
            <IconLabel icon="questions">{t('elearning.startQuestions')}</IconLabel>
          </button>
        </section>
      )}

      {lessons.length === 0 && exercises.length === 0 && (
        <div className="student-empty-card">{t('elearning.courseEmpty')}</div>
      )}
    </div>
  );
}
