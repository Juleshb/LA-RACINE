import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus, Building2, ArrowRight, Users, GraduationCap,
  MapPin, LogOut, LayoutDashboard, Calendar, Pencil, Trash2,
  BookOpen, Phone, Mail, Search,
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

function campusStats(campus) {
  if (campus?.stats) return campus.stats;
  // Fallback when API has not attached year-scoped stats yet
  const count = campus?._count || {};
  return {
    students: count.students || 0,
    pending: 0,
    teachers: count.teachers || 0,
    classes: count.classes || 0,
    staffUsers: count.users || 0,
    activeYear: null,
  };
}

export default function Campuses() {
  const { user, isManager, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [campuses, setCampuses] = useState([]);
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getCampuses()
      .then(setCampuses)
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!isManager && campuses.length === 1 && campuses[0].isActive !== false) {
      setActiveCampus(campuses[0].id);
      navigate(`/campus/${campuses[0].id}`, { replace: true });
    }
  }, [isManager, campuses, navigate]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = campuses.slice().sort((a, b) => {
      const aActive = a.isActive !== false ? 0 : 1;
      const bActive = b.isActive !== false ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    if (!q) return list;
    return list.filter((c) => {
      const hay = `${c.name} ${c.code} ${c.city} ${c.district} ${c.phone || ''} ${c.email || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [campuses, search]);

  const totals = useMemo(() => {
    const active = campuses.filter((c) => c.isActive !== false);
    return active.reduce(
      (acc, c) => {
        const s = campusStats(c);
        return {
          campuses: acc.campuses + 1,
          students: acc.students + (s.students || 0),
          teachers: acc.teachers + (s.teachers || 0),
          classes: acc.classes + (s.classes || 0),
          pending: acc.pending + (s.pending || 0),
          staffUsers: acc.staffUsers + (s.staffUsers || 0),
        };
      },
      { campuses: 0, students: 0, teachers: 0, classes: 0, pending: 0, staffUsers: 0 },
    );
  }, [campuses]);

  const handleDeleteCampus = async (campus) => {
    if (!isManager) return;
    if (campuses.length <= 1) {
      window.alert('You cannot delete the only remaining campus.');
      return;
    }
    const s = campusStats(campus);
    const ok = window.confirm(
      `Delete campus “${campus.name}” (${campus.code})?\n\n`
      + `This permanently removes its academic years, classes, students (${s.students}), teachers (${s.teachers}), and related data.\n`
      + 'This cannot be undone.',
    );
    if (!ok) return;

    setDeletingId(campus.id);
    try {
      await api.deleteCampus(campus.id);
      if (localStorage.getItem('campusId') === campus.id) {
        localStorage.removeItem('campusId');
      }
      await load();
    } catch (err) {
      window.alert(err.message || 'Failed to delete campus');
    } finally {
      setDeletingId(null);
    }
  };

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
    <div className="campuses-page">
      <header className="campuses-topbar">
        <div className="campuses-topbar-inner">
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

      <div className="campuses-shell">
        <MottoBanner className="mb-6" />

        <section className="campuses-hero">
          <div className="campuses-hero-copy">
            <p className="campuses-kicker">{t('staffDash.campuses.commandCenter')}</p>
            <h1 className="campuses-hero-title">
              {isManager ? t('staffDash.campuses.hello', { name: user?.firstName }) : t('staffDash.campuses.yourCampus')}
            </h1>
            <p className="campuses-hero-text">
              {isManager ? t('staffDash.campuses.managerDesc') : t('staffDash.campuses.selectDesc')}
            </p>
          </div>
          {isManager && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              {t('staffDash.campuses.newCampus')}
            </button>
          )}
        </section>

        {isManager && campuses.length > 0 && (
          <div className="campuses-stats">
            <div className="campuses-stat">
              <Building2 className="campuses-stat-icon" />
              <div>
                <p className="campuses-stat-value">{totals.campuses}</p>
                <p className="campuses-stat-label">{t('staffDash.campuses.activeCampuses')}</p>
              </div>
            </div>
            <div className="campuses-stat">
              <Users className="campuses-stat-icon" />
              <div>
                <p className="campuses-stat-value">{totals.students}</p>
                <p className="campuses-stat-label">{t('staffDash.campuses.enrolledStudents')}</p>
              </div>
            </div>
            <div className="campuses-stat">
              <GraduationCap className="campuses-stat-icon" />
              <div>
                <p className="campuses-stat-value">{totals.teachers}</p>
                <p className="campuses-stat-label">{t('staffDash.campuses.totalTeachers')}</p>
              </div>
            </div>
            <div className="campuses-stat">
              <BookOpen className="campuses-stat-icon" />
              <div>
                <p className="campuses-stat-value">{totals.classes}</p>
                <p className="campuses-stat-label">{t('staffDash.campuses.totalClasses')}</p>
              </div>
            </div>
            {totals.pending > 0 && (
              <div className="campuses-stat is-amber">
                <LayoutDashboard className="campuses-stat-icon" />
                <div>
                  <p className="campuses-stat-value">{totals.pending}</p>
                  <p className="campuses-stat-label">{t('staffDash.campuses.pendingApps')}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {campuses.length > 0 && (
          <div className="campuses-toolbar">
            <div className="campuses-search">
              <Search className="w-4 h-4" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('staffDash.campuses.searchPlaceholder')}
                aria-label={t('staffDash.campuses.searchPlaceholder')}
              />
            </div>
            <p className="campuses-toolbar-meta">
              {t('staffDash.campuses.showingCount', { count: visible.length, total: campuses.length })}
            </p>
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

        {loading ? (
          <div className="campuses-empty">
            <p className="text-gray-500">{t('ui.loading')}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="campuses-empty">
            <Building2 className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">
              {campuses.length === 0 ? t('staffDash.campuses.emptyTitle') : t('ui.noSearchResults')}
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              {campuses.length === 0 ? t('staffDash.campuses.emptyDesc') : t('staffDash.campuses.searchEmpty')}
            </p>
            {isManager && campuses.length === 0 && (
              <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />{t('staffDash.campuses.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="campuses-grid">
            {visible.map((c) => {
              const s = campusStats(c);
              const inactive = c.isActive === false;
              return (
                <article key={c.id} className={`campus-card-v2 ${inactive ? 'is-inactive' : ''}`}>
                  <div className="campus-card-v2-head">
                    <div className="campus-card-v2-icon">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="campus-card-v2-title">{c.name}</h3>
                        <span className={`campus-status ${inactive ? 'is-off' : 'is-on'}`}>
                          {inactive ? t('ui.inactive') : t('ui.active')}
                        </span>
                      </div>
                      <p className="campus-card-v2-meta">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>{c.city}, {c.district} · {c.code}</span>
                      </p>
                      {s.activeYear && (
                        <p className="campus-card-v2-year">
                          <Calendar className="w-3.5 h-3.5" />
                          {s.activeYear}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="campus-metrics">
                    <div className="campus-metric">
                      <span className="campus-metric-value">{s.students}</span>
                      <span className="campus-metric-label">{t('staffDash.campuses.metricStudents')}</span>
                    </div>
                    <div className="campus-metric">
                      <span className="campus-metric-value">{s.teachers}</span>
                      <span className="campus-metric-label">{t('staffDash.campuses.metricTeachers')}</span>
                    </div>
                    <div className="campus-metric">
                      <span className="campus-metric-value">{s.classes}</span>
                      <span className="campus-metric-label">{t('staffDash.campuses.metricClasses')}</span>
                    </div>
                    <div className="campus-metric">
                      <span className="campus-metric-value">{s.pending || 0}</span>
                      <span className="campus-metric-label">{t('staffDash.campuses.metricPending')}</span>
                    </div>
                  </div>

                  {(c.phone || c.email) && (
                    <div className="campus-card-v2-contact">
                      {c.phone && (
                        <span><Phone className="w-3.5 h-3.5" />{c.phone}</span>
                      )}
                      {c.email && (
                        <span><Mail className="w-3.5 h-3.5" />{c.email}</span>
                      )}
                    </div>
                  )}

                  <div className="campus-card-v2-actions">
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
                    {isManager && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCampus(c)}
                        disabled={deletingId === c.id || campuses.length <= 1}
                        className="btn-secondary inline-flex items-center justify-center gap-2 text-sm text-red-600 hover:text-red-700 hover:border-red-200 disabled:opacity-50 px-3"
                        title={campuses.length <= 1 ? 'Cannot delete the only campus' : 'Delete campus'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => enterCampus(c.id)}
                      className="campus-enter-btn flex-[1.4]"
                      disabled={inactive && !isManager}
                    >
                      {t('staffDash.campuses.openDashboard')}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {isManager && campuses.length > 0 && (
          <div className="campuses-guide">
            <h3 className="font-semibold text-gray-900 mb-2">{t('staffDash.campuses.managerGuide')}</h3>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>{t('staffDash.campuses.guide1')}</li>
              <li>{t('staffDash.campuses.guide2')}</li>
              <li>{t('staffDash.campuses.guide3')}</li>
              <li>{t('staffDash.campuses.guide4')}</li>
            </ol>
            <p className="text-xs text-gray-400 mt-3">{t('staffDash.campuses.statsNote')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
