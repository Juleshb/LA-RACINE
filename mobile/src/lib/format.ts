export function formatDueDate(date: string | Date) {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff < 0) return 'Overdue — finish me!';
  return `Due in ${diff} days`;
}

export function formatSessionWhen(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function statusTone(status?: string): 'success' | 'warning' | 'brand' | 'teal' {
  if (status === 'live') return 'success';
  if (status === 'starting_soon') return 'warning';
  return 'brand';
}

export function statusLabel(status?: string) {
  if (status === 'live') return 'Live now';
  if (status === 'starting_soon') return 'Starting soon';
  return 'Coming up';
}

/** Safe display label for API fields that may be a string or `{ name }`. */
export function labelOf(
  value: unknown,
  fallback = '',
): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) return name;
  }
  return fallback;
}

