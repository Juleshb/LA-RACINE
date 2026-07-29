import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import { useTranslation } from '../context/LanguageContext';

export default function AcademicYearBanner() {
  const { isManager, user } = useAuth();
  const { campusId, academicYear } = useCampus();
  const { t } = useTranslation();
  const isParent = user?.role === 'PARENT';

  if (academicYear) return null;

  return (
    <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-900">{t('academicYearBanner.title')}</p>
        <p className="text-sm text-amber-700 mt-1">
          {isManager
            ? t('academicYearBanner.manager')
            : isParent
              ? t('academicYearBanner.parent')
              : t('academicYearBanner.staff')}
        </p>
        {isManager && (
          <Link to={`/campus/${campusId}/academic-years`} className="text-sm text-brand-600 font-medium mt-2 inline-block hover:underline">
            {t('academicYearBanner.goTo')}
          </Link>
        )}
      </div>
    </div>
  );
}
