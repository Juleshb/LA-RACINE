export default function SegmentedControl({ value, onChange, options, disabled = false }) {
  return (
    <div className={`segmented-control ${disabled ? 'opacity-60 pointer-events-none' : ''}`} role="tablist">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={value === opt.value}
            disabled={disabled || opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`segmented-control-item ${value === opt.value ? 'segmented-control-item-active' : ''}`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
