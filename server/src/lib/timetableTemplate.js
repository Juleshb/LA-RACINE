/** Default Rwanda-style day — used when no template exists yet. */
export const DEFAULT_PERIOD_DEFINITIONS = [
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

export const CAMPUS_SCOPE_KEY = 'campus';

export function normalizeTime(value) {
  if (!value) return '07:30';
  const parts = value.slice(0, 5).split(':');
  const h = parts[0]?.padStart(2, '0') ?? '07';
  const m = parts[1]?.padStart(2, '0') ?? '30';
  return `${h}:${m}`;
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

/** Build start/end times from day start + ordered period definitions. */
export function computePeriodTimes(dayStartTime, definitions = []) {
  let cursor = toMinutes(dayStartTime);
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

export function scopeKeyForClass(classId) {
  return classId ? String(classId) : CAMPUS_SCOPE_KEY;
}

export function serializeTemplate(template, periods) {
  const computed = computePeriodTimes(template.dayStartTime, periods);
  return {
    id: template.id,
    campusId: template.campusId,
    academicYearId: template.academicYearId,
    classId: template.classId,
    scopeKey: template.scopeKey,
    isCampusDefault: template.scopeKey === CAMPUS_SCOPE_KEY,
    dayStartTime: normalizeTime(template.dayStartTime),
    periods: periods.map((p, i) => ({
      id: p.id,
      sortOrder: p.sortOrder ?? i,
      label: p.label,
      durationMinutes: p.durationMinutes,
      isBreak: p.isBreak,
      start: computed[i]?.start,
      end: computed[i]?.end,
    })),
    gridPeriods: computed.map((p) => ({
      start: p.start,
      end: p.end,
      label: p.label,
      isBreak: p.isBreak,
      durationMinutes: p.durationMinutes,
    })),
  };
}

export function validatePeriodDefinitions(periods) {
  if (!Array.isArray(periods) || periods.length === 0) {
    throw new Error('Add at least one period to the day structure');
  }
  for (const [i, p] of periods.entries()) {
    const duration = Number(p.durationMinutes);
    if (!Number.isFinite(duration) || duration < 5 || duration > 180) {
      throw new Error(`Period ${i + 1}: duration must be between 5 and 180 minutes`);
    }
    if (!p.label?.trim()) {
      throw new Error(`Period ${i + 1}: label is required`);
    }
  }
}
