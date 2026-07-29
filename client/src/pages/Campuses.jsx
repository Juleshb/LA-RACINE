import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus, Building2, ArrowRight, Users, GraduationCap,
  MapPin, LogOut, LayoutDashboard, Calendar, Pencil,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { api, setActiveCampus } from '../lib/api';
import Logo, { MottoBanner } from '../components/Logo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';

const EMPTY_FORM = {
  name: '',
  code: '',
  city: '',
  district: '',
  province: 'WESTERN',
  country: 'RWANDA',
  address: '',
  phone: '',
  email: '',
  isActive: true,
};

export default function Campuses() {
  const { user, isManager, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [campuses, setCampuses] = useState([]);
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
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

  const openCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const openEdit = (campus) => {
    setModalMode('edit');
    setEditingId(campus.id);
    setForm({
      name: campus.name || '',
      code: campus.code || '',
      city: campus.city || '',
      district: campus.district || '',
      province: campus.province || 'WESTERN',
      country: campus.country || 'RWANDA',
      address: campus.address || '',
      phone: campus.phone || '',
      email: campus.email || '',
      isActive: campus.isActive !== false,
    });
    setError('');
  };

  const closeForm = () => {
    setModalMode(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setSubmitting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        city: form.city.trim(),
        district: form.district.trim(),
        province: form.province.trim() || 'WESTERN',
        country: form.country.trim() || 'RWANDA',
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        isActive: form.isActive,
      };
      if (modalMode === 'edit' && editingId) {
        await api.updateCampus(editingId, payload);
      } else {
        await api.createCampus(payload);
      }
      closeForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

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
            <button onClick={openCreate} className="btn-primary flex items-center gap-2 shrink-0">
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
          open={Boolean(modalMode)}
          mode={modalMode === 'edit' ? 'edit' : 'create'}
          title={modalMode === 'edit' ? t('staffDash.campuses.editTitle') : t('staffDash.campuses.createTitle')}
          subtitle={modalMode === 'edit' ? t('staffDash.campuses.editSubtitle') : t('staffDash.campuses.createSubtitle')}
          onClose={closeForm}
          onSubmit={handleSubmit}
          formId="campus-form"
          submitLabel={modalMode === 'edit' ? t('staffDash.campuses.editSubmit') : t('staffDash.campuses.createSubmit')}
          submitting={submitting}
          error={error}
          size="lg"
        >
          <FormSection title={t('staffDash.campuses.campusDetails')}>
            <div>
              <label className="label">{t('staffDash.campuses.campusName')}</label>
              <input className="input" required placeholder={t('staffDash.campuses.campusNamePlaceholder')} value={form.name} onChange={(e) => setField('name', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('staffDash.campuses.code')}</label>
              <input className="input" required placeholder={t('staffDash.campuses.codePlaceholder')} value={form.code} onChange={(e) => setField('code', e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="label">{t('staffDash.campuses.city')}</label>
              <input className="input" required value={form.city} onChange={(e) => setField('city', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('staffDash.campuses.district')}</label>
              <input className="input" required value={form.district} onChange={(e) => setField('district', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('staffDash.campuses.province')}</label>
              <input className="input" value={form.province} onChange={(e) => setField('province', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('staffDash.campuses.country')}</label>
              <input className="input" value={form.country} onChange={(e) => setField('country', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">{t('staffDash.campuses.address')}</label>
              <input className="input" value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder={t('staffDash.campuses.addressPlaceholder')} />
            </div>
            <div>
              <label className="label">{t('ui.phone')}</label>
              <input className="input" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('ui.email')}</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </div>
            {modalMode === 'edit' && (
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    checked={form.isActive}
                    onChange={(e) => setField('isActive', e.target.checked)}
                  />
                  {t('staffDash.campuses.activeCampus')}
                </label>
                <p className="field-hint mt-1">{t('staffDash.campuses.activeCampusHint')}</p>
              </div>
            )}
          </FormSection>
        </FormModeModal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campuses.map((c) => (
            <div key={c.id} className={`campus-card group ${c.isActive === false ? 'opacity-75' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="campus-card-icon">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-lg text-gray-900">{c.name}</h3>
                    {c.isActive === false && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {t('ui.inactive')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {c.city}, {c.district} · {c.code}
                  </p>
                  {(c.phone || c.email) && (
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {[c.phone, c.email].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="campus-tag"><Users className="w-3 h-3" />{t('staffDash.campuses.tagStudents', { count: c._count?.students || 0 })}</span>
                    <span className="campus-tag"><GraduationCap className="w-3 h-3" />{t('staffDash.campuses.tagTeachers', { count: c._count?.teachers || 0 })}</span>
                    <span className="campus-tag"><Calendar className="w-3 h-3" />{t('staffDash.campuses.tagUsers', { count: c._count?.users || 0 })}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {isManager && (
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="btn-secondary flex-1 inline-flex items-center justify-center gap-2 text-sm"
                  >
                    <Pencil className="w-4 h-4" />
                    {t('ui.edit')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => enterCampus(c.id)}
                  className="campus-enter-btn flex-1"
                  disabled={c.isActive === false && !isManager}
                >
                  {t('staffDash.campuses.openDashboard')}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {campuses.length === 0 && (
          <div className="card text-center py-16">
            <Building2 className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">{t('staffDash.campuses.emptyTitle')}</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">{t('staffDash.campuses.emptyDesc')}</p>
            {isManager && (
              <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
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
