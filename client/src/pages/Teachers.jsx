import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Edit2, CreditCard, Camera, User, X } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import PageHeader from '../components/PageHeader';
import ListSearch, { matchesSearch } from '../components/ListSearch';
import { useTranslation } from '../context/LanguageContext';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { fileToBase64, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '../config/registration';
import { SortableTh, useTableSort } from '../hooks/useTableSort';

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  identityNumber: '',
  address: '',
  qualifications: '',
  bankName: '',
  bankAccount: '',
};

export default function Teachers() {
  const { t } = useTranslation();
  const { campusId } = useCampus();
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState('');
  const [formMode, setFormMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [clearPhoto, setClearPhoto] = useState(false);
  const [photoUrls, setPhotoUrls] = useState({});
  const fileInputRef = useRef(null);

  const isEditing = formMode === 'edit';

  const loadTeachers = () => api.getTeachers().then(setTeachers).catch(console.error);

  useEffect(() => { loadTeachers(); }, []);

  // Load thumbnails for staff who have photos
  useEffect(() => {
    let cancelled = false;
    const withPhotos = teachers.filter((t) => t.hasPhoto);
    if (!withPhotos.length) {
      setPhotoUrls({});
      return undefined;
    }

    Promise.all(
      withPhotos.map(async (teacher) => {
        const url = await api.getTeacherPhotoUrl(teacher.id);
        return [teacher.id, url];
      }),
    ).then((pairs) => {
      if (cancelled) {
        pairs.forEach(([, url]) => { if (url) URL.revokeObjectURL(url); });
        return;
      }
      const next = {};
      pairs.forEach(([id, url]) => {
        if (url) next[id] = url;
      });
      setPhotoUrls((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [teachers]);

  useEffect(() => () => {
    Object.values(photoUrls).forEach((url) => URL.revokeObjectURL(url));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = useMemo(
    () => teachers.filter((teacher) => matchesSearch(
      search,
      teacher.name,
      teacher.subject,
      teacher.email,
      teacher.phone,
      teacher.identityNumber,
      teacher.address,
      teacher.qualifications,
      teacher.bankName,
      teacher.bankAccount,
    )),
    [teachers, search],
  );

  const getTeacherSortValue = useCallback((row, key) => {
    switch (key) {
      case 'name': return row.name || '';
      case 'subject': return row.subject || '';
      case 'email': return row.email || '';
      case 'phone': return row.phone || '';
      case 'classes': return row._count?.classes || 0;
      default: return '';
    }
  }, []);

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    displayed,
    getTeacherSortValue,
    { initialKey: 'name' },
  );

  const resetPhotoState = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    setClearPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormMode('create');
    setError('');
    resetPhotoState();
  };

  const openEdit = async (teacher) => {
    setForm({
      name: teacher.name,
      email: teacher.email || '',
      phone: teacher.phone || '',
      subject: teacher.subject || '',
      identityNumber: teacher.identityNumber || '',
      address: teacher.address || '',
      qualifications: teacher.qualifications || '',
      bankName: teacher.bankName || '',
      bankAccount: teacher.bankAccount || '',
    });
    setEditingId(teacher.id);
    setFormMode('edit');
    setError('');
    resetPhotoState();
    if (teacher.hasPhoto) {
      try {
        const detail = await api.getTeacher(teacher.id);
        if (detail.photoUrl) setPhotoPreview(detail.photoUrl);
      } catch {
        if (photoUrls[teacher.id]) setPhotoPreview(photoUrls[teacher.id]);
      }
    }
  };

  const closeForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormMode(null);
    setError('');
    setSubmitting(false);
    resetPhotoState();
  };

  const handlePhotoPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPEG, PNG, WebP, or GIF).');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Photo is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setError('');
    setPhotoFile(file);
    setClearPhoto(false);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setClearPhoto(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (photoFile) {
        payload.photo = {
          fileName: photoFile.name,
          mimeType: photoFile.type,
          contentBase64: await fileToBase64(photoFile),
        };
      } else if (isEditing && clearPhoto) {
        payload.clearPhoto = true;
      }

      if (isEditing) {
        await api.updateTeacher(editingId, payload);
      } else {
        await api.createTeacher(payload);
      }
      closeForm();
      loadTeachers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('pageBody.teachers.deleteConfirm'))) return;
    try {
      await api.deleteTeacher(id);
      if (editingId === id) closeForm();
      loadTeachers();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('pages.teachers.title')}
        description={t('pages.teachers.description')}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/campus/${campusId}/id-cards?tab=staff`} className="btn-secondary flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Staff cards
            </Link>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {t('pages.teachers.add')}
            </button>
          </div>
        )}
      />

      <div className="mb-6">
        <ListSearch
          value={search}
          onChange={setSearch}
          placeholder={`${t('ui.search')} name, subject, email, phone…`}
          className="max-w-md"
        />
      </div>

      <FormModeModal
        open={Boolean(formMode)}
        mode={isEditing ? 'edit' : 'create'}
        title={isEditing ? t('pageBody.teachers.editTitle') : t('pageBody.teachers.newTitle')}
        subtitle={isEditing ? t('pageBody.teachers.editSubtitle') : t('pageBody.teachers.newSubtitle')}
        onClose={closeForm}
        onSubmit={handleSubmit}
        formId="teacher-form"
        submitLabel={isEditing ? t('ui.saveChanges') : t('pageBody.teachers.addSubmit')}
        submitting={submitting}
        error={error}
      >
        <FormSection title={t('ui.personalDetails')}>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="shrink-0">
              <label className="label">Profile photo</label>
              <div className="relative w-28 h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-gray-300" />
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  className="btn-secondary text-xs inline-flex items-center gap-1 py-1.5 px-2.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {photoPreview ? 'Change' : 'Upload'}
                </button>
                {photoPreview && (
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1 py-1.5"
                    onClick={handleRemovePhoto}
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePhotoPick}
              />
              <p className="text-[11px] text-gray-400 mt-1.5">JPEG / PNG · max {MAX_FILE_SIZE_MB} MB</p>
            </div>
            <div className="flex-1 w-full space-y-4">
              <div>
                <label className="label">{t('ui.fullName')} *</label>
                <input
                  className="input"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t('ui.subjectSpecialty')}</label>
                <input
                  className="input"
                  placeholder={t('pageBody.teachers.subjectPlaceholder')}
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>
            </div>
          </div>
        </FormSection>
        <FormSection title={t('ui.contact')}>
          <div>
            <label className="label">{t('ui.email')}</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">PP / Numéro d’identité</label>
            <input
              className="input font-mono"
              value={form.identityNumber}
              onChange={(e) => setForm({ ...form, identityNumber: e.target.value })}
              placeholder="Auto-assigned if left empty"
            />
          </div>
          <div>
            <label className="label">{t('ui.phone')}</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('ui.fullAddress')}</label>
            <textarea
              className="input min-h-[72px]"
              rows={3}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder={t('pageBody.teachers.addressPlaceholder')}
            />
          </div>
        </FormSection>
        <FormSection title={t('ui.qualifications')}>
          <div>
            <label className="label">{t('ui.qualifications')}</label>
            <textarea
              className="input min-h-[72px]"
              rows={3}
              value={form.qualifications}
              onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
              placeholder={t('pageBody.teachers.qualificationsPlaceholder')}
            />
          </div>
        </FormSection>
        <FormSection title={t('ui.bankDetails')}>
          <div>
            <label className="label">{t('ui.bankName')}</label>
            <input
              className="input"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder={t('pageBody.teachers.bankNamePlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('ui.bankAccount')}</label>
            <input
              className="input font-mono"
              value={form.bankAccount}
              onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
              placeholder={t('pageBody.teachers.bankAccountPlaceholder')}
            />
          </div>
        </FormSection>
      </FormModeModal>

      <div className="card p-0 overflow-hidden">
        {displayed.length === 0 ? (
          <div className="empty-state py-16">
            <p className="text-gray-600 font-medium">
              {teachers.length > 0 && search.trim()
                ? t('ui.noSearchResults')
                : t('pageBody.teachers.empty')}
            </p>
            {!(teachers.length > 0 && search.trim()) && (
              <button onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t('pageBody.teachers.addFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <SortableTh label={t('ui.name')} columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('ui.subject')} columnKey="subject" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('ui.email')} columnKey="email" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('ui.phone')} columnKey="phone" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('ui.classes')} columnKey="classes" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="text-right">{t('ui.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((teacher) => {
                  const isActive = editingId === teacher.id;
                  const thumb = photoUrls[teacher.id];
                  return (
                    <tr key={teacher.id} className={isActive ? 'table-row-active' : ''}>
                      <td className="font-medium text-gray-900">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                            {thumb ? (
                              <img src={thumb} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-gray-400" />
                            )}
                          </span>
                          <span>
                            {teacher.name}
                            {isActive && (
                              <span className="ml-2 text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                {t('ui.editing')}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="text-gray-500">{teacher.subject || '—'}</td>
                      <td className="text-gray-500">{teacher.email || '—'}</td>
                      <td className="text-gray-500">{teacher.phone || '—'}</td>
                      <td>{teacher._count?.classes || 0}</td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Link
                            to={`/campus/${campusId}/id-cards?staff=${teacher.id}`}
                            className="p-2 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Staff card"
                          >
                            <CreditCard className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => (isActive ? closeForm() : openEdit(teacher))}
                            className={`p-2 rounded-lg transition-colors ${isActive ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:text-brand-600 hover:bg-brand-50'}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(teacher.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
