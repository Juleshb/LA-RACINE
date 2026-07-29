export default function ScoreBadge({ percent, size = 'sm' }) {
  if (percent == null || Number.isNaN(percent)) {
    return <span className="text-gray-300">—</span>;
  }

  const pass = percent >= 50;
  const sizeClass = size === 'lg' ? 'score-badge-lg' : 'score-badge';

  return (
    <span className={`${sizeClass} ${pass ? 'score-badge-pass' : 'score-badge-fail'}`}>
      {percent}%
    </span>
  );
}
