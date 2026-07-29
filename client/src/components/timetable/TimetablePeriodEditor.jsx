import { useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Coffee,
  Plus,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { computePeriodTimes, formatPeriodRange } from '../../lib/timetable';

function PeriodRow({
  period,
  preview,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}) {
  return (
    <div className={`period-editor-row ${period.isBreak ? 'period-editor-row-break' : ''}`}>
      <div className="period-editor-row-index">{index + 1}</div>
      <div className="period-editor-row-type">
        <select
          className="input input-sm"
          value={period.isBreak ? 'break' : 'lesson'}
          onChange={(e) => onChange({ isBreak: e.target.value === 'break' })}
        >
          <option value="lesson">Lesson</option>
          <option value="break">Break / Lunch</option>
        </select>
      </div>
      <div className="period-editor-row-label">
        <input
          className="input input-sm"
          value={period.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={period.isBreak ? 'Break name' : 'Period name'}
        />
      </div>
      <div className="period-editor-row-duration">
        <input
          className="input input-sm"
          type="number"
          min={5}
          max={180}
          value={period.durationMinutes}
          onChange={(e) => onChange({ durationMinutes: Number(e.target.value) })}
        />
        <span className="text-xs text-gray-400">min</span>
      </div>
      <div className="period-editor-row-time">
        <span className="text-xs text-gray-500 tabular-nums">
          {formatPeriodRange(preview.start, preview.end)}
        </span>
      </div>
      <div className="period-editor-row-actions">
        <button type="button" className="period-editor-icon-btn" onClick={onMoveUp} disabled={index === 0} title="Move up">
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="period-editor-icon-btn" onClick={onMoveDown} disabled={index === total - 1} title="Move down">
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="period-editor-icon-btn period-editor-icon-btn-danger" onClick={onRemove} title="Remove">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function TimetablePeriodEditor({
  dayStartTime,
  periods,
  onDayStartChange,
  onPeriodsChange,
}) {
  const previews = useMemo(
    () => computePeriodTimes(dayStartTime, periods),
    [dayStartTime, periods],
  );

  const lessonCount = periods.filter((p) => !p.isBreak).length;
  const breakCount = periods.filter((p) => p.isBreak).length;
  const dayEnd = previews.length ? previews[previews.length - 1].end : dayStartTime;

  const updatePeriod = (index, patch) => {
    const next = periods.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onPeriodsChange(next);
  };

  const movePeriod = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= periods.length) return;
    const next = [...periods];
    [next[index], next[target]] = [next[target], next[index]];
    onPeriodsChange(next);
  };

  const removePeriod = (index) => {
    onPeriodsChange(periods.filter((_, i) => i !== index));
  };

  const addPeriod = (isBreak) => {
    const lessons = periods.filter((p) => !p.isBreak);
    onPeriodsChange([
      ...periods,
      {
        label: isBreak ? (breakCount ? 'Break' : 'Morning break') : `Period ${lessons.length + 1}`,
        durationMinutes: isBreak ? 30 : 40,
        isBreak,
      },
    ]);
  };

  const insertBreakAfter = (lessonIndex) => {
    let seen = 0;
    let insertAt = periods.length;
    for (let i = 0; i < periods.length; i += 1) {
      if (!periods[i].isBreak) {
        if (seen === lessonIndex) {
          insertAt = i + 1;
          break;
        }
        seen += 1;
      }
    }
    const next = [...periods];
    next.splice(insertAt, 0, {
      label: 'Break',
      durationMinutes: 30,
      isBreak: true,
    });
    onPeriodsChange(next);
  };

  return (
    <div className="period-editor">
      <div className="period-editor-toolbar">
        <div>
          <label className="label">School day starts at</label>
          <input
            className="input w-36"
            type="time"
            value={dayStartTime}
            onChange={(e) => onDayStartChange(e.target.value)}
          />
        </div>
        <div className="period-editor-stats">
          <span className="timetable-stat-chip">{lessonCount} lessons</span>
          <span className="timetable-stat-chip">{breakCount} breaks</span>
          <span className="timetable-stat-chip">Ends {dayEnd}</span>
        </div>
      </div>

      <div className="period-editor-header-row">
        <span>#</span>
        <span>Type</span>
        <span>Name</span>
        <span>Duration</span>
        <span>Time</span>
        <span />
      </div>

      <div className="period-editor-list">
        {periods.map((period, index) => (
          <PeriodRow
            key={`period-${index}`}
            period={period}
            preview={previews[index]}
            index={index}
            total={periods.length}
            onChange={(patch) => updatePeriod(index, patch)}
            onMoveUp={() => movePeriod(index, -1)}
            onMoveDown={() => movePeriod(index, 1)}
            onRemove={() => removePeriod(index)}
          />
        ))}
      </div>

      <div className="period-editor-actions">
        <button type="button" className="btn-secondary text-sm flex items-center gap-1.5" onClick={() => addPeriod(false)}>
          <BookOpen className="w-4 h-4" />
          Add lesson period
        </button>
        <button type="button" className="btn-secondary text-sm flex items-center gap-1.5" onClick={() => addPeriod(true)}>
          <Coffee className="w-4 h-4" />
          Add break
        </button>
        {lessonCount > 0 && (
          <button type="button" className="btn-ghost text-sm" onClick={() => insertBreakAfter(Math.min(2, lessonCount) - 1)}>
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            Insert break after period {Math.min(3, lessonCount)}
          </button>
        )}
      </div>

      <p className="field-hint mt-3">
        Reorder periods with the arrows. Each row sets its own length — breaks and lessons can be placed anywhere in the day.
      </p>
    </div>
  );
}
