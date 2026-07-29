export default function ParentChildFilter({
  children,
  value,
  onChange,
  label = 'Select child',
}) {
  if (!children?.length) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/80 text-sm text-amber-900">
        No children are linked to your account yet. Please contact the school office.
      </div>
    );
  }

  if (children.length === 1) {
    const child = children[0];
    return (
      <div className="mb-6 p-4 rounded-xl border border-brand-100 bg-brand-50/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Your child</p>
        <p className="text-sm font-semibold text-gray-900">
          {child.firstName} {child.lastName}
          <span className="text-gray-500 font-normal"> · {child.class?.name || child.className || 'Unassigned'}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <label className="label">{label}</label>
      <select className="input max-w-md" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        {children.map((child) => (
          <option key={child.id} value={child.id}>
            {child.firstName} {child.lastName} — {child.class?.name || child.className || 'Unassigned'}
          </option>
        ))}
      </select>
    </div>
  );
}
