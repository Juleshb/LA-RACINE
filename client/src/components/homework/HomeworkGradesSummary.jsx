import { Link } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';

function scoreClass(percent) {
  if (percent == null) return '';
  if (percent >= 80) return 'hw-grade-good';
  if (percent >= 50) return 'hw-grade-ok';
  return 'hw-grade-low';
}

export default function HomeworkGradesSummary({
  summary,
  campusId,
  studentId,
  compact = false,
  title,
  detailSegment = 'homework',
  itemIdField = 'homeworkId',
}) {
  const { t } = useTranslation();
  const defaultTitle = detailSegment === 'e-learning'
    ? t('grades.elearningGrades')
    : t('grades.homeworkGrades');
  const displayTitle = title || defaultTitle;

  if (!summary) return null;

  const { completed, pending, averagePercent, recentSubmissions, student } = summary;
  const childName = student ? `${student.firstName} ${student.lastName}` : null;
  const detailQs = studentId ? `?studentId=${studentId}` : '';
  const itemLink = (item) => `/campus/${campusId}/${detailSegment}/${item[itemIdField]}${detailQs}`;

  if (compact) {
    return (
      <div className="hw-grades-compact">
        <div className="hw-grades-compact-stats">
          <span><strong>{completed}</strong> {t('grades.done')}</span>
          {pending > 0 && <span><strong>{pending}</strong> {t('grades.toDo')}</span>}
          {averagePercent != null && (
            <span className={scoreClass(averagePercent)}>
              <strong>{averagePercent}%</strong> {t('grades.average')}
            </span>
          )}
        </div>
        {recentSubmissions?.length > 0 && (
          <ul className="hw-grades-recent-list">
            {recentSubmissions.slice(0, 3).map((s) => (
              <li key={s[itemIdField] || s.id}>
                <Link to={itemLink(s)}>
                  {s.title}
                </Link>
                <span className={scoreClass(s.percent)}>{s.score}/{s.maxScore}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <section className="hw-grades-card">
      <div className="hw-grades-card-head">
        <h3>{childName ? `${childName} — ${displayTitle}` : displayTitle}</h3>
      </div>
      <div className="hw-grades-stats">
        <div className="hw-grades-stat">
          <span className="hw-grades-stat-value">{completed}</span>
          <span className="hw-grades-stat-label">{t('grades.completed')}</span>
        </div>
        <div className="hw-grades-stat">
          <span className="hw-grades-stat-value">{pending}</span>
          <span className="hw-grades-stat-label">{t('grades.stillToDo')}</span>
        </div>
        <div className={`hw-grades-stat ${scoreClass(averagePercent)}`}>
          <span className="hw-grades-stat-value">
            {averagePercent != null ? `${averagePercent}%` : '—'}
          </span>
          <span className="hw-grades-stat-label">{t('grades.averageScore')}</span>
        </div>
      </div>
      {recentSubmissions?.length > 0 ? (
        <ul className="hw-grades-recent">
          {recentSubmissions.map((s) => (
            <li key={s[itemIdField] || s.id} className="hw-grades-recent-item">
              <div>
                <Link
                  to={itemLink(s)}
                  className="hw-grades-recent-title"
                >
                  {s.title}
                </Link>
                {s.subject && <p className="hw-grades-recent-sub">{s.subject}</p>}
              </div>
              <div className="hw-grades-recent-score">
                <span className={scoreClass(s.percent)}>{s.score}/{s.maxScore}</span>
                <span className="hw-grades-recent-pct">{s.percent}%</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hw-grades-empty">
          {detailSegment === 'e-learning' ? t('common.noCourses') : t('common.noHomework')}
        </p>
      )}
    </section>
  );
}
