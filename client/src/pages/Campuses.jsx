import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus, Building2, ArrowRight, Users, GraduationCap,
  MapPin, LogOut, LayoutDashboard, Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { api, setActiveCampus } from '../lib/api';
import Logo, { MottoBanner } from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';

export default function Campuses() {
  const { user, isManager, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [campuses, setCampuses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', city: '', district: '', phone: '', email: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => api.getCampuses().then(setCampuses).catch(console.error);
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!isManager && campuses.length === 1 && campuses[0].isActive !== false) {
      setActiveCampus(campuses[0].id);
      navigate(`/campus/${campuses[0].id}`, { replace: true });
    }
  }, [isManager, campuses, navigate]);

  const totals = campuses.reduce(
    (acc, c) => ({
      students: acc.students + (c._count?.students || 0),
      teachers: acc.teachers + (c._count?.teachers || 0),
      users: acc.users + (c._count?.users || 0),
    }),
    { students: 0, teachers: 0, users: 0 },
  );

  const enterCampus = (campusId) => {
    setActiveCampus(campusId);
    navigate(`/campus/${campusId}`);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm({ name: '', code: '', city: '', district: '', phone: '', email: '' });
    setError('');
    setSubmitting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.createCampus(form);
      closeForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <LanguageSwitcher tone="app" />
            <Link
              to="/profile"
              className="text-right hidden sm:block hover:opacity-80 transition-opacity"
              title={t('app.myProfile')}
            >
              <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-brand-700">{t('staffDash.manager.roleEyebrow')}</p>
            </Link>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600"
              title={t('app.signOut')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <MottoBanner className="mb-6" />

        <div className="manager-hub-hero mb-8">
          <div>
            <p className="text-sm font-medium text-brand-700 mb-2">{t('staffDash.campuses.commandCenter')}</p>
            <h1 className="text-3xl font-bold text-gray-900">
              {isManager ? t('staffDash.campuses.hello', { name: user?.firstName }) : t('staffDash.campuses.yourCampus')}
            </h1>
            <p className="text-gray-600 mt-2 max-w-xl">
              {isManager ? t('staffDash.campuses.managerDesc') : t('staffDash.campuses.selectDesc')}
            </p>
          </div>
          {isManager && (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              {t('staffDash.campuses.newCampus')}
            </button>
          )}
        </div>

        {isManager && campuses.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="hub-stat">
              <Building2 className="w-5 h-5 text-brand-600 mb-2" />
              <p className="hub-stat-value">{campuses.length}</p>
              <p className="hub-stat-label">{t('staffDash.campuses.campuses')}</p>
            </div>
            <div className="hub-stat">
              <Users className="w-5 h-5 text-brand-600 mb-2" />
              <p className="hub-stat-value">{totals.students}</p>
              <p className="hub-stat-label">{t('staffDash.campuses.totalStudents')}</p>
            </div>
            <div className="hub-stat">
              <GraduationCap className="w-5 h-5 text-brand-600 mb-2" />
              <p className="hub-stat-value">{totals.teachers}</p>
              <p className="hub-stat-label">{t('staffDash.campuses.totalTeachers')}</p>
            </div>
            <div className="hub-stat">
              <LayoutDashboard className="w-5 h-5 text-brand-600 mb-2" />
              <p className="hub-stat-value">{totals.users}</p>
              <p className="hub-stat-label">{t('staffDash.campuses.userAccounts')}</p>
            </div>
          </div>
        )}

        <FormModeModal
          open={showForm}
          mode="create"
          title={t('staffDash.campuses.createTitle')}
          subtitle={t('staffDash.campuses.createSubtitle')}
          onClose={closeForm}
          onSubmit={handleSubmit}
          formId="campus-form"
          submitLabel={t('staffDash.campuses.createSubmit')}
          submitting={submitting}
          error={error}
          size="lg"
        >
          <FormSection title={t('staffDash.campuses.campusDetails')}>
            <div>
              <label className="label">{t('staffDash.campuses.campusName')}</label>
              <input className="input" required placeholder={t('staffDash.campuses.campusNamePlaceholder')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('staffDash.campuses.code')}</label>
              <input className="input" required placeholder={t('staffDash.campuses.codePlaceholder')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="label">{t('staffDash.campuses.city')}</label>
              <input className="input" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('staffDash.campuses.district')}</label>
              <input className="input" required value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('ui.phone')}</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('ui.email')}</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </FormSection>
        </FormModeModal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campuses.map((c) => (
            <div key={c.id} className="campus-card group">
              <div className="flex items-start gap-4">
                <div className="campus-card-icon">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg text-gray-900">{c.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {c.city}, {c.district} · {c.code}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="campus-tag"><Users className="w-3 h-3" />{t('staffDash.campuses.tagStudents', { count: c._count?.students || 0 })}</span>
                    <span className="campus-tag"><GraduationCap className="w-3 h-3" />{t('staffDash.campuses.tagTeachers', { count: c._count?.teachers || 0 })}</span>
                    <span className="campus-tag"><Calendar className="w-3 h-3" />{t('staffDash.campuses.tagUsers', { count: c._count?.users || 0 })}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => enterCampus(c.id)}
                className="campus-enter-btn"
              >
                {t('staffDash.campuses.openDashboard')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          ))}
        </div>

        {campuses.length === 0 && (
          <div className="card text-center py-16">
            <Building2 className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">{t('staffDash.campuses.emptyTitle')}</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">{t('staffDash.campuses.emptyDesc')}</p>
            {isManager && (
              <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />{t('staffDash.campuses.createFirst')}
              </button>
            )}
          </div>
        )}

        {isManager && campuses.length > 0 && (
          <div className="mt-10 p-6 rounded-xl bg-white border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">{t('staffDash.campuses.managerGuide')}</h3>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>{t('staffDash.campuses.guide1')}</li>
              <li>{t('staffDash.campuses.guide2')}</li>
              <li>{t('staffDash.campuses.guide3')}</li>
              <li>{t('staffDash.campuses.guide4')}</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
