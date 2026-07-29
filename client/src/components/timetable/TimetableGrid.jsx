import { Plus, Pencil, Trash2, Clock, MapPin, User, AlertTriangle } from 'lucide-react';
import {
  formatPeriodRange,
  subjectColorClass,
} from '../../lib/timetable';

export default function TimetableGrid({
  grid,
  days,
  canEdit,
  onAddCell,
  onEditSlot,
  onDeleteSlot,
  showClassInCell = false,
  conflictSlotIds = new Set(),
  conflictInfo = new Map(),
}) {
  if (!grid?.length) {
    return (
      <div className="timetable-empty">
        <p>No periods defined yet.</p>
      </div>
    );
  }

  return (
    <div className="timetable-grid-wrap">
      <table className="timetable-grid">
        <thead>
          <tr>
            <th className="timetable-time-col">Time</th>
            {days.map((day) => (
              <th key={day.index} className="timetable-day-col">{day.short}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map(({ period, cells }) => (
            <tr key={`${period.start}-${period.end}`} className={period.isBreak ? 'timetable-break-row' : ''}>
              <td className="timetable-time-cell">
                <span className="timetable-period-label">{period.label}</span>
                <span className="timetable-period-time">{formatPeriodRange(period.start, period.end)}</span>
              </td>
              {cells.map(({ day, slot }) => {
                if (period.isBreak) {
                  return (
                    <td key={day.index} className="timetable-break-cell" colSpan={1}>
                      <span>{period.label}</span>
                    </td>
                  );
                }

                if (slot) {
                  const isConflict = conflictSlotIds.has(slot.id);
                  const conflict = conflictInfo.get(slot.id);
                  const colorClass = isConflict ? 'timetable-cell-conflict' : subjectColorClass(slot, day.index);
                  const conflictTitle = isConflict && conflict
                    ? `Teacher conflict: ${conflict.teacherName || 'Teacher'} also in ${conflict.otherClasses.join(', ')}`
                    : undefined;
                  return (
                    <td key={day.index} className="timetable-slot-cell">
                      <div
                        className={`timetable-slot-card group ${colorClass}`}
                        title={conflictTitle}
                      >
                        {isConflict && (
                          <span className="timetable-conflict-badge" title={conflictTitle}>
                            <AlertTriangle className="w-3 h-3" />
                            <span>Conflict</span>
                          </span>
                        )}
                        <div className="timetable-slot-main">
                          <p className="timetable-slot-subject">{slot.subject?.name || 'Free period'}</p>
                          {slot.subject?.code && (
                            <p className="timetable-slot-code">{slot.subject.code}</p>
                          )}
                          {showClassInCell && (
                            <p className="timetable-slot-meta">{slot.class?.name}</p>
                          )}
                          {slot.room && (
                            <p className="timetable-slot-meta flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {slot.room}
                            </p>
                          )}
                          {slot.subject?.teacher?.name && (
                            <p className="timetable-slot-meta flex items-center gap-1">
                              <User className="w-3 h-3 shrink-0" />
                              {slot.subject.teacher.name}
                            </p>
                          )}
                          {isConflict && conflict?.otherClasses?.length > 0 && (
                            <p className="timetable-conflict-meta">
                              Also in: {conflict.otherClasses.join(', ')}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <div className="timetable-slot-actions">
                            <button
                              type="button"
                              onClick={() => onEditSlot(slot)}
                              className="timetable-slot-btn"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteSlot && (
                            <button
                              type="button"
                              onClick={() => onDeleteSlot(slot.id)}
                              className="timetable-slot-btn timetable-slot-btn-danger"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                }

                return (
                  <td key={day.index} className="timetable-empty-cell">
                    {canEdit ? (
                      <button
                        type="button"
                        className="timetable-add-cell"
                        onClick={() => onAddCell({ dayIndex: day.index, period })}
                        title={`Add lesson on ${day.label}`}
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    ) : (
                      <span className="timetable-free-label">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TimetableSummaryBar({ className, slotCount, hoursLabel, lessonPeriods, breakCount, scopeLabel, conflictCount = 0 }) {
  return (
    <div className="timetable-summary-bar">
      <div className="timetable-summary-item">
        <Clock className="w-4 h-4 text-brand-600" />
        <span><strong>{className}</strong> weekly schedule</span>
        {scopeLabel && <span className="text-xs text-gray-500">({scopeLabel})</span>}
      </div>
      <div className="timetable-summary-stats">
        {conflictCount > 0 && (
          <span className="timetable-stat-chip timetable-stat-chip-conflict">
            <AlertTriangle className="w-3 h-3" />
            {conflictCount} teacher conflict{conflictCount > 1 ? 's' : ''}
          </span>
        )}
        {lessonPeriods != null && (
          <span className="timetable-stat-chip">{lessonPeriods} period rows</span>
        )}
        {breakCount != null && breakCount > 0 && (
          <span className="timetable-stat-chip">{breakCount} breaks</span>
        )}
        <span className="timetable-stat-chip">{slotCount} lessons</span>
        <span className="timetable-stat-chip">{hoursLabel} teaching time</span>
      </div>
    </div>
  );
}
