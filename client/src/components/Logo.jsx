export default function Logo({ size = 'md', showMotto = false, showSubtitle = true, className = '' }) {
  const sizes = {
    sm: { img: 'h-10' },
    md: { img: 'h-16' },
    lg: { img: 'h-24' },
    xl: { img: 'h-32' },
  };

  const s = sizes[size] || sizes.md;

  if (size === 'sm') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <img src="/logo.png" alt="École La RACINE" className="h-10 w-10 object-contain" />
        <div>
          <p className="font-semibold text-sm leading-none text-gray-900">École La RACINE</p>
          {showSubtitle && <p className="text-[10px] text-gray-500 mt-0.5">Management System</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {showMotto && (
        <p className="text-xs tracking-widest uppercase text-gray-500 mb-3 font-medium">
          Discipline · Intelligence · Innovation
        </p>
      )}
      <img src="/logo.png" alt="École La RACINE" className={`${s.img} w-auto object-contain`} />
      {showSubtitle && (
        <p className="text-sm text-gray-500 mt-3">School Management System</p>
      )}
    </div>
  );
}

export function MottoBanner({ className = '' }) {
  return (
    <p className={`motto-text text-center ${className}`}>
      Discipline · Intelligence · Innovation
    </p>
  );
}
