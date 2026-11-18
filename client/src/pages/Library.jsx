import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, BookMarked, BookOpen, Download, FileSpreadsheet, Library as LibraryIcon, Plus, Printer, RotateCcw, Search, Trash2,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { useTranslation } from '../context/LanguageContext';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import StudentSelect from '../components/StudentSelect';
import { studentFullName } from '../lib/studentName';
import {
  BOOK_CATEGORIES,
  RETURN_CONDITIONS,
  downloadBookTemplate,
  downloadLibraryWorkbook,
  parseBookImportFile,
} from '../lib/libraryExcel';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(iso, days) {
  const date = new Date(`${iso || todayIso()}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function showDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function isOverdue(loan) {
  return loan.status === 'ACTIVE' && loan.dueDate && new Date(loan.dueDate) < new Date();
}

const CHART = {
  available: '#0284c7',
  out: '#f59e0b',
  active: '#16a34a',
  overdue: '#e11d48',
  returned: '#7c3aed',
  bar: '#0284c7',
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="classes-chart-tooltip">
      {label && <p className="classes-chart-tooltip-label">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} className="classes-chart-tooltip-row">
          <span className="classes-chart-tooltip-dot" style={{ background: entry.color || entry.payload?.fill || entry.fill }} />
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

const emptyBook = { title: '', author: '', isbn: '', category: 'Textbook', publisher: '', copies: 1 };
const emptyLoan = {
  bookId: '',
  borrowerType: 'STUDENT',
  borrowerName: '',
  studentId: '',
  teacherId: '',
  loanedAt: todayIso(),
  dueDate: plusDays(todayIso(), 14),
};

export default function Library() {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [tab, setTab] = useState('overview');
  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState([]);
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [showBookForm, setShowBookForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [bookForm, setBookForm] = useState(emptyBook);
  const [loanForm, setLoanForm] = useState(emptyLoan);
  const [returnForm, setReturnForm] = useState(null);
  const [query, setQuery] = useState('');
  const [loanQuery, setLoanQuery] = useState('');
  const [category, setCategory] = useState('');
  const [preview, setPreview] = useState([]);
  const [importMode, setImportMode] = useState('merge');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    api.getBooks().then(setBooks).catch(console.error);
    api.getLoans().then(setLoans).catch(console.error);
    api.getLibraryStats().then(setStats).catch(console.error);
  };

  useEffect(() => {
    load();
    api.getStudents().then((rows) => setStudents(Array.isArray(rows) ? rows : [])).catch(() => {});
    api.getTeachers().then((rows) => setTeachers(Array.isArray(rows) ? rows : [])).catch(() => {});
  }, []);

  const label = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const filteredBooks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return books.filter((book) => {
      if (category && (book.category || 'Other') !== category) return false;
      if (!needle) return true;
      return `${book.title} ${book.author || ''} ${book.isbn || ''}`.toLowerCase().includes(needle);
    });
  }, [books, query, category]);

  const allActiveLoans = loans.filter((loan) => loan.status === 'ACTIVE');
  const overdueLoans = allActiveLoans.filter(isOverdue);
  const activeLoans = allActiveLoans.filter((loan) => {
    const needle = loanQuery.trim().toLowerCase();
    if (!needle) return true;
    return `${loan.borrowerName} ${loan.book?.title || ''}`.toLowerCase().includes(needle);
  });
  const returnedLoans = loans.filter((loan) => loan.status === 'RETURNED');

  const topBooks = useMemo(() => {
    const counts = new Map();
    loans.forEach((loan) => {
      const title = loan.book?.title || '—';
      counts.set(title, (counts.get(title) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [loans]);

  const booksByCategory = useMemo(() => {
    const counts = new Map();
    books.forEach((book) => {
      const name = book.category || 'Other';
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [books]);

  const borrowersByType = useMemo(() => {
    const counts = new Map();
    loans.forEach((loan) => {
      counts.set(loan.borrowerType, (counts.get(loan.borrowerType) || 0) + 1);
    });
    return [...counts.entries()];
  }, [loans]);

  const copyChart = useMemo(() => {
    const available = stats?.availableCopies ?? books.reduce((sum, book) => sum + (book.available || 0), 0);
    const total = stats?.totalCopies ?? books.reduce((sum, book) => sum + (book.copies || 0), 0);
    const onLoan = stats?.activeLoans ?? allActiveLoans.length;
    const heldBack = Math.max(0, total - available - onLoan);
    return [
      { key: 'available', name: label('pageBody.library.copiesAvailable', 'Copies available'), value: available, fill: CHART.available },
      { key: 'out', name: label('pageBody.library.copiesOut', 'Copies on loan'), value: onLoan, fill: CHART.out },
      { key: 'held', name: label('pageBody.library.copiesHeld', 'Not returned to stock'), value: heldBack, fill: '#e11d48' },
    ].filter((item) => item.value > 0);
  }, [stats, books, allActiveLoans.length, t]);

  const loanStatusChart = useMemo(() => {
    const overdue = overdueLoans.length;
    const active = Math.max(0, allActiveLoans.length - overdue);
    const returned = stats?.returnedLoans ?? returnedLoans.length;
    return [
      { key: 'active', name: t('ui.active'), value: active, fill: CHART.active },
      { key: 'overdue', name: t('ui.overdue'), value: overdue, fill: CHART.overdue },
      { key: 'returned', name: label('pageBody.library.returnsDone', 'Returns completed'), value: returned, fill: CHART.returned },
    ].filter((item) => item.value > 0);
  }, [overdueLoans.length, allActiveLoans.length, returnedLoans.length, stats, t]);

  const categoryChart = useMemo(
    () => booksByCategory.map(([name, count]) => ({ name, titles: count })),
    [booksByCategory],
  );

  const topBookChart = useMemo(
    () => topBooks.map(([title, count]) => ({
      name: title.length > 22 ? `${title.slice(0, 20)}…` : title,
      loans: count,
    })),
    [topBooks],
  );

  const monthChart = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      buckets.push({
        key: `${date.getFullYear()}-${date.getMonth()}`,
        name: date.toLocaleDateString(undefined, { month: 'short' }),
        loans: 0,
      });
    }
    loans.forEach((loan) => {
      const date = new Date(loan.loanedAt);
      if (Number.isNaN(date.getTime())) return;
      const bucket = buckets.find((item) => item.key === `${date.getFullYear()}-${date.getMonth()}`);
      if (bucket) bucket.loans += 1;
    });
    return buckets;
  }, [loans]);

  const closeBookForm = () => {
    setShowBookForm(false);
    setBookForm(emptyBook);
    setError('');
    setSubmitting(false);
  };

  const closeLoanForm = () => {
    setShowLoanForm(false);
    setLoanForm({ ...emptyLoan, loanedAt: todayIso(), dueDate: plusDays(todayIso(), 14) });
    setError('');
    setSubmitting(false);
  };

  const handleBookSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createBook(bookForm);
      closeBookForm();
      setMessage(label('pageBody.library.bookSaved', 'Book added to the catalog.'));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoanSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createLoan({
        ...loanForm,
        studentId: loanForm.studentId || null,
        teacherId: loanForm.teacherId || null,
      });
      closeLoanForm();
      setMessage(label('pageBody.library.loanSaved', 'Loan recorded.'));
      setTab('loans');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (event) => {
    event.preventDefault();
    if (!returnForm?.id) return;
    setSubmitting(true);
    setError('');
    try {
      await api.returnLoan(returnForm.id, {
        returnedAt: returnForm.returnedAt,
        condition: returnForm.condition,
        notes: returnForm.notes,
      });
      setReturnForm(null);
      setMessage(label('pageBody.library.returnSaved', 'Return recorded.'));
      setTab('returns');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    try {
      const rows = await parseBookImportFile(file);
      if (!rows.length) {
        setError(label('pageBody.library.importNone', 'No book rows were found. Use Title and Author columns.'));
        return;
      }
      setPreview(rows);
      setTab('catalog');
    } catch (err) {
      setError(err.message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await api.importBooks(preview, importMode);
      setPreview([]);
      setMessage(label('pageBody.library.imported', 'Imported {{created}} new books. Updated {{merged}}. Skipped {{skipped}}.')
        .replace('{{created}}', result.created)
        .replace('{{merged}}', result.merged)
        .replace('{{skipped}}', result.skipped));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const exportCsv = () => {
    const headers = ['Borrower', 'Type', 'Book', 'Loan date', 'Due date', 'Returned', 'Condition', 'Status'];
    const lines = [headers.join(',')];
    loans.forEach((loan) => {
      const cells = [
        loan.borrowerName,
        loan.borrowerType,
        loan.book?.title || '',
        showDate(loan.loanedAt),
        showDate(loan.dueDate),
        showDate(loan.returnedAt),
        loan.condition || '',
        isOverdue(loan) ? 'OVERDUE' : loan.status,
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`);
      lines.push(cells.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'library-loans.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const openReturn = (loan) => {
    setError('');
    setReturnForm({
      id: loan.id,
      label: `${loan.borrowerName} — ${loan.book?.title || ''}`,
      returnedAt: todayIso(),
      condition: RETURN_CONDITIONS[0],
      notes: '',
    });
  };

  const tabs = [
    ['overview', label('pageBody.library.tabOverview', 'Overview')],
    ['catalog', label('pageBody.library.tabCatalog', 'Catalog')],
    ['loans', label('pageBody.library.tabLoans', 'Loans')],
    ['returns', label('pageBody.library.tabReturns', 'Returns')],
    ['reports', label('pageBody.library.tabReports', 'Reports')],
  ];

  const categoryMax = Math.max(1, ...booksByCategory.map(([, count]) => count));
  const borrowerMax = Math.max(1, ...borrowersByType.map(([, count]) => count));

  return (
    <div className="lib-desk">
      <PageHeader
        title={t('pages.library.title')}
        description={t('pages.library.description')}
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setShowLoanForm(true); setError(''); }} className="btn-secondary flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> {t('pages.library.loanBook')}
            </button>
            <button type="button" onClick={() => { setShowBookForm(true); setError(''); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> {t('pages.library.addBook')}
            </button>
          </div>
        )}
      />

      <div className="lib-tabs" role="tablist">
        {tabs.map(([id, name]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`lib-tab ${tab === id ? 'is-on' : ''}`}
          >
            {name}
            {id === 'loans' && allActiveLoans.length > 0 ? ` ${allActiveLoans.length}` : ''}
            {id === 'overview' && overdueLoans.length > 0 ? ` ${overdueLoans.length}` : ''}
          </button>
        ))}
      </div>

      {message && <div className="mb-3 p-3 rounded-lg text-sm bg-brand-50 text-brand-700 border border-brand-100">{message}</div>}
      {error && !showBookForm && !showLoanForm && !returnForm && (
        <div className="mb-3 p-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-100">{error}</div>
      )}

      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { name: t('pageBody.library.statTitles'), value: stats.totalBooks, icon: LibraryIcon, tone: 'bg-sky-50 text-sky-700', go: 'catalog' },
            { name: t('pageBody.library.statTotalCopies'), value: stats.totalCopies, icon: BookMarked, tone: 'bg-violet-50 text-violet-700', go: 'catalog' },
            { name: t('pageBody.library.statActiveLoans'), value: stats.activeLoans, icon: BookOpen, tone: 'bg-emerald-50 text-emerald-700', go: 'loans' },
            { name: t('pageBody.library.statOverdue'), value: stats.overdueLoans, icon: AlertTriangle, tone: stats.overdueLoans ? 'bg-rose-50 text-rose-700' : 'bg-gray-100 text-gray-500', go: 'overview' },
          ].map((item) => (
            <button key={item.name} type="button" className="stat-card lib-stat" onClick={() => setTab(item.go)}>
              <span className={`lib-stat-icon ${item.tone}`}><item.icon className="w-5 h-5" /></span>
              <span>
                <span className="stat-card-label block">{item.name}</span>
                <span className="stat-card-value">{item.value}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="classes-chart-title">{label('pageBody.library.chartCopies', 'Copies on the shelf')}</h2>
            <p className="classes-chart-desc">{label('pageBody.library.chartCopiesDesc', 'Available copies, copies on loan, and copies that did not come back.')}</p>
            {!copyChart.length ? (
              <div className="classes-chart-empty">{label('pageBody.library.emptyCatalog', 'No books in the catalog yet.')}</div>
            ) : (
              <div className="classes-donut-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={copyChart} dataKey="value" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={3} stroke="none" isAnimationActive={false}>
                      {copyChart.map((entry) => <Cell key={entry.key} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="classes-donut-center">
                  <p className="classes-donut-value">{stats?.totalCopies ?? 0}</p>
                  <p className="classes-donut-caption">{t('pageBody.library.statTotalCopies')}</p>
                </div>
                <div className="classes-chart-legend">
                  {copyChart.map((item) => (
                    <div key={item.key} className="classes-chart-legend-item">
                      <span className="classes-chart-legend-dot" style={{ background: item.fill }} />
                      <span>{item.name}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="classes-chart-title">{label('pageBody.library.chartLoans', 'Loan status')}</h2>
            <p className="classes-chart-desc">{label('pageBody.library.chartLoansDesc', 'Active loans, overdue returns, and books already brought back.')}</p>
            {!loanStatusChart.length ? (
              <div className="classes-chart-empty">{label('pageBody.library.noLoans', 'No loans yet.')}</div>
            ) : (
              <div className="classes-donut-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={loanStatusChart} dataKey="value" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={3} stroke="none" isAnimationActive={false}>
                      {loanStatusChart.map((entry) => <Cell key={entry.key} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="classes-donut-center">
                  <p className="classes-donut-value">{loanStatusChart.reduce((sum, item) => sum + item.value, 0)}</p>
                  <p className="classes-donut-caption">{label('pageBody.library.chartLoanTotal', 'Loans')}</p>
                </div>
                <div className="classes-chart-legend">
                  {loanStatusChart.map((item) => (
                    <div key={item.key} className="classes-chart-legend-item">
                      <span className="classes-chart-legend-dot" style={{ background: item.fill }} />
                      <span>{item.name}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card lg:col-span-2">
            <h2 className="classes-chart-title">{label('pageBody.library.chartMonths', 'Loans over the last 6 months')}</h2>
            <p className="classes-chart-desc">{label('pageBody.library.chartMonthsDesc', 'How many books were borrowed each month.')}</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthChart} barGap={6} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} domain={[0, (max) => Math.max(1, max)]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="loans" name={label('pageBody.library.chartLoanTotal', 'Loans')} fill={CHART.bar} radius={[6, 6, 0, 0]} barSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h2 className="classes-chart-title">{label('pageBody.library.booksByCategory', 'Books by category')}</h2>
            <p className="classes-chart-desc">{label('pageBody.library.chartCategoryDesc', 'How the catalog is split across categories.')}</p>
            {!categoryChart.length ? (
              <div className="classes-chart-empty">{label('pageBody.library.emptyCatalog', 'No books in the catalog yet.')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryChart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} domain={[0, (max) => Math.max(1, max)]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="titles" name={t('pageBody.library.statTitles')} fill="#0369a1" radius={[6, 6, 0, 0]} barSize={32} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <h2 className="classes-chart-title">{label('pageBody.library.topBooks', 'Most borrowed')}</h2>
            <p className="classes-chart-desc">{label('pageBody.library.chartTopDesc', 'Titles borrowed most often, including books already returned.')}</p>
            {!topBookChart.length ? (
              <div className="classes-chart-empty">{label('pageBody.library.noLoans', 'No loans yet.')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topBookChart} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="loans" name={label('pageBody.library.chartLoanTotal', 'Loans')} fill={CHART.bar} radius={[0, 6, 6, 0]} barSize={16} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card lg:col-span-2">
            <h2 className="font-semibold mb-3">{label('pageBody.library.overdueTitle', 'Overdue returns')}</h2>
            {!overdueLoans.length ? (
              <div className="lib-empty">
                <span className="lib-empty-icon"><BookOpen className="w-5 h-5" /></span>
                <p className="text-sm">{label('pageBody.library.noOverdue', 'No overdue returns.')}</p>
              </div>
            ) : overdueLoans.map((loan) => (
              <div key={loan.id} className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{loan.book?.title}</p>
                  <p className="text-xs text-gray-500 truncate">{loan.borrowerName} · {showDate(loan.dueDate)}</p>
                </div>
                <button type="button" className="btn-secondary text-xs py-1.5" onClick={() => openReturn(loan)}>{label('pageBody.library.returnAction', 'Return')}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'catalog' && (
        <div className="space-y-4">
          <div className="card flex flex-wrap gap-2 items-center !p-4">
            <div className="lib-search">
              <Search className="w-4 h-4" />
              <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={label('pageBody.library.searchBooks', 'Search title or author')} />
            </div>
            <select className="input max-w-[180px]" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">{label('pageBody.library.allCategories', 'All categories')}</option>
              {BOOK_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button type="button" className="btn-secondary text-sm" onClick={downloadBookTemplate}>{label('pageBody.library.downloadTemplate', 'Download template')}</button>
            <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" onClick={() => fileRef.current?.click()}>
              <FileSpreadsheet className="w-4 h-4" /> {label('pageBody.library.importExcel', 'Import Excel')}
            </button>
            <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" onClick={() => downloadLibraryWorkbook({ books, loans })}>
              <Download className="w-4 h-4" /> {label('pageBody.library.exportExcel', 'Export Excel')}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
          </div>
          {preview.length > 0 && (
            <div className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{label('pageBody.library.importPreview', 'Import preview')} · {preview.length}</p>
                <select className="input max-w-xs" value={importMode} onChange={(event) => setImportMode(event.target.value)}>
                  <option value="merge">{label('pageBody.library.mergeCopies', 'Add copies when the book already exists')}</option>
                  <option value="skip">{label('pageBody.library.skipExisting', 'Skip books that already exist')}</option>
                </select>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500"><th>Title</th><th>Author</th><th>Category</th><th>Copies</th></tr></thead>
                  <tbody>
                    {preview.slice(0, 12).map((row) => (
                      <tr key={`${row.title}-${row.author}`} className="border-t border-gray-100">
                        <td className="py-1.5">{row.title}</td>
                        <td>{row.author || '—'}</td>
                        <td>{row.category}</td>
                        <td>{row.copies}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-primary text-sm" disabled={submitting} onClick={confirmImport}>{label('pageBody.library.confirmImport', 'Import books')}</button>
                <button type="button" className="btn-secondary text-sm" onClick={() => setPreview([])}>{t('ui.cancel')}</button>
              </div>
            </div>
          )}
          {!filteredBooks.length ? (
            <div className="card lib-empty">
              <span className="lib-empty-icon"><LibraryIcon className="w-5 h-5" /></span>
              <p className="text-sm">{label('pageBody.library.emptyCatalog', 'No books in the catalog yet.')}</p>
            </div>
          ) : (
            <div className="lib-book-grid">
              {filteredBooks.map((book) => {
                const ratio = book.copies ? Math.round((book.available / book.copies) * 100) : 0;
                const meter = book.available === 0 ? 'is-out' : ratio < 40 ? 'is-low' : '';
                return (
                  <article key={book.id} className="lib-book">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 leading-snug">{book.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{book.author || '—'}</p>
                      </div>
                      <button type="button" onClick={() => handleDeleteBook(book.id)} className="text-gray-300 hover:text-red-500" aria-label={t('ui.delete')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="self-start text-xs font-medium px-2 py-1 rounded-full bg-sky-50 text-sky-800">{book.category || 'Other'}</span>
                    <div className="mt-auto">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{book.available}/{book.copies} {t('ui.available').toLowerCase()}</span>
                        <span className="truncate max-w-[120px]">{book.publisher || book.isbn || ''}</span>
                      </div>
                      <div className={`lib-meter ${meter}`}><span style={{ width: `${ratio}%` }} /></div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'loans' && (
        <div className="space-y-3">
          <div className="card !p-4">
            <div className="lib-search max-w-md">
              <Search className="w-4 h-4" />
              <input className="input" value={loanQuery} onChange={(event) => setLoanQuery(event.target.value)} placeholder={label('pageBody.library.searchLoans', 'Search borrower or book')} />
            </div>
          </div>
          {!activeLoans.length ? (
            <div className="card lib-empty">
              <span className="lib-empty-icon"><BookOpen className="w-5 h-5" /></span>
              <p className="text-sm">{label('pageBody.library.noActive', 'No active loans.')}</p>
            </div>
          ) : activeLoans.map((loan) => (
            <article key={loan.id} className="card !p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{loan.book?.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{loan.borrowerName}</p>
                <p className="text-xs text-gray-400 mt-1">{loan.borrowerType} · {showDate(loan.loanedAt)} → {showDate(loan.dueDate)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isOverdue(loan) ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {isOverdue(loan) ? t('ui.overdue') : t('ui.active')}
                </span>
                <button type="button" onClick={() => openReturn(loan)} className="btn-primary text-sm inline-flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" /> {label('pageBody.library.returnAction', 'Return')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'returns' && (
        !returnedLoans.length ? (
          <div className="card lib-empty">
            <span className="lib-empty-icon"><RotateCcw className="w-5 h-5" /></span>
            <p className="text-sm">{label('pageBody.library.noReturns', 'No returns recorded yet.')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {returnedLoans.map((loan) => {
              const lost = /lost/i.test(loan.condition || '');
              const damaged = /damag/i.test(loan.condition || '');
              const tone = lost ? 'bg-rose-50 text-rose-700' : damaged ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700';
              return (
                <article key={loan.id} className="card !p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{loan.book?.title}</p>
                    <p className="text-sm text-gray-500">{loan.borrowerName}</p>
                    <p className="text-xs text-gray-400 mt-1">{showDate(loan.loanedAt)} → {showDate(loan.returnedAt)}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tone}`}>{loan.condition || label('pageBody.library.returnedOn', 'Returned')}</span>
                </article>
              );
            })}
          </div>
        )
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1.5" onClick={() => window.print()}><Printer className="w-4 h-4" /> {label('pageBody.library.print', 'Print')}</button>
            <button type="button" className="btn-secondary text-sm" onClick={exportCsv}>{label('pageBody.library.exportCsv', 'Export CSV')}</button>
            <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1.5" onClick={() => downloadLibraryWorkbook({ books, loans })}><Download className="w-4 h-4" /> {label('pageBody.library.exportExcel', 'Export Excel')}</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h2 className="font-semibold mb-1">{label('pageBody.library.booksByCategory', 'Books by category')}</h2>
              {!booksByCategory.length && <p className="text-sm text-gray-500 mt-3">{label('pageBody.library.emptyCatalog', 'No books in the catalog yet.')}</p>}
              {booksByCategory.map(([name, count]) => (
                <div key={name} className="lib-bar-row">
                  <span className="truncate">{name}</span>
                  <div className="lib-bar"><span style={{ width: `${Math.round((count / categoryMax) * 100)}%` }} /></div>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
            <div className="card">
              <h2 className="font-semibold mb-1">{label('pageBody.library.loansByType', 'Loans by borrower')}</h2>
              {!borrowersByType.length && <p className="text-sm text-gray-500 mt-3">{label('pageBody.library.noLoans', 'No loans yet.')}</p>}
              {borrowersByType.map(([name, count]) => (
                <div key={name} className="lib-bar-row">
                  <span>{name}</span>
                  <div className="lib-bar"><span style={{ width: `${Math.round((count / borrowerMax) * 100)}%` }} /></div>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">{label('pageBody.library.returnsDone', 'Returns completed')}</p>
                  <p className="text-xl font-bold mt-1">{stats?.returnedLoans ?? returnedLoans.length}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">{label('pageBody.library.copiesAvailable', 'Copies available')}</p>
                  <p className="text-xl font-bold mt-1">{stats?.availableCopies ?? '—'}</p>
                </div>
              </div>
            </div>
          </div>
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
          <div><label className="label">{t('ui.titleField')} *</label><input className="input" required value={bookForm.title} onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })} /></div>
          <div><label className="label">{t('ui.author')} *</label><input className="input" required value={bookForm.author} onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })} /></div>
          <div>
            <label className="label">{t('ui.category')}</label>
            <select className="input" value={bookForm.category} onChange={(event) => setBookForm({ ...bookForm, category: event.target.value })}>
              {BOOK_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div><label className="label">{t('ui.isbn')}</label><input className="input" value={bookForm.isbn} onChange={(event) => setBookForm({ ...bookForm, isbn: event.target.value })} /></div>
          <div><label className="label">{label('pageBody.library.publisher', 'Publisher')}</label><input className="input" value={bookForm.publisher} onChange={(event) => setBookForm({ ...bookForm, publisher: event.target.value })} /></div>
          <div><label className="label">{label('pageBody.library.copies', 'Copies')}</label><input className="input" type="number" min="1" value={bookForm.copies} onChange={(event) => setBookForm({ ...bookForm, copies: Number(event.target.value) })} /></div>
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
            <select className="input" required value={loanForm.bookId} onChange={(event) => setLoanForm({ ...loanForm, bookId: event.target.value })}>
              <option value="">{t('ui.selectBook')}</option>
              {books.filter((book) => book.available > 0).map((book) => (
                <option key={book.id} value={book.id}>{book.title} ({book.available})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('ui.borrowerType')}</label>
            <select
              className="input"
              value={loanForm.borrowerType}
              onChange={(event) => setLoanForm({ ...loanForm, borrowerType: event.target.value, borrowerName: '', studentId: '', teacherId: '' })}
            >
              <option value="STUDENT">{t('ui.student')}</option>
              <option value="TEACHER">{t('ui.teacher')}</option>
              <option value="STAFF">{label('pageBody.library.staff', 'Administration')}</option>
              <option value="PARENT">{label('pageBody.library.parent', 'Parent')}</option>
            </select>
          </div>
          {loanForm.borrowerType === 'STUDENT' && (
            <div>
              <label className="label">{t('ui.student')} *</label>
              <StudentSelect
                required
                students={students}
                value={loanForm.studentId}
                onChange={(studentId) => {
                  const student = students.find((item) => item.id === studentId);
                  const name = student ? `${studentFullName(student)}${student.class?.name ? ` — ${student.class.name}` : ''}` : '';
                  setLoanForm({ ...loanForm, studentId, borrowerName: name });
                }}
              />
            </div>
          )}
          {loanForm.borrowerType === 'TEACHER' && (
            <div>
              <label className="label">{t('ui.teacher')} *</label>
              <select
                className="input"
                required
                value={loanForm.teacherId}
                onChange={(event) => {
                  const teacher = teachers.find((item) => item.id === event.target.value);
                  setLoanForm({ ...loanForm, teacherId: event.target.value, borrowerName: teacher?.name || '' });
                }}
              >
                <option value="">{label('pageBody.library.selectTeacher', 'Select a teacher')}</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
            </div>
          )}
          {(loanForm.borrowerType === 'STAFF' || loanForm.borrowerType === 'PARENT') && (
            <div>
              <label className="label">{t('ui.borrowerName')} *</label>
              <input className="input" required value={loanForm.borrowerName} onChange={(event) => setLoanForm({ ...loanForm, borrowerName: event.target.value })} />
            </div>
          )}
          <div>
            <label className="label">{label('pageBody.library.loanDate', 'Loan date')}</label>
            <input
              className="input"
              type="date"
              value={loanForm.loanedAt}
              onChange={(event) => setLoanForm({ ...loanForm, loanedAt: event.target.value, dueDate: plusDays(event.target.value, 14) })}
            />
          </div>
          <div>
            <label className="label">{t('ui.dueDate')} *</label>
            <input className="input" type="date" required value={loanForm.dueDate} onChange={(event) => setLoanForm({ ...loanForm, dueDate: event.target.value })} />
          </div>
        </FormSection>
      </FormModeModal>

      <FormModeModal
        open={Boolean(returnForm)}
        mode="edit"
        title={label('pageBody.library.returnTitle', 'Return a book')}
        subtitle={returnForm?.label || ''}
        onClose={() => { setReturnForm(null); setError(''); }}
        onSubmit={handleReturn}
        formId="return-form"
        submitLabel={label('pageBody.library.confirmReturn', 'Confirm return')}
        submitting={submitting}
        error={error}
      >
        <FormSection title={label('pageBody.library.returnDetails', 'Return details')}>
          <div>
            <label className="label">{label('pageBody.library.returnedOn', 'Returned')}</label>
            <input className="input" type="date" value={returnForm?.returnedAt || ''} onChange={(event) => setReturnForm({ ...returnForm, returnedAt: event.target.value })} />
          </div>
          <div>
            <label className="label">{label('pageBody.library.condition', 'Condition')}</label>
            <select className="input" value={returnForm?.condition || RETURN_CONDITIONS[0]} onChange={(event) => setReturnForm({ ...returnForm, condition: event.target.value })}>
              {RETURN_CONDITIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('ui.notes')}</label>
            <input className="input" value={returnForm?.notes || ''} onChange={(event) => setReturnForm({ ...returnForm, notes: event.target.value })} />
          </div>
        </FormSection>
      </FormModeModal>
    </div>
  );
}
