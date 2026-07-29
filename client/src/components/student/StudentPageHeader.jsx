import { Link } from 'react-router-dom';
import AppIcon from '../icons/AppIcon';
import { useTranslation } from '../../context/LanguageContext';

export default function StudentPageHeader({
  icon,
  title,
  subtitle,
  backTo,
  backLabel,
}) {
  const { t } = useTranslation();
  const label = backLabel ?? t('common.backHome');

  return (
    <header className="student-page-header">
      {backTo && (
        <Link to={backTo} className="student-back-link">
          <AppIcon name="arrowLeft" className="w-4 h-4 inline-block" />
          {' '}
          {label}
        </Link>
      )}
      <div className="student-page-header-inner">
        {icon && (
          <span className="student-page-icon" aria-hidden>
            <AppIcon name={icon} className="w-10 h-10" />
          </span>
        )}
        <div>
          <h1 className="student-page-title">{title}</h1>
          {subtitle && <p className="student-page-subtitle">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}
