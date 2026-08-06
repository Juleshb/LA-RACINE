import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Trash2, Paperclip, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StudentPageHeader from '../components/student/StudentPageHeader';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import AppIcon from '../components/icons/AppIcon';
import { useTranslation } from '../context/LanguageContext';
import { SortableTh, useTableSort } from '../hooks/useTableSort';

const CATEGORIES = ['Stories', 'Science', 'Math', 'Fun', 'English', 'Other'];
const LEVELS = ['Easy', 'Medium', 'Challenge'];

const EMPTY_FORM = {
  title: '', author: '', category: 'Stories', readingLevel: 'Easy',
  description: '', fileUrl: '', coverEmoji: '📖',
};

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ELibrary() {
  const { campusId } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isStudent = user?.role === 'STUDENT';
  const canManage = !['STUDENT', 'PARENT'].includes(user?.role);
  const [items, setItems] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [upload, setUpload] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const base = `/campus/${campusId}/e-library`;

  const load = () => api.getELibraryItems().then(setItems).catch(console.error);
  useEffect(() => { load(); }, []);

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))];
  const filtered = categoryFilter
    ? items.filter((i) => i.category === categoryFilter)
    : items;

  const getELibrarySortValue = useCallback((row, key) => {
    switch (key) {
      case 'title': return row.title || '';
      case 'author': return row.author || '';
      case 'category': return row.category || '';
      case 'readingLevel': return row.readingLevel || '';
      case 'file': return row.storagePath || row.fileUrl ? 1 : 0;
      default: return '';
    }
  }, []);

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    filtered,
    getELibrarySortValue,
    { initialKey: 'title' },
  );

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setUpload(null);
    setError('');
    setSubmitting(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setUpload(null);
    setShowForm(true);
  };

  const openEdit = async (id) => {
    setError('');
    try {
      const item = await api.getELibraryItem(id);
      setEditingId(id);
      setForm({
        title: item.title || '',
        author: item.author || '',
        category: item.category || 'Stories',
        readingLevel: item.readingLevel || 'Easy',
        description: item.description || '',
        fileUrl: item.fileUrl || '',
        coverEmoji: item.coverEmoji || '📖',
      });
      setUpload(null);
      setShowForm(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const contentBase64 = await readFileAsBase64(file);
      setUpload({ fileName: file.name, mimeType: file.type, contentBase64 });
    } catch {
      setError('Could not read file');
    }
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { ...form, ...upload };
      if (editingId) {
        await api.updateELibraryItem(editingId, payload);
      } else {
        await api.createELibraryItem(payload);
      }
      closeForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this book?')) return;
    try {
      await api.deleteELibraryItem(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className={isStudent ? 'student-page' : ''}>
      {isStudent ? (
        <StudentPageHeader
          icon="library"
          title={t('elibrary.title')}
          subtitle={t('elibrary.subtitle')}
          backTo={`/campus/${campusId}`}
        />
      ) : (
        <PageHeader
          title={t('pages.elibrary.title')}
          description={t('pages.elibrary.description')}
          action={canManage && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> {t('pages.elibrary.addBook')}
            </button>
          )}
        />
      )}

      {isStudent && categories.length > 0 && (
        <div className="student-category-chips mb-4">
          <button type="button" className={`student-category-chip ${!categoryFilter ? 'student-category-chip-active' : ''}`} onClick={() => setCategoryFilter('')}>
            {t('common.allBooks')}
          </button>
          {categories.map((cat) => (
            <button key={cat} type="button" className={`student-category-chip ${categoryFilter === cat ? 'student-category-chip-active' : ''}`} onClick={() => setCategoryFilter(cat)}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {canManage && (
        <FormModeModal
          open={showForm}
          mode={editingId ? 'edit' : 'create'}
          title={editingId ? 'Edit book' : 'New book'}
          subtitle={editingId ? 'Update book details or replace the file' : 'Upload a PDF or picture book for students'}
          onClose={closeForm}
          onSubmit={handleSubmit}
          formId="elibrary-form"
          submitLabel={editingId ? 'Save changes' : 'Save book'}
          submitting={submitting}
          error={error}
          size="lg"
        >
          <FormSection title="Book details">
            <div className="form-field-full md:col-span-2">
              <label className="label">Title *</label>
              <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div><label className="label">Author</label><input className="input" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Reading level</label>
              <select className="input" value={form.readingLevel} onChange={(e) => setForm({ ...form, readingLevel: e.target.value })}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="form-field-full md:col-span-2">
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-field-full md:col-span-2">
              <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer">
                <Paperclip className="w-4 h-4" />
                Upload PDF or image
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFile} />
              </label>
              {upload && <p className="text-sm text-gray-600 mt-2">{upload.fileName}</p>}
              {editingId && !upload && <p className="text-xs text-gray-500 mt-2">Leave file empty to keep the current book file.</p>}
            </div>
          </FormSection>
        </FormModeModal>
      )}

      {filtered.length === 0 ? (
        <div className={isStudent ? 'student-empty-card' : 'card text-center py-12 text-gray-500'}>
          {isStudent ? t('elibrary.noBooksFilter') : 'No e-library books yet.'}
        </div>
      ) : isStudent ? (
        <div className="student-bookshelf">
          {filtered.map((book) => (
            <Link key={book.id} to={`${base}/${book.id}`} className="student-book-spine">
              <span className="student-book-icon" aria-hidden>
                <AppIcon name="book" className="w-12 h-12" />
              </span>
              <h2 className="student-book-title">{book.title}</h2>
              {book.author && <p className="student-book-author">{t('common.byAuthor', { author: book.author })}</p>}
              <div className="student-book-tags">
                {book.category && <span>{book.category}</span>}
                {book.readingLevel && <span>{book.readingLevel}</span>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <SortableTh label="Book" columnKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="Author" columnKey="author" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="Category" columnKey="category" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="Level" columnKey="readingLevel" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  <SortableTh label="File" columnKey="file" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pb-3 font-medium" />
                  {canManage && <th className="pb-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3">
                      <Link to={`${base}/${item.id}`} className="font-medium text-brand-700 hover:underline">
                        {item.coverEmoji} {item.title}
                      </Link>
                    </td>
                    <td className="py-3">{item.author || '—'}</td>
                    <td className="py-3">{item.category || '—'}</td>
                    <td className="py-3">{item.readingLevel || '—'}</td>
                    <td className="py-3 text-sm">{item.storagePath || item.fileUrl ? 'Yes' : '—'}</td>
                    {canManage && (
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => openEdit(item.id)} className="p-1.5 text-gray-400 hover:text-brand-600" title="Edit book">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-400" title="Delete book">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
