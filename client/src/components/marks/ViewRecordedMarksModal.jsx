import { Pencil, Play, X } from 'lucide-react';
import Modal from '../form/Modal';
import ScoreBadge from '../bulletin/ScoreBadge';
import { studentFullName } from '../../lib/studentName';

export default function ViewRecordedMarksModal({
  open,
  onClose,
  onResume,
  t,
  session,
  students,
  records,
  loading,
}) {
  if (!open || !session) return null;

  const maxScore = session.maxScore || '—';
  const isComplete = Boolean(session.complete);
  const rows = students.map((s) => {
    const score = records[s.id]?.score;
    const hasScore = score !== '' && score != null && !Number.isNaN(Number(score));
    const pct = hasScore && Number(session.maxScore) > 0
      ? Math.round((Number(score) / Number(session.maxScore)) * 100)
      : null;
    return { student: s, score, hasScore, pct, notes: records[s.id]?.notes || '' };
  });

  return (
    <Modal open={open} onClose={onClose} size="2xl">
      <div className="pm-view-modal">
        <div className="pm-view-header">
          <div>
            <p className="pm-kicker">{t('pages.marks.recordedMarks')}</p>
            <h2 className="pm-view-title">
              {session.label}
              <span className="pm-session-max"> / {maxScore}</span>
            </h2>
            <p className="pm-view-meta">
              {[session.className, session.subjectName, session.term, session.assessedOn].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button type="button" className="pm-create-close" onClick={onClose} aria-label={t('ui.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pm-view-stats">
          <div className="pm-view-stat">
            <span className="pm-view-stat-value">{session.entered}/{session.studentCount}</span>
            <span className="pm-view-stat-label">{t('pages.marks.enteredShort')}</span>
          </div>
          <div className="pm-view-stat">
            <span className="pm-view-stat-value">{session.completionPct}%</span>
            <span className="pm-view-stat-label">{t('pages.marks.completion')}</span>
          </div>
          <div className="pm-view-stat">
            <span className="pm-view-stat-value">{session.avgPct != null ? `${session.avgPct}%` : '—'}</span>
            <span className="pm-view-stat-label">{t('pages.marks.classAverage')}</span>
          </div>
          <div className="pm-view-stat">
            <span className="pm-view-stat-value">{session.missing}</span>
            <span className="pm-view-stat-label">{t('pages.marks.missingShort')}</span>
          </div>
        </div>

        <div className="pm-view-body">
          {loading ? (
            <div className="pm-empty">
              <p>{t('ui.loading')}</p>
            </div>
          ) : (
            <div className="pm-grid-scroll rounded-xl border border-gray-100">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th className="pm-col-idx">#</th>
                    <th className="pm-col-id">{t('pages.marks.studentId')}</th>
                    <th className="pm-col-name">{t('ui.name')}</th>
                    <th className="pm-col-score text-center">{t('pages.marks.score')}</th>
                    <th className="pm-col-pct text-center">%</th>
                    <th className="pm-col-notes">{t('ui.notes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.student.id} className={row.hasScore ? 'is-filled' : 'is-empty'}>
                      <td className="pm-col-idx text-gray-400 tabular-nums">{idx + 1}</td>
                      <td className="pm-col-id font-mono text-xs text-gray-500">{row.student.studentId}</td>
                      <td className="pm-col-name font-medium text-gray-900">{studentFullName(row.student)}</td>
                      <td className="pm-col-score text-center tabular-nums">
                        {row.hasScore ? row.score : '—'}
                      </td>
                      <td className="pm-col-pct text-center">
                        <ScoreBadge percent={row.pct} />
                      </td>
                      <td className="pm-col-notes text-sm text-gray-500">{row.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pm-create-footer pm-create-footer-responsive pm-view-footer">
          <button type="button" className="pm-action-btn pm-action-view" onClick={onClose}>
            <span className="pm-action-btn-icon" aria-hidden>
              <X className="w-4 h-4" />
            </span>
            <span className="pm-action-btn-copy">
              <span className="pm-action-btn-label">{t('ui.close')}</span>
            </span>
          </button>
          <button
            type="button"
            className={`pm-action-btn pm-action-primary ${isComplete ? 'is-edit' : 'is-resume'}`}
            onClick={onResume}
          >
            <span className="pm-action-btn-icon" aria-hidden>
              {isComplete ? <Pencil className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </span>
            <span className="pm-action-btn-copy">
              <span className="pm-action-btn-label">
                {isComplete ? t('pages.marks.editMarks') : t('pages.marks.resumeRecording')}
              </span>
              <span className="pm-action-btn-hint">
                {isComplete ? t('pages.marks.editMarksHint') : t('pages.marks.resumeRecordingHint')}
              </span>
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
