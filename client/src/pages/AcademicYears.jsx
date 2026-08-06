import { useCallback, useEffect, useState } from 'react';
import { Plus, Calendar, PlayCircle, Copy, RotateCcw } from 'lucide-react';
import { api, setActiveAcademicYear } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { useTranslation } from '../context/LanguageContext';
import { SortableTh, useTableSort } from '../hooks/useTableSort';

export default function AcademicYears() {
  const { campus, academicYear, reloadAcademicYear } = useCampus();
  const { t } = useTranslation();
  const [years, setYears] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showNewYear, setShowNewYear] = useState(false);
  const [form, setForm] = useState({ name: '2025-2026', startDate: '2025-09-01' });
  const [newYearForm, setNewYearForm] = useState({
    name: '2026-2027',
    startDate: '2026-09-01',
    copyTeachers: true,
    copyClasses: true,
    copySubjects: true,
  });
  const [copyPreview, setCopyPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activatingId, setActivatingId] = useState(null);

  const load = () => api.getAcademicYears().then(setYears).catch(console.error);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (showNewYear && academicYear?.id) {
      api.getCopyPreview(academicYear.id).then(setCopyPreview).catch(() => setCopyPreview(null));
    }
  }, [showNewYear, academicYear?.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const year = await api.createAcademicYear(form);
      setActiveAcademicYear(year.id);
      setShowForm(false);
      setMessage(`Academic year ${year.name} is now active.`);
      load();
      reloadAcademicYear();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStartNew = async (e) => {
    e.preventDefault();
    const copyParts = [];
    if (newYearForm.copyTeachers) copyParts.push('teachers');
    if (newYearForm.copyClasses) copyParts.push('classes');
    if (newYearForm.copySubjects) copyParts.push('courses');

    const copyNote = copyParts.length
      ? `\n\nCopy from ${academicYear?.name}: ${copyParts.join(', ')}.`
      : '\n\nStart with empty records (no copy).';

    if (!confirm(`Start ${newYearForm.name}? The current year will be closed.${copyNote}\n\nStudent records and student login links always start fresh.`)) return;

    setError('');
    setSubmitting(true);
    try {
      const result = await api.startNewAcademicYear({
        name: newYearForm.name,
        startDate: newYearForm.startDate,
        copyTeachers: newYearForm.copyTeachers,
        copyClasses: newYearForm.copyClasses,
        copySubjects: newYearForm.copySubjects,
      });
      setActiveAcademicYear(result.year.id);
      setShowNewYear(false);
      setMessage(result.message);
      load();
      reloadAcademicYear();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (year) => {
    const currentName = academicYear?.name || 'the current year';
    if (!confirm(
      `Activate ${year.name}?\n\n${currentName} will be deactivated (closed). You can switch back later to continue that year.\n\nTeacher and student login links will be updated for the activated year.`
    )) return;

    setError('');
    setActivatingId(year.id);
    try {
      const result = await api.activateAcademicYear(year.id);
      setActiveAcademicYear(result.year.id);
      setMessage(result.message);
      load();
      reloadAcademicYear();
    } catch (err) {
      setError(err.message);
    } finally {
      setActivatingId(null);
    }
  };

  const toggleCopy = (field) => {
    setNewYearForm((prev) => {
      const next = { ...prev, [field]: !prev[field] };
      if (field === 'copyClasses' && !next.copyClasses) {
        next.copySubjects = false;
      }
      return next;
    });
  };

  const getYearSortValue = useCallback((row, key) => {
    switch (key) {
      case 'name': return row.name || '';
      case 'period': return row.startDate ? new Date(row.startDate) : null;
      case 'status': return row.isActive ? 1 : 0;
      case 'students': return row._count?.students || 0;
      case 'teachers': return row._count?.teachers || 0;
      case 'classes': return row._count?.classes || 0;
      default: return '';
    }
  }, []);

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    years,
    getYearSortValue,
    { initialKey: 'period', initialDir: 'desc' },
  );

  return (
    <div>
      <PageHeader
        title={t('pages.academicYears.title')}
        description={t('pages.academicYears.description', { campus: campus.name })}
        action={
          !academicYear ? (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Set academic year
            </button>
          ) : (
            <button onClick={() => setShowNewYear(true)} className="btn-primary flex items-center gap-2">
              <PlayCircle className="w-4 h-4" />
              {t('pages.academicYears.start')}
            </button>
          )
        }
      />

      {message && (
        <div className="mb-6 p-4 rounded-lg text-sm bg-brand-50 text-brand-700">{message}</div>
      )}
      {error && (
        <div className="mb-6 p-4 rounded-lg text-sm bg-red-50 text-red-600">{error}</div>
      )}

      {academicYear && (
        <div className="card mb-8 border-brand-200 bg-brand-50/30">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-brand-600" />
            <div>
              <p className="text-sm text-gray-500">Current academic year</p>
              <p className="text-xl font-semibold text-gray-900">{academicYear.name}</p>
              <p className="text-sm text-gray-500">
                Started {new Date(academicYear.startDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <FormModeModal
          open={showForm}
          mode="create"
          title="Set first academic year"
          subtitle="Create and activate the first school year for this campus"
          onClose={() => { setShowForm(false); setError(''); }}
          onSubmit={handleCreate}
          formId="academic-year-form"
          submitLabel="Activate"
          error={error}
        >
          <FormSection title="Year details">
            <div>
              <label className="label">Year name *</label>
              <input className="input" required placeholder="2025-2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Start date *</label>
              <input className="input" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
          </FormSection>
        </FormModeModal>
      )}

      {showNewYear && (
        <FormModeModal
          open={showNewYear}
          mode="create"
          title="Start new academic year"
          subtitle={`Closes ${academicYear?.name}. Students always start fresh in the new year.`}
          onClose={() => { setShowNewYear(false); setError(''); }}
          onSubmit={handleStartNew}
          formId="new-academic-year-form"
          submitLabel={submitting ? 'Starting…' : 'Start new year'}
          submitting={submitting}
          error={error}
          size="xl"
        >
          <FormSection title="New year">
            <div>
              <label className="label">New year name *</label>
              <input className="input" required placeholder="2026-2027" value={newYearForm.name} onChange={(e) => setNewYearForm({ ...newYearForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Start date *</label>
              <input className="input" type="date" required value={newYearForm.startDate} onChange={(e) => setNewYearForm({ ...newYearForm, startDate: e.target.value })} />
            </div>
          </FormSection>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Copy className="w-4 h-4 text-brand-600" />
              <p className="font-medium text-gray-900">Copy from {academicYear?.name}</p>
            </div>
            {copyPreview && (
              <p className="text-xs text-gray-500 mb-3">
                Available: {copyPreview.teachers} teachers · {copyPreview.classes} classes · {copyPreview.subjects} courses
              </p>
            )}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newYearForm.copyTeachers}
                  onChange={() => toggleCopy('copyTeachers')}
                  className="mt-1 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Teachers</p>
                  <p className="text-xs text-gray-500">Copy staff profiles; re-link login accounts by email</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newYearForm.copyClasses}
                  onChange={() => toggleCopy('copyClasses')}
                  className="mt-1 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Classes</p>
                  <p className="text-xs text-gray-500">Copy grades, sections, and class teachers (if teachers copied)</p>
                </div>
              </label>
              <label className={`flex items-start gap-3 ${!newYearForm.copyClasses ? 'opacity-50' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={newYearForm.copySubjects}
                  disabled={!newYearForm.copyClasses}
                  onChange={() => toggleCopy('copySubjects')}
                  className="mt-1 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Courses & assignments</p>
                  <p className="text-xs text-gray-500">Copy subjects, assigned teachers, and periods per week</p>
                </div>
              </label>
            </div>
          </div>
        </FormModeModal>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">All academic years</h2>
        {years.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No academic year set yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <SortableTh label="Year" columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="Period" columnKey="period" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="Status" columnKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="Students" columnKey="students" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="Teachers" columnKey="teachers" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="Classes" columnKey="classes" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((y) => (
                  <tr key={y.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 font-medium">{y.name}</td>
                    <td className="py-3 text-gray-500 text-sm">
                      {new Date(y.startDate).toLocaleDateString()}
                      {y.endDate ? ` → ${new Date(y.endDate).toLocaleDateString()}` : ' → present'}
                    </td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${y.isActive ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-600'}`}>
                        {y.isActive ? 'Active' : 'Closed'}
                      </span>
                    </td>
                    <td className="py-3">{y._count?.students || 0}</td>
                    <td className="py-3">{y._count?.teachers || 0}</td>
                    <td className="py-3">{y._count?.classes || 0}</td>
                    <td className="py-3 text-right">
                      {!y.isActive && (
                        <button
                          type="button"
                          onClick={() => handleActivate(y)}
                          disabled={activatingId === y.id}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                          {activatingId === y.id ? 'Activating...' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
