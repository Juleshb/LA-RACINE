import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, BookOpen, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { SortableTh, useTableSort } from '../hooks/useTableSort';

export default function Library() {
  const { t } = useTranslation();
  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState([]);
  const [stats, setStats] = useState(null);
  const [showBookForm, setShowBookForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [bookForm, setBookForm] = useState({ title: '', author: '', isbn: '', category: '', copies: 1 });
  const [loanForm, setLoanForm] = useState({
    bookId: '', borrowerType: 'STUDENT', borrowerName: '', dueDate: '', notes: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    api.getBooks().then(setBooks).catch(console.error);
    api.getLoans().then(setLoans).catch(console.error);
    api.getLibraryStats().then(setStats).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const closeBookForm = () => {
    setShowBookForm(false);
    setBookForm({ title: '', author: '', isbn: '', category: '', copies: 1 });
    setError('');
    setSubmitting(false);
  };

  const closeLoanForm = () => {
    setShowLoanForm(false);
    setLoanForm({ bookId: '', borrowerType: 'STUDENT', borrowerName: '', dueDate: '', notes: '' });
    setError('');
    setSubmitting(false);
  };

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.createBook(bookForm);
      closeBookForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoanSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.createLoan(loanForm);
      closeLoanForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (id) => {
    try {
      await api.returnLoan(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteBook = async (id) => {
    if (!confirm(t('pageBody.library.deleteBookConfirm'))) return;
    try {
      await api.deleteBook(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const getBookSortValue = useCallback((row, key) => {
    switch (key) {
      case 'title': return row.title || '';
      case 'available': return Number(row.available) || 0;
      default: return '';
    }
  }, []);

  const getLoanSortValue = useCallback((row, key) => {
    switch (key) {
      case 'book': return row.book?.title || '';
      case 'borrower': return row.borrowerName || '';
      case 'status': {
        if (row.status === 'RETURNED') return 'returned';
        if (row.dueDate && new Date(row.dueDate) < new Date()) return 'overdue';
        return 'active';
      }
      default: return '';
    }
  }, []);

  const {
    sorted: sortedBooks,
    sortKey: bookSortKey,
    sortDir: bookSortDir,
    toggleSort: toggleBookSort,
  } = useTableSort(books, getBookSortValue, { initialKey: 'title' });

  const {
    sorted: sortedLoans,
    sortKey: loanSortKey,
    sortDir: loanSortDir,
    toggleSort: toggleLoanSort,
  } = useTableSort(loans, getLoanSortValue, { initialKey: 'book' });

  return (
    <div>
      <PageHeader
        title={t('pages.library.title')}
        description={t('pages.library.description')}
        action={(
          <div className="flex gap-2">
            <button onClick={() => { setShowLoanForm(true); setError(''); }} className="btn-secondary flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> {t('pages.library.loanBook')}
            </button>
            <button onClick={() => { setShowBookForm(true); setError(''); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> {t('pages.library.addBook')}
            </button>
          </div>
        )}
      />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            [t('pageBody.library.statTitles'), stats.totalBooks],
            [t('pageBody.library.statTotalCopies'), stats.totalCopies],
            [t('pageBody.library.statActiveLoans'), stats.activeLoans],
            [t('pageBody.library.statOverdue'), stats.overdueLoans],
          ].map(([label, value]) => (
            <div key={label} className="card text-center">
              <p className="text-2xl font-bold text-brand-600">{value}</p>
              <p className="text-sm text-gray-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      <FormModeModal
        open={showBookForm}
        mode="create"
        title={t('pageBody.library.newBookTitle')}
        subtitle={t('pageBody.library.newBookSubtitle')}
        onClose={closeBookForm}
        onSubmit={handleBookSubmit}
        formId="book-form"
        submitLabel={t('ui.saveBook')}
        submitting={submitting}
        error={error}
      >
        <FormSection title={t('ui.bookDetails')}>
          <div><label className="label">{t('ui.titleField')} *</label><input className="input" required value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} /></div>
          <div><label className="label">{t('ui.author')}</label><input className="input" value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} /></div>
          <div><label className="label">{t('ui.isbn')}</label><input className="input" value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })} /></div>
          <div><label className="label">{t('ui.category')}</label><input className="input" value={bookForm.category} onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })} /></div>
          <div><label className="label">{t('ui.copies')}</label><input className="input" type="number" min="1" value={bookForm.copies} onChange={(e) => setBookForm({ ...bookForm, copies: Number(e.target.value) })} /></div>
        </FormSection>
      </FormModeModal>

      <FormModeModal
        open={showLoanForm}
        mode="create"
        title={t('pageBody.library.loanTitle')}
        subtitle={t('pageBody.library.loanSubtitle')}
        onClose={closeLoanForm}
        onSubmit={handleLoanSubmit}
        formId="loan-form"
        submitLabel={t('ui.recordLoan')}
        submitting={submitting}
        error={error}
      >
        <FormSection title={t('ui.loanDetails')}>
          <div>
            <label className="label">{t('ui.book')} *</label>
            <select className="input" required value={loanForm.bookId} onChange={(e) => setLoanForm({ ...loanForm, bookId: e.target.value })}>
              <option value="">{t('ui.selectBook')}</option>
              {books.filter((b) => b.available > 0).map((b) => (
                <option key={b.id} value={b.id}>{b.title} ({t('pageBody.library.availableCopies', { available: b.available })})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('ui.borrowerType')}</label>
            <select className="input" value={loanForm.borrowerType} onChange={(e) => setLoanForm({ ...loanForm, borrowerType: e.target.value })}>
              <option value="STUDENT">{t('ui.student')}</option>
              <option value="TEACHER">{t('ui.teacher')}</option>
              <option value="STAFF">{t('ui.staff')}</option>
            </select>
          </div>
          <div><label className="label">{t('ui.borrowerName')} *</label><input className="input" required value={loanForm.borrowerName} onChange={(e) => setLoanForm({ ...loanForm, borrowerName: e.target.value })} /></div>
          <div><label className="label">{t('ui.dueDate')} *</label><input className="input" type="date" required value={loanForm.dueDate} onChange={(e) => setLoanForm({ ...loanForm, dueDate: e.target.value })} /></div>
        </FormSection>
      </FormModeModal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">{t('ui.catalog')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <SortableTh label={t('ui.titleField')} columnKey="title" sortKey={bookSortKey} sortDir={bookSortDir} onSort={toggleBookSort} className="pb-3 font-medium" />
                  <SortableTh label={t('ui.available')} columnKey="available" sortKey={bookSortKey} sortDir={bookSortDir} onSort={toggleBookSort} className="pb-3 font-medium" />
                  <th className="pb-3 font-medium">{t('ui.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedBooks.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3">
                      <p className="font-medium">{b.title}</p>
                      <p className="text-xs text-gray-400">{b.author || '—'} · {b.category || t('ui.general')}</p>
                    </td>
                    <td className="py-3">{b.available}/{b.copies}</td>
                    <td className="py-3">
                      <button onClick={() => handleDeleteBook(b.id)} className="p-1.5 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">{t('ui.loans')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <SortableTh label={t('ui.book')} columnKey="book" sortKey={loanSortKey} sortDir={loanSortDir} onSort={toggleLoanSort} className="pb-3 font-medium" />
                  <SortableTh label={t('ui.borrower')} columnKey="borrower" sortKey={loanSortKey} sortDir={loanSortDir} onSort={toggleLoanSort} className="pb-3 font-medium" />
                  <SortableTh label={t('ui.status')} columnKey="status" sortKey={loanSortKey} sortDir={loanSortDir} onSort={toggleLoanSort} className="pb-3 font-medium" />
                  <th className="pb-3 font-medium">{t('ui.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedLoans.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3">{l.book.title}</td>
                    <td className="py-3">
                      <p className="font-medium">{l.borrowerName}</p>
                      <p className="text-xs text-gray-400">{l.borrowerType}</p>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${l.status === 'RETURNED' ? 'bg-gray-100 text-gray-600' : new Date(l.dueDate) < new Date() ? 'bg-red-100 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
                        {l.status === 'RETURNED' ? t('ui.returned') : new Date(l.dueDate) < new Date() ? t('ui.overdue') : t('ui.active')}
                      </span>
                    </td>
                    <td className="py-3">
                      {l.status === 'ACTIVE' && (
                        <button onClick={() => handleReturn(l.id)} className="p-1.5 text-gray-400 hover:text-brand-600" title={t('ui.returnBook')}><RotateCcw className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
