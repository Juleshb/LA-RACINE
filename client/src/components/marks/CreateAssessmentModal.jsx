import { X } from 'lucide-react';
import Modal from '../form/Modal';

/**
 * Step 1 — set class / subject / assessment details, then continue to record.
 * Competence (nursery) mode only needs class + period.
 */
export default function CreateAssessmentModal({
  open,
  onClose,
  onContinue,
  t,
  classes,
  classId,
  onClassChange,
  courses,
  courseGroups,
  coursesLoading,
  subjectId,
  onSubjectChange,
  terms,
  term,
  onTermChange,
  assessmentOptions,
  assessment,
  onAssessmentChange,
  showNumber,
  numberHint,
  assessmentNumber,
  onAssessmentNumberChange,
  assessedOn,
  onAssessedOnChange,
  maxScore,
  onMaxScoreChange,
  canContinue,
  error,
  competenceMode = false,
  title,
  continueLabel,
}) {
  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="pm-create-modal">
        <div className="pm-create-header">
          <h2 className="pm-create-title">
            {title || (competenceMode
              ? t('pages.marks.createCompetence')
              : t('pages.marks.createAssessment'))}
          </h2>
          <button
            type="button"
            className="pm-create-close"
            onClick={onClose}
            aria-label={t('ui.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pm-create-body">
          {error && <div className="form-mode-error !mx-0 mb-3">{error}</div>}

          <label className="pm-create-field">
            <span className="pm-create-label">{t('ui.class')}</span>
            <select
              className="pm-create-input"
              value={classId}
              onChange={(e) => onClassChange(e.target.value)}
            >
              <option value="">{t('pages.marks.placeholderClass')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.grade ? ` (${c.grade})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="pm-create-field">
            <span className="pm-create-label">{t('pages.marks.trimestre')}</span>
            <select
              className="pm-create-input"
              value={term}
              onChange={(e) => onTermChange(e.target.value)}
            >
              {terms.map((termOption) => (
                <option key={termOption} value={termOption}>{termOption}</option>
              ))}
            </select>
          </label>

          {competenceMode ? (
            <p className="pm-create-hint">{t('pages.marks.competenceCreateHint')}</p>
          ) : (
            <>
              <label className="pm-create-field">
                <span className="pm-create-label">{t('pages.marks.subSubject')}</span>
                <select
                  className="pm-create-input"
                  value={subjectId}
                  onChange={(e) => onSubjectChange(e.target.value)}
                  disabled={!classId || coursesLoading || courses.length === 0}
                >
                  <option value="">
                    {coursesLoading
                      ? t('pages.marks.loadingCourses')
                      : t('pages.marks.placeholderSubject')}
                  </option>
                  {courseGroups.map((group) => (
                    <optgroup key={group.category} label={group.category}>
                      {group.courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <label className="pm-create-field">
                <span className="pm-create-label">{t('pages.marks.assessmentType')}</span>
                <select
                  className="pm-create-input"
                  value={assessment}
                  onChange={(e) => onAssessmentChange(e.target.value)}
                  disabled={!subjectId || assessmentOptions.length === 0}
                >
                  <option value="">{t('pages.marks.placeholderAssessmentType')}</option>
                  {assessmentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              {showNumber && (
                <label className="pm-create-field">
                  <span className="pm-create-label">{t('pages.marks.assessmentNumber')}</span>
                  <input
                    className="pm-create-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    placeholder={t('pages.marks.placeholderAssessmentNumber')}
                    value={assessmentNumber === '' || assessmentNumber == null ? '' : String(assessmentNumber)}
                    onChange={(e) => onAssessmentNumberChange(e.target.value)}
                  />
                  {numberHint ? <span className="pm-create-hint block mt-1.5">{numberHint}</span> : null}
                </label>
              )}

              <label className="pm-create-field pm-create-date">
                <span className="pm-create-label">{t('pages.marks.assessmentDate')}</span>
                <input
                  className="pm-create-input"
                  type="date"
                  value={assessedOn}
                  onChange={(e) => onAssessedOnChange(e.target.value)}
                />
              </label>

              <label className="pm-create-field">
                <span className="pm-create-label">{t('pages.marks.maxScore')}</span>
                <input
                  className="pm-create-input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={t('pages.marks.placeholderMaxMarks')}
                  value={maxScore === '' || maxScore == null ? '' : String(maxScore)}
                  onChange={(e) => onMaxScoreChange(e.target.value)}
                />
              </label>
            </>
          )}
        </div>

        <div className="pm-create-footer pm-create-footer-responsive">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('ui.cancel')}
          </button>
          <button
            type="button"
            className="btn-primary disabled:opacity-50"
            disabled={!canContinue}
            onClick={onContinue}
          >
            {continueLabel || t('pages.marks.continueToRecord')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
