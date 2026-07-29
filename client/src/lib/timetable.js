export const SCHOOL_DAYS = [
  { index: 0, label: 'Monday', short: 'Mon' },
  { index: 1, label: 'Tuesday', short: 'Tue' },
  { index: 2, label: 'Wednesday', short: 'Wed' },
  { index: 3, label: 'Thursday', short: 'Thu' },
  { index: 4, label: 'Friday', short: 'Fri' },
];

/** Fallback when no saved template exists yet (matches server default). */
export const FALLBACK_PERIOD_DEFINITIONS = [
  { label: 'Period 1', durationMinutes: 40, isBreak: false },
  { label: 'Period 2', durationMinutes: 40, isBreak: false },
  { label: 'Period 3', durationMinutes: 40, isBreak: false },
  { label: 'Morning break', durationMinutes: 30, isBreak: true },
  { label: 'Period 4', durationMinutes: 40, isBreak: false },
  { label: 'Period 5', durationMinutes: 40, isBreak: false },
  { label: 'Period 6', durationMinutes: 40, isBreak: false },
  { label: 'Period 7', durationMinutes: 40, isBreak: false },
  { label: 'Lunch', durationMinutes: 50, isBreak: true },
  { label: 'Period 8', durationMinutes: 40, isBreak: false },
  { label: 'Period 9', durationMinutes: 40, isBreak: false },
  { label: 'Period 10', durationMinutes: 40, isBreak: false },
];

const SUBJECT_COLORS = [
  'timetable-cell-math',
  'timetable-cell-english',
  'timetable-cell-science',
  'timetable-cell-kinyarwanda',
  'timetable-cell-french',
  'timetable-cell-social',
  'timetable-cell-sport',
  'timetable-cell-art',
  'timetable-cell-default',
];

export function normalizeTime(value) {
  if (!value) return '';
  return value.slice(0, 5);
}

export function formatPeriodRange(start, end) {
  return `${normalizeTime(start)} – ${normalizeTime(end)}`;
}

function periodKey(start, end) {
  return `${normalizeTime(start)}-${normalizeTime(end)}`;
}

function toMinutes(time) {
  const [h, m] = normalizeTime(time).split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(total) {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function computePeriodTimes(dayStartTime, definitions = []) {
  let cursor = toMinutes(dayStartTime || '07:30');
  return definitions.map((def, index) => {
    const start = fromMinutes(cursor);
    cursor += Math.max(1, Number(def.durationMinutes) || 40);
    const end = fromMinutes(cursor);
    return {
      sortOrder: index,
      label: def.label || (def.isBreak ? 'Break' : `Period ${index + 1}`),
      durationMinutes: Number(def.durationMinutes) || 40,
      isBreak: Boolean(def.isBreak),
      start,
      end,
    };
  });
}

function slotMatchesPeriod(slot, period) {
  return normalizeTime(slot.startTime) === normalizeTime(period.start)
    && normalizeTime(slot.endTime) === normalizeTime(period.end);
}

/** Period rows for the grid — from saved template, with orphan lesson times appended. */
export function resolvePeriods(templatePeriods = [], slots = []) {
  const map = new Map();

  for (const p of templatePeriods) {
    const key = periodKey(p.start, p.end);
    map.set(key, {
      start: normalizeTime(p.start),
      end: normalizeTime(p.end),
      label: p.label,
      isBreak: Boolean(p.isBreak),
      durationMinutes: p.durationMinutes,
    });
  }

  for (const slot of slots) {
    const key = periodKey(slot.startTime, slot.endTime);
    if (!map.has(key)) {
      map.set(key, {
        start: normalizeTime(slot.startTime),
        end: normalizeTime(slot.endTime),
        label: formatPeriodRange(slot.startTime, slot.endTime),
        isBreak: false,
        custom: true,
      });
    }
  }

  return [...map.values()].sort((a, b) => normalizeTime(a.start).localeCompare(normalizeTime(b.start)));
}

export function buildTimetableGrid(slots = [], periods = [], days = SCHOOL_DAYS) {
  const grid = periods.map((period) => ({
    period,
    cells: days.map((day) => {
      const slot = slots.find((s) => s.dayOfWeek === day.index && slotMatchesPeriod(s, period));
      return { day, slot: slot || null };
    }),
  }));

  return { periods, days, grid };
}

export function subjectColorClass(slot, index = 0) {
  if (!slot?.subject) return 'timetable-cell-free';
  const code = (slot.subject.code || slot.subject.name || '').toLowerCase();
  if (code.includes('math') || code.includes('mat')) return 'timetable-cell-math';
  if (code.includes('eng')) return 'timetable-cell-english';
  if (code.includes('sci')) return 'timetable-cell-science';
  if (code.includes('kin')) return 'timetable-cell-kinyarwanda';
  if (code.includes('fra') || code.includes('fr')) return 'timetable-cell-french';
  if (code.includes('sport') || code.includes('pe')) return 'timetable-cell-sport';
  return SUBJECT_COLORS[index % SUBJECT_COLORS.length];
}

export function countWeeklyPeriods(slots = [], periods = []) {
  const teaching = periods.filter((p) => !p.isBreak);
  if (!teaching.length) {
    return slots.filter((s) => SCHOOL_DAYS.some((d) => d.index === s.dayOfWeek)).length;
  }
  return slots.filter((s) => SCHOOL_DAYS.some((d) => d.index === s.dayOfWeek)).length;
}

export function weeklyHours(slots = []) {
  let total = 0;
  for (const slot of slots) {
    total += Math.max(0, toMinutes(slot.endTime) - toMinutes(slot.startTime));
  }
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

export function countTeachingPeriods(periods = []) {
  return periods.filter((p) => !p.isBreak).length;
}

export function countBreaks(periods = []) {
  return periods.filter((p) => p.isBreak).length;
}

export function nextLessonLabel(periods) {
  const lessons = periods.filter((p) => !p.isBreak);
  return `Period ${lessons.length + 1}`;
}

export function createEmptyPeriodDefinition(periods = [], isBreak = false) {
  return {
    label: isBreak ? 'Break' : nextLessonLabel(periods),
    durationMinutes: isBreak ? 30 : 40,
    isBreak,
  };
}

export function templateScopeLabel(template) {
  if (!template) return '';
  if (template.isCampusDefault || template.scopeKey === 'campus') return 'Campus default';
  if (template.inheritedFromCampus) return 'Using campus default';
  return 'Custom for this class';
}

/** Find slots where the same teacher is scheduled in multiple classes at the same time. */
export function detectTeacherConflicts(slots = []) {
  const buckets = new Map();

  for (const slot of slots) {
    const teacherId = slot.subject?.teacher?.id;
    if (!teacherId) continue;
    const key = `${teacherId}|${slot.dayOfWeek}|${normalizeTime(slot.startTime)}|${normalizeTime(slot.endTime)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(slot);
  }

  const conflictSlotIds = new Set();
  const conflictInfo = new Map();

  for (const group of buckets.values()) {
    const classIds = new Set(group.map((s) => s.classId));
    if (classIds.size < 2) continue;

    for (const slot of group) {
      conflictSlotIds.add(slot.id);
      const otherClasses = group
        .filter((s) => s.classId !== slot.classId)
        .map((s) => s.class?.name)
        .filter(Boolean);
      conflictInfo.set(slot.id, {
        teacherName: slot.subject?.teacher?.name,
        otherClasses: [...new Set(otherClasses)],
      });
    }
  }

  return { conflictSlotIds, conflictInfo, conflictCount: conflictSlotIds.size };
}
