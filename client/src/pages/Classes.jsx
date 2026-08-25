import { useEffect, useMemo, useState } from 'react';
import {
  Baby,
  BookOpen,
  GraduationCap,
  Plus,
  Search,
  Trash2,
  Edit2,
  User,
  Users,
  Layers,
  Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { matchesSearch } from '../components/ListSearch';
import { useTranslation } from '../context/LanguageContext';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { isNurseryGrade, isPrimaryGrade } from '../lib/grades';

const EMPTY_FORM = { name: '', grade: '', section: '', teacherId: '' };

function classLevel(grade) {
  if (isNurseryGrade(grade)) return 'nursery';
  if (isPrimaryGrade(grade)) return 'primary';
  return 'other';
}

export default function Classes() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isTeacher = user?.role === 'TEACHER';
  const canManageClasses = !['TEACHER', 'ACCOUNTANT', 'PARENT', 'STUDENT'].includes(user?.role);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sortKey, setSortKey] = useState('grade');
  const [formMode, setFormMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const isEditing = formMode === 'edit';
  const editingClass = classes.find((c) => c.id === editingId);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const data = await api.getClasses();
      setClasses(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
    if (canManageClasses) {
      api.getTeachers().then(setTeachers).catch(console.error);
    }
  }, [canManageClasses]);

  const stats = useMemo(() => {
    const totalStudents = classes.reduce((sum, c) => sum + (c._count?.students || 0), 0);
    const nursery = classes.filter((c) => isNurseryGrade(c.grade)).length;
    const primary = classes.filter((c) => isPrimaryGrade(c.grade)).length;
    return {
      total: classes.length,
      students: totalStudents,
      nursery,
      primary,
    };
  }, [classes]);

  const displayed = useMemo(() => {
    let list = classes.filter((cls) => {
      const level = classLevel(cls.grade);
      if (levelFilter === 'nursery' && level !== 'nursery') return false;
      if (levelFilter === 'primary' && level !== 'primary') return false;
      return matchesSearch(search, cls.name, cls.grade, cls.section, cls.teacher?.name);
    });

    list = list.slice().sort((a, b) => {
      if (sortKey === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' });
      }
      if (sortKey === 'students') {
        return (b._count?.students || 0) - (a._count?.students || 0);
      }
      // grade then section then name
      const g = String(a.grade || '').localeCompare(String(b.grade || ''), 'fr', { sensitivity: 'base' });
      if (g !== 0) return g;
      const s = String(a.section || '').localeCompare(String(b.section || ''), 'fr', { sensitivity: 'base' });
      if (s !== 0) return s;
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' });
    });

    return list;
  }, [classes, search, levelFilter, sortKey]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormMode('create');
    setError('');
  };

  const openEdit = (cls) => {
    setForm({
      name: cls.name,
      grade: cls.grade,
      section: cls.section,
      teacherId: cls.teacherId || '',
    });
    setEditingId(cls.id);
    setFormMode('edit');
    setError('');
  };

  const closeForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormMode(null);
    setError('');
    setSubmitting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const payload = { ...form, teacherId: form.teacherId || null };
    try {
      if (isEditing) {
        await api.updateClass(editingId, payload);
      } else {
        await api.createClass(payload);
      }
      closeForm();
      loadClasses();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('pageBody.classes.deleteConfirm'))) return;
    try {
      await api.deleteClass(id);
      if (editingId === id) closeForm();
      loadClasses();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="classes-page">
      <PageHeader
        title={isTeacher ? t('pages.classes.titleTeacher') : t('pages.classes.title')}
        description={isTeacher
          ? t('pages.classes.descriptionTeacher')
          : user?.role === 'ACCOUNTANT'
            ? t('pages.classes.descriptionAccountant')
            : t('pages.classes.description')}
        action={canManageClasses && (
          <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('pages.classes.add')}
          </button>
        )}
      />

      <section className="classes-hero">
        <div className="classes-hero-copy">
          <p className="classes-hero-kicker">
            {isTeacher ? 'Mes classes' : 'Organisation scolaire'}
          </p>
          <h2 className="classes-hero-title">
            {isTeacher ? 'Vos classes assignées' : 'Classes du campus'}
          </h2>
          <p className="classes-hero-text">
            Nursery (M1–TOP) et primaire (P1–P6). Chaque combinaison niveau + section est unique par année.
          </p>
        </div>
        <div className="classes-hero-stats">
          <div className="classes-stat">
            <span className="classes-stat-icon"><Layers className="w-4 h-4" /></span>
            <div>
              <p className="classes-stat-value">{stats.total}</p>
              <p className="classes-stat-label">Classes</p>
            </div>
          </div>
          <div className="classes-stat">
            <span className="classes-stat-icon"><Users className="w-4 h-4" /></span>
            <div>
              <p className="classes-stat-value">{stats.students}</p>
              <p className="classes-stat-label">{t('ui.students')}</p>
            </div>
          </div>
          <div className="classes-stat">
            <span className="classes-stat-icon"><Baby className="w-4 h-4" /></span>
            <div>
              <p className="classes-stat-value">{stats.nursery}</p>
              <p className="classes-stat-label">Nursery</p>
            </div>
          </div>
          <div className="classes-stat">
            <span className="classes-stat-icon"><GraduationCap className="w-4 h-4" /></span>
            <div>
              <p className="classes-stat-value">{stats.primary}</p>
              <p className="classes-stat-label">Primaire</p>
            </div>
          </div>
        </div>
      </section>

      <section className="classes-toolbar">
        <div className="classes-search">
          <Search className="w-4 h-4" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${t('ui.search')} class, grade, section, teacher…`}
          />
        </div>

        <div className="classes-segment" role="tablist" aria-label="Niveau">
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'nursery', label: 'Nursery' },
            { id: 'primary', label: 'Primaire' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={levelFilter === opt.id}
              className={`classes-segment-btn ${levelFilter === opt.id ? 'is-active' : ''}`}
              onClick={() => setLevelFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="classes-sort">
          <label htmlFor="classes-sort">Trier</label>
          <select
            id="classes-sort"
            className="input"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
          >
            <option value="grade">Niveau</option>
            <option value="name">Nom</option>
            <option value="students">Élèves</option>
          </select>
        </div>
      </section>

      <FormModeModal
        open={Boolean(formMode)}
        mode={isEditing ? 'edit' : 'create'}
        title={isEditing ? t('pageBody.classes.editTitle') : t('pageBody.classes.newTitle')}
        subtitle={isEditing ? t('pageBody.classes.editSubtitle') : t('pageBody.classes.newSubtitle')}
        context={isEditing ? `${editingClass?.grade}-${editingClass?.section}` : undefined}
        onClose={closeForm}
        onSubmit={handleSubmit}
        formId="class-form"
        submitLabel={isEditing ? t('ui.saveChanges') : t('pageBody.classes.createSubmit')}
        submitting={submitting}
        error={error}
      >
        <FormSection title={t('ui.classInformation')}>
          <div>
            <label className="label">{t('ui.class')} *</label>
            <input
              className="input"
              required
              placeholder={t('pageBody.classes.namePlaceholder')}
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                const next = { ...form, name };
                if ((/top\s*class/i.test(name.trim()) || /grande\s*section.*top/i.test(name.trim()))
                  && (!form.grade || form.grade === 'N3' || form.grade === 'M3')) {
                  next.grade = 'TOP';
                }
                setForm(next);
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Nursery: M1 (Petite), M2 (Moyenne), M3 (Grande), TOP. Primaire: P1–P6. Niveau + section uniques par année.
            </p>
          </div>
          <div>
            <label className="label">{t('ui.homeroomTeacher')}</label>
            <select
              className="input"
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
            >
              <option value="">{t('ui.none')}</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('ui.grade')} *</label>
              <input
                className="input"
                required
                placeholder={t('pageBody.classes.gradePlaceholder')}
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="label">{t('ui.section')} *</label>
              <input
                className="input"
                required
                placeholder={t('pageBody.classes.sectionPlaceholder')}
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
        </FormSection>
      </FormModeModal>

      {loading ? (
        <div className="classes-loading">
          <Loader2 className="w-7 h-7 animate-spin" />
          <p>Chargement des classes…</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="classes-empty">
          <BookOpen className="w-10 h-10 text-gray-300" />
          <p className="classes-empty-title">
            {classes.length > 0 && search.trim()
              ? t('ui.noSearchResults')
              : (isTeacher ? t('pageBody.classes.emptyTeacher') : t('pageBody.classes.emptyStaff'))}
          </p>
            {canManageClasses && !(classes.length > 0 && (search.trim() || levelFilter !== 'all')) && (
              <button type="button" onClick={openCreate} className="btn-primary mt-2 inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t('pageBody.classes.addFirst')}
              </button>
            )}
          {(search.trim() || levelFilter !== 'all') && classes.length > 0 && (
            <button
              type="button"
              className="btn-secondary mt-2 text-sm"
              onClick={() => { setSearch(''); setLevelFilter('all'); }}
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="classes-grid">
          {displayed.map((cls) => {
            const isActive = editingId === cls.id;
            const level = classLevel(cls.grade);
            return (
              <article
                key={cls.id}
                className={`classes-card ${isActive ? 'is-editing' : ''} level-${level}`}
              >
                <header className="classes-card-head">
                  <div className="classes-card-identity">
                    <span className={`classes-grade-badge level-${level}`}>
                      {cls.grade}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="classes-card-title">{cls.name}</h3>
                        {isActive && (
                          <span className="classes-editing-tag">{t('ui.editing')}</span>
                        )}
                      </div>
                      <p className="classes-card-meta">
                        {t('pageBody.classes.gradeSection', { grade: cls.grade, section: cls.section })}
                        {level === 'nursery' ? ' · Nursery' : level === 'primary' ? ' · Primaire' : ''}
                      </p>
                    </div>
                  </div>
                  {canManageClasses && (
                    <div className="classes-card-actions">
                      <button
                        type="button"
                        onClick={() => (isActive ? closeForm() : openEdit(cls))}
                        className={`classes-icon-btn ${isActive ? 'is-active' : ''}`}
                        title={t('ui.edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cls.id)}
                        className="classes-icon-btn is-danger"
                        title={t('ui.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </header>

                <div className="classes-card-body">
                  <div className="classes-info-row">
                    <span className="classes-info-label">
                      <User className="w-3.5 h-3.5" />
                      {t('ui.classTeacher')}
                    </span>
                    <span className={`classes-info-value ${cls.teacher?.name ? '' : 'is-muted'}`}>
                      {cls.teacher?.name || t('ui.notAssigned')}
                    </span>
                  </div>
                  <div className="classes-metrics">
                    <div className="classes-metric">
                      <span className="classes-metric-value is-brand">{cls._count?.students || 0}</span>
                      <span className="classes-metric-label">{t('ui.students')}</span>
                    </div>
                    <div className="classes-metric">
                      <span className="classes-metric-value">{cls._count?.subjects || 0}</span>
                      <span className="classes-metric-label">{t('ui.subjects')}</span>
                    </div>
                    <div className="classes-metric">
                      <span className="classes-metric-value">{cls.section}</span>
                      <span className="classes-metric-label">{t('ui.section')}</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
