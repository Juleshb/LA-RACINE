/** Shared quiz / question labels for student homework & e-learning flows. */
export function getQuestionTypeLabel(type, t) {
  const map = {
    TRUE_FALSE: 'homework.typeTrueFalse',
    MULTIPLE_CHOICE: 'homework.typeMultipleChoice',
    SHORT_ANSWER: 'homework.typeShortAnswer',
  };
  return t(map[type] || 'homework.typeShortAnswer');
}

export function formatBoolAnswer(raw, t) {
  return raw === 'true' ? t('common.true') : t('common.false');
}

export function formatDueDateLabel(date, t) {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / (24 * 60 * 60 * 1000));
  if (diff === 0) return t('dashboard.dueToday');
  if (diff === 1) return t('dashboard.dueTomorrow');
  if (diff < 0) return t('homework.overdueAskTeacher');
  return t('dashboard.dueInDays', { count: diff });
}
