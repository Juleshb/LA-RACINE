import { createContext, useContext, useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { api, setActiveCampus, setActiveAcademicYear } from '../lib/api';

const CampusContext = createContext(null);

export function CampusProvider() {
  const { campusId } = useParams();
  const [campus, setCampus] = useState(null);
  const [academicYear, setAcademicYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [yearError, setYearError] = useState('');

  const loadYear = () => {
    setYearError('');
    return api.getActiveAcademicYear()
      .then((year) => {
        setAcademicYear(year);
        if (year?.id) setActiveAcademicYear(year.id);
        else setActiveAcademicYear(null);
      })
      .catch((err) => {
        setAcademicYear(null);
        setYearError(err.message);
      });
  };

  useEffect(() => {
    if (!campusId) return;
    setActiveCampus(campusId);
    setLoading(true);
    Promise.all([
      api.getCampus(campusId),
      api.getActiveAcademicYear().catch(() => null),
    ])
      .then(([campusData, yearData]) => {
        setCampus(campusData);
        setAcademicYear(yearData);
        if (yearData?.id) setActiveAcademicYear(yearData.id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [campusId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!campus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Campus not found</p>
      </div>
    );
  }

  return (
    <CampusContext.Provider value={{ campus, campusId, academicYear, reloadAcademicYear: loadYear, yearError }}>
      <Outlet />
    </CampusContext.Provider>
  );
}

export function useCampus() {
  const ctx = useContext(CampusContext);
  if (!ctx) throw new Error('useCampus must be used within CampusProvider');
  return ctx;
}
