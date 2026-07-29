import { useTranslationOptional } from '../context/LanguageContext';

export default function PageHeader({ title, description, action }) {
  const { t } = useTranslationOptional();
  const resolvedTitle = typeof title === 'string' && title.startsWith('pages.') ? t(title) : title;
  const resolvedDescription = typeof description === 'string' && description.startsWith('pages.')
    ? t(description)
    : description;

  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{resolvedTitle}</h1>
        {resolvedDescription && <p className="page-description">{resolvedDescription}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
