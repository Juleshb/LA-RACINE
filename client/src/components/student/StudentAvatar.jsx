const VARIANT_CLASS = {
  menu: 'student-profile-menu-avatar',
  menuHead: 'student-profile-menu-head-avatar',
  profileHero: 'student-profile-hero-avatar',
  dashboardHero: 'student-hero-avatar',
};

export default function StudentAvatar({
  photoUrl,
  firstName,
  lastName,
  className = '',
  variant = 'menu',
  children,
}) {
  const initial = `${(firstName?.[0] || '').toUpperCase()}${(lastName?.[0] || '').toUpperCase()}` || '?';
  const baseClass = VARIANT_CLASS[variant] || VARIANT_CLASS.menu;
  const label = [firstName, lastName].filter(Boolean).join(' ') || 'Student';

  if (photoUrl) {
    return (
      <span className={`${baseClass} student-avatar-has-photo ${className}`}>
        <img src={photoUrl} alt={label} className="student-avatar-image" />
      </span>
    );
  }

  return (
    <span className={`${baseClass} ${className}`} aria-hidden={variant !== 'menu'}>
      {children || initial}
    </span>
  );
}
