import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Baby,
  BookOpen,
  Download,
  GraduationCap,
  Plus,
  Search,
  Trash2,
  Edit2,
  User,
  Users,
  Layers,
  Loader2,
  X,
  School,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { matchesSearch } from '../components/ListSearch';
import { useTranslation } from '../context/LanguageContext';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import Modal from '../components/form/Modal';
import { isNurseryGrade, isPrimaryGrade } from '../lib/grades';

const EMPTY_FORM = { name: '', grade: '', section: '', teacherId: '' };
const CLASS_CAPACITY = 35;
const CHART_COLORS = {
  nursery: '#0ea5e9',
  primary: '#16a34a',
  boys: '#2563eb',
  girls: '#db2777',
  seats: '#f59e0b',
  free: '#e5e7eb',
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="classes-chart-tooltip">
      {label && <p className="classes-chart-tooltip-label">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} className="classes-chart-tooltip-row">
          <span className="classes-chart-tooltip-dot" style={{ background: entry.color || entry.fill }} />
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

function classLevel(grade) {
  if (isNurseryGrade(grade)) return 'nursery';
  if (isPrimaryGrade(grade)) return 'primary';
  return 'other';
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function genderLabel(gender, t) {
  if (gender === 'MALE') return t('ui.male');
  if (gender === 'FEMALE') return t('ui.female');
  return gender || '—';
}

function formatDob(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function downloadClassCsv(cls, students, t) {
  const headers = [
    'S/N',
    t('ui.studentId'),
    t('ui.lastName'),
    t('ui.postName'),
    t('ui.firstName'),
    t('ui.dateOfBirth'),
    t('ui.gender'),
    t('ui.fatherName'),
    t('ui.motherName'),
    t('ui.status'),
    t('ui.phone'),
  ];
  const lines = [headers.map(csvEscape).join(',')];
  (students || []).forEach((s, i) => {
    const phone = s.parentPhone || s.fatherPhone || s.motherPhone || '';
    lines.push([
      i + 1,
      s.studentId,
      s.lastName,
      s.postName || '',
      s.firstName,
      formatDob(s.dateOfBirth),
      s.gender,
      s.fatherName || '',
      s.motherName || '',
      s.registrationStatus,
      phone,
    ].map(csvEscape).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safe = String(cls.name || 'class').replace(/[^\w\-]+/g, '_');
  a.download = `students-${safe}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Classes() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isTeacher = user?.role === 'TEACHER';
  const canManageClasses = !['TEACHER', 'ACCOUNTANT', 'ACTIVITIES_MANAGER', 'PARENT', 'STUDENT'].includes(user?.role);
  const canTransfer = canManageClasses;
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

  const [detailClass, setDetailClass] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailMessage, setDetailMessage] = useState('');
  const [detailSearch, setDetailSearch] = useState('');
  const [transferStudentId, setTransferStudentId] = useState('');
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [exportingId, setExportingId] = useState(null);

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

  const schoolStats = useMemo(() => {
    const empty = {
      classes: 0,
      nurseryClasses: 0,
      primaryClasses: 0,
      otherClasses: 0,
      students: 0,
      nurseryStudents: 0,
      primaryStudents: 0,
      otherStudents: 0,
      boys: 0,
      girls: 0,
      nurseryBoys: 0,
      nurseryGirls: 0,
      primaryBoys: 0,
      primaryGirls: 0,
      courses: 0,
      remaining: 0,
      capacity: 0,
      fullClasses: 0,
      fillRate: 0,
    };

    const next = { ...empty };
    for (const cls of classes) {
      const level = classLevel(cls.grade);
      const s = {
        students: cls.stats?.students ?? cls._count?.students ?? 0,
        boys: cls.stats?.boys ?? 0,
        girls: cls.stats?.girls ?? 0,
        courses: cls.stats?.courses ?? cls._count?.subjects ?? 0,
        remaining: cls.stats?.remaining ?? Math.max(0, CLASS_CAPACITY - (cls._count?.students || 0)),
        capacity: cls.stats?.capacity ?? CLASS_CAPACITY,
      };

      next.classes += 1;
      next.students += s.students;
      next.boys += s.boys;
      next.girls += s.girls;
      next.courses += s.courses;
      next.remaining += s.remaining;
      next.capacity += s.capacity;
      if (s.remaining <= 0) next.fullClasses += 1;

      if (level === 'nursery') {
        next.nurseryClasses += 1;
        next.nurseryStudents += s.students;
        next.nurseryBoys += s.boys;
        next.nurseryGirls += s.girls;
      } else if (level === 'primary') {
        next.primaryClasses += 1;
        next.primaryStudents += s.students;
        next.primaryBoys += s.boys;
        next.primaryGirls += s.girls;
      } else {
        next.otherClasses += 1;
        next.otherStudents += s.students;
      }
    }

    next.fillRate = next.capacity > 0
      ? Math.round((next.students / next.capacity) * 100)
      : 0;
    return next;
  }, [classes]);

  const levelChartData = useMemo(() => ([
    {
      key: 'nursery',
      name: t('pageBody.classes.nursery'),
      classes: schoolStats.nurseryClasses,
      students: schoolStats.nurseryStudents,
      boys: schoolStats.nurseryBoys,
      girls: schoolStats.nurseryGirls,
    },
    {
      key: 'primary',
      name: t('pageBody.classes.primary'),
      classes: schoolStats.primaryClasses,
      students: schoolStats.primaryStudents,
      boys: schoolStats.primaryBoys,
      girls: schoolStats.primaryGirls,
    },
  ]), [schoolStats, t]);

  const genderChartData = useMemo(() => ([
    { key: 'boys', name: t('pageBody.classes.boys'), value: schoolStats.boys },
    { key: 'girls', name: t('pageBody.classes.girls'), value: schoolStats.girls },
  ]).filter((item) => item.value > 0), [schoolStats, t]);

  const occupancyChartData = useMemo(() => ([
    { key: 'used', name: t('pageBody.classes.seatsUsed'), value: schoolStats.students },
    { key: 'free', name: t('pageBody.classes.remaining'), value: schoolStats.remaining },
  ]).filter((item) => item.value > 0), [schoolStats, t]);

  const gradeChartData = useMemo(() => {
    const byGrade = new Map();
    for (const cls of classes) {
      const grade = cls.grade || '?';
      const students = cls.stats?.students ?? cls._count?.students ?? 0;
      const prev = byGrade.get(grade) || { grade, students: 0, classes: 0 };
      prev.students += students;
      prev.classes += 1;
      byGrade.set(grade, prev);
    }
    return [...byGrade.values()]
      .sort((a, b) => String(a.grade).localeCompare(String(b.grade), 'fr', { numeric: true }))
      .map((row) => ({
        ...row,
        name: row.grade,
      }));
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
        const as = a.stats?.students ?? a._count?.students ?? 0;
        const bs = b.stats?.students ?? b._count?.students ?? 0;
        return bs - as;
      }
      const g = String(a.grade || '').localeCompare(String(b.grade || ''), 'fr', { sensitivity: 'base' });
      if (g !== 0) return g;
      const s = String(a.section || '').localeCompare(String(b.section || ''), 'fr', { sensitivity: 'base' });
      if (s !== 0) return s;
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' });
    });

    return list;
  }, [classes, search, levelFilter, sortKey]);

  const transferTargets = useMemo(() => {
    if (!detailClass) return [];
    return classes
      .filter((c) => c.id !== detailClass.id)
      .filter((c) => (c.stats?.remaining ?? CLASS_CAPACITY) > 0 || transferTargetId === c.id);
  }, [classes, detailClass, transferTargetId]);

  const filteredDetailStudents = useMemo(() => {
    const list = detailClass?.students || [];
    if (!detailSearch.trim()) return list;
    return list.filter((s) => matchesSearch(
      detailSearch,
      s.studentId,
      s.lastName,
      s.postName,
      s.firstName,
      s.gender,
      s.registrationStatus,
      s.parentPhone,
      s.fatherPhone,
      s.motherPhone,
    ));
  }, [detailClass, detailSearch]);

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
      if (detailClass?.id === id) closeDetail();
      loadClasses();
    } catch (err) {
      alert(err.message);
    }
  };

  const openDetail = async (cls) => {
    setDetailError('');
    setDetailMessage('');
    setDetailSearch('');
    setTransferStudentId('');
    setTransferTargetId('');
    setDetailLoading(true);
    setDetailClass({ ...cls, students: [] });
    try {
      const full = await api.getClass(cls.id);
      setDetailClass(full);
    } catch (err) {
      setDetailError(err.message || t('pageBody.classes.loadStudentsError'));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailClass(null);
    setDetailError('');
    setDetailMessage('');
    setDetailSearch('');
    setTransferStudentId('');
    setTransferTargetId('');
    setDetailLoading(false);
    setTransferring(false);
  };

  const refreshDetail = async (classId) => {
    const full = await api.getClass(classId);
    setDetailClass(full);
    await loadClasses();
  };

  const handleExport = async (cls) => {
    setExportingId(cls.id);
    try {
      const full = await api.getClass(cls.id);
      downloadClassCsv(full, full.students || [], t);
    } catch (err) {
      alert(err.message);
    } finally {
      setExportingId(null);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!transferStudentId || !transferTargetId) return;
    setTransferring(true);
    setDetailError('');
    setDetailMessage('');
    try {
      const result = await api.changeStudentClass(transferStudentId, { classId: transferTargetId });
      setDetailMessage(result.message || t('pageBody.classes.transferSuccess'));
      setTransferStudentId('');
      setTransferTargetId('');
      if (detailClass?.id) await refreshDetail(detailClass.id);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setTransferring(false);
    }
  };

  const classStats = (cls) => ({
    capacity: cls.stats?.capacity ?? CLASS_CAPACITY,
    students: cls.stats?.students ?? cls._count?.students ?? 0,
    remaining: cls.stats?.remaining ?? Math.max(0, CLASS_CAPACITY - (cls._count?.students || 0)),
    boys: cls.stats?.boys ?? 0,
    girls: cls.stats?.girls ?? 0,
    courses: cls.stats?.courses ?? cls._count?.subjects ?? 0,
  });

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
            {isTeacher ? t('pageBody.classes.kickerTeacher') : t('pageBody.classes.kickerSchool')}
          </p>
          <h2 className="classes-hero-title">
            {isTeacher ? t('pageBody.classes.overviewTeacher') : t('pageBody.classes.overviewSchool')}
          </h2>
          <p className="classes-hero-text">
            {t('pageBody.classes.heroCapacity', { capacity: CLASS_CAPACITY })}
          </p>
        </div>

        <div className="classes-overview-grid">
          <div className="classes-stat">
            <span className="classes-stat-icon"><Layers className="w-4 h-4" /></span>
            <div>
              <p className="classes-stat-value">{schoolStats.classes}</p>
              <p className="classes-stat-label">{t('pageBody.classes.totalClasses')}</p>
              <p className="classes-stat-sub">
                {t('pageBody.classes.classesSplit', {
                  nursery: schoolStats.nurseryClasses,
                  primary: schoolStats.primaryClasses,
                })}
              </p>
            </div>
          </div>
          <div className="classes-stat">
            <span className="classes-stat-icon"><Users className="w-4 h-4" /></span>
            <div>
              <p className="classes-stat-value">{schoolStats.students}</p>
              <p className="classes-stat-label">{t('pageBody.classes.totalStudents')}</p>
              <p className="classes-stat-sub">
                {t('pageBody.classes.studentsSplit', {
                  nursery: schoolStats.nurseryStudents,
                  primary: schoolStats.primaryStudents,
                })}
              </p>
            </div>
          </div>
          <div className="classes-stat">
            <span className="classes-stat-icon"><Baby className="w-4 h-4" /></span>
            <div>
              <p className="classes-stat-value">{schoolStats.nurseryStudents}</p>
              <p className="classes-stat-label">{t('pageBody.classes.nurseryStudents')}</p>
              <p className="classes-stat-sub">
                {t('pageBody.classes.genderSplit', {
                  boys: schoolStats.nurseryBoys,
                  girls: schoolStats.nurseryGirls,
                })}
              </p>
            </div>
          </div>
          <div className="classes-stat">
            <span className="classes-stat-icon"><GraduationCap className="w-4 h-4" /></span>
            <div>
              <p className="classes-stat-value">{schoolStats.primaryStudents}</p>
              <p className="classes-stat-label">{t('pageBody.classes.primaryStudents')}</p>
              <p className="classes-stat-sub">
                {t('pageBody.classes.genderSplit', {
                  boys: schoolStats.primaryBoys,
                  girls: schoolStats.primaryGirls,
                })}
              </p>
            </div>
          </div>
          <div className="classes-stat">
            <span className="classes-stat-icon is-boys"><User className="w-4 h-4" /></span>
            <div>
              <p className="classes-stat-value">{schoolStats.boys}</p>
              <p className="classes-stat-label">{t('pageBody.classes.totalBoys')}</p>
            </div>
          </div>
          <div className="classes-stat">
            <span className="classes-stat-icon is-girls"><User className="w-4 h-4" /></span>
            <div>
              <p className="classes-stat-value">{schoolStats.girls}</p>
              <p className="classes-stat-label">{t('pageBody.classes.totalGirls')}</p>
            </div>
          </div>
          <div className="classes-stat">
            <span className="classes-stat-icon"><School className="w-4 h-4" /></span>
            <div>
              <p className="classes-stat-value">{schoolStats.fillRate}%</p>
              <p className="classes-stat-label">{t('pageBody.classes.fillRate')}</p>
              <p className="classes-stat-sub">
                {t('pageBody.classes.seatsSummary', {
                  used: schoolStats.students,
                  capacity: schoolStats.capacity,
                  remaining: schoolStats.remaining,
                })}
              </p>
            </div>
          </div>
          <div className="classes-stat">
            <span className="classes-stat-icon"><BookOpen className="w-4 h-4" /></span>
            <div>
              <p className="classes-stat-value">{schoolStats.courses}</p>
              <p className="classes-stat-label">{t('pageBody.classes.totalCourses')}</p>
              <p className="classes-stat-sub">
                {t('pageBody.classes.fullClassesCount', { count: schoolStats.fullClasses })}
              </p>
            </div>
          </div>
        </div>

        <div className="classes-charts">
          <div className="classes-chart-card">
            <h3 className="classes-chart-title">{t('pageBody.classes.chartStudentsByLevel')}</h3>
            <p className="classes-chart-desc">{t('pageBody.classes.chartStudentsByLevelDesc')}</p>
            {schoolStats.students === 0 ? (
              <div className="classes-chart-empty">{t('pageBody.classes.chartEmpty')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={levelChartData} barGap={6} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="students" name={t('ui.students')} radius={[6, 6, 0, 0]} barSize={36}>
                    {levelChartData.map((entry) => (
                      <Cell key={entry.key} fill={CHART_COLORS[entry.key]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="classes-chart-card">
            <h3 className="classes-chart-title">{t('pageBody.classes.chartGender')}</h3>
            <p className="classes-chart-desc">{t('pageBody.classes.chartGenderDesc')}</p>
            {genderChartData.length === 0 ? (
              <div className="classes-chart-empty">{t('pageBody.classes.chartEmpty')}</div>
            ) : (
              <div className="classes-donut-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={genderChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={74}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {genderChartData.map((entry) => (
                        <Cell key={entry.key} fill={CHART_COLORS[entry.key]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="classes-donut-center">
                  <p className="classes-donut-value">{schoolStats.students}</p>
                  <p className="classes-donut-caption">{t('ui.students')}</p>
                </div>
                <div className="classes-chart-legend">
                  {genderChartData.map((item) => (
                    <div key={item.key} className="classes-chart-legend-item">
                      <span className="classes-chart-legend-dot" style={{ background: CHART_COLORS[item.key] }} />
                      <span>{item.name}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="classes-chart-card">
            <h3 className="classes-chart-title">{t('pageBody.classes.chartOccupancy')}</h3>
            <p className="classes-chart-desc">{t('pageBody.classes.chartOccupancyDesc')}</p>
            {occupancyChartData.length === 0 ? (
              <div className="classes-chart-empty">{t('pageBody.classes.chartEmpty')}</div>
            ) : (
              <div className="classes-donut-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={occupancyChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={74}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {occupancyChartData.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill={entry.key === 'used' ? CHART_COLORS.seats : CHART_COLORS.free}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="classes-donut-center">
                  <p className="classes-donut-value">{schoolStats.fillRate}%</p>
                  <p className="classes-donut-caption">{t('pageBody.classes.fillRate')}</p>
                </div>
                <div className="classes-chart-legend">
                  {occupancyChartData.map((item) => (
                    <div key={item.key} className="classes-chart-legend-item">
                      <span
                        className="classes-chart-legend-dot"
                        style={{ background: item.key === 'used' ? CHART_COLORS.seats : CHART_COLORS.free }}
                      />
                      <span>{item.name}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="classes-chart-card classes-chart-card-wide">
            <h3 className="classes-chart-title">{t('pageBody.classes.chartByGrade')}</h3>
            <p className="classes-chart-desc">{t('pageBody.classes.chartByGradeDesc')}</p>
            {gradeChartData.length === 0 ? (
              <div className="classes-chart-empty">{t('pageBody.classes.chartEmpty')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={gradeChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="students"
                    name={t('ui.students')}
                    fill="#0f766e"
                    radius={[6, 6, 0, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
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

      <Modal open={Boolean(detailClass)} onClose={closeDetail} size="xl">
        {detailClass && (
          <div className="classes-detail">
            <div className="classes-detail-header">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                  {t('pageBody.classes.gradeSection', { grade: detailClass.grade, section: detailClass.section })}
                </p>
                <h2 className="text-lg font-bold text-gray-900 truncate">{detailClass.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {t('pageBody.classes.capacityLabel', {
                    students: classStats(detailClass).students,
                    capacity: classStats(detailClass).capacity,
                    remaining: classStats(detailClass).remaining,
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-1.5"
                  disabled={detailLoading || exportingId === detailClass.id}
                  onClick={() => handleExport(detailClass)}
                >
                  {exportingId === detailClass.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Download className="w-4 h-4" />}
                  {t('pageBody.classes.exportList')}
                </button>
                <button type="button" onClick={closeDetail} className="classes-icon-btn" aria-label={t('ui.close')}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="classes-metrics classes-metrics-wide">
              <div className="classes-metric">
                <span className="classes-metric-value is-brand">{classStats(detailClass).students}</span>
                <span className="classes-metric-label">{t('pageBody.classes.inClass')}</span>
              </div>
              <div className="classes-metric">
                <span className={`classes-metric-value ${classStats(detailClass).remaining === 0 ? 'is-full' : ''}`}>
                  {classStats(detailClass).remaining}
                </span>
                <span className="classes-metric-label">{t('pageBody.classes.remaining')}</span>
              </div>
              <div className="classes-metric">
                <span className="classes-metric-value">{classStats(detailClass).boys}</span>
                <span className="classes-metric-label">{t('pageBody.classes.boys')}</span>
              </div>
              <div className="classes-metric">
                <span className="classes-metric-value">{classStats(detailClass).girls}</span>
                <span className="classes-metric-label">{t('pageBody.classes.girls')}</span>
              </div>
              <div className="classes-metric">
                <span className="classes-metric-value">{classStats(detailClass).courses}</span>
                <span className="classes-metric-label">{t('pageBody.classes.courses')}</span>
              </div>
            </div>

            {detailMessage && (
              <div className="mx-5 mt-3 p-3 rounded-lg text-sm bg-brand-50 text-brand-700 border border-brand-100">
                {detailMessage}
              </div>
            )}
            {detailError && (
              <div className="mx-5 mt-3 p-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-100">
                {detailError}
              </div>
            )}

            {canTransfer && (
              <form onSubmit={handleTransfer} className="classes-transfer-bar">
                <div className="classes-transfer-field">
                  <label className="label">{t('pageBody.classes.transferStudent')}</label>
                  <select
                    className="input"
                    value={transferStudentId}
                    onChange={(e) => setTransferStudentId(e.target.value)}
                    required
                  >
                    <option value="">{t('pageBody.classes.selectStudent')}</option>
                    {(detailClass.students || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.lastName} {s.postName} {s.firstName} ({s.studentId})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="classes-transfer-field">
                  <label className="label">{t('pageBody.classes.transferTo')}</label>
                  <select
                    className="input"
                    value={transferTargetId}
                    onChange={(e) => setTransferTargetId(e.target.value)}
                    required
                  >
                    <option value="">{t('pageBody.classes.selectClass')}</option>
                    {transferTargets.map((c) => {
                      const s = classStats(c);
                      return (
                        <option key={c.id} value={c.id} disabled={s.remaining <= 0}>
                          {c.name} ({s.students}/{s.capacity})
                          {s.remaining <= 0 ? ` — ${t('pageBody.classes.full')}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn-primary inline-flex items-center gap-1.5 self-end"
                  disabled={transferring || !transferStudentId || !transferTargetId}
                >
                  {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  {t('pageBody.classes.transfer')}
                </button>
              </form>
            )}

            <div className="classes-detail-table-wrap">
              <div className="classes-detail-search">
                <Search className="w-4 h-4" />
                <input
                  type="search"
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  placeholder={t('pageBody.classes.searchStudents')}
                  aria-label={t('pageBody.classes.searchStudents')}
                />
                {detailSearch.trim() && (
                  <span className="classes-detail-search-count">
                    {filteredDetailStudents.length}/{detailClass.students?.length || 0}
                  </span>
                )}
              </div>
              {detailLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('ui.loading')}
                </div>
              ) : !(detailClass.students || []).length ? (
                <p className="text-center text-gray-500 py-12">{t('pageBody.classes.noStudents')}</p>
              ) : filteredDetailStudents.length === 0 ? (
                <p className="text-center text-gray-500 py-12">{t('ui.noSearchResults')}</p>
              ) : (
                <table className="classes-detail-table">
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>{t('ui.studentId')}</th>
                      <th>{t('ui.lastName')}</th>
                      <th>{t('ui.postName')}</th>
                      <th>{t('ui.firstName')}</th>
                      <th>{t('ui.gender')}</th>
                      <th>{t('ui.status')}</th>
                      <th>{t('ui.phone')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDetailStudents.map((s, i) => (
                      <tr key={s.id}>
                        <td>{i + 1}</td>
                        <td className="font-mono text-xs">{s.studentId}</td>
                        <td className="font-medium text-gray-900">{s.lastName || '—'}</td>
                        <td>{s.postName || '—'}</td>
                        <td>{s.firstName || '—'}</td>
                        <td>{genderLabel(s.gender, t)}</td>
                        <td>
                          <span className="classes-status-pill">{s.registrationStatus}</span>
                        </td>
                        <td className="text-gray-500 text-xs">
                          {s.parentPhone || s.fatherPhone || s.motherPhone || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>

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
            const s = classStats(cls);
            const isFull = s.remaining <= 0;
            return (
              <article
                key={cls.id}
                className={`classes-card ${isActive ? 'is-editing' : ''} level-${level} ${isFull ? 'is-full' : ''}`}
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
                        {isFull && (
                          <span className="classes-full-tag">{t('pageBody.classes.full')}</span>
                        )}
                      </div>
                      <p className="classes-card-meta">
                        {t('pageBody.classes.gradeSection', { grade: cls.grade, section: cls.section })}
                        {level === 'nursery' ? ' · Nursery' : level === 'primary' ? ' · Primaire' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="classes-card-actions">
                    <button
                      type="button"
                      onClick={() => handleExport(cls)}
                      className="classes-icon-btn"
                      title={t('pageBody.classes.exportList')}
                      disabled={exportingId === cls.id}
                    >
                      {exportingId === cls.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Download className="w-4 h-4" />}
                    </button>
                    {canManageClasses && (
                      <>
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
                      </>
                    )}
                  </div>
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
                  <div className="classes-metrics classes-metrics-6">
                    <div className="classes-metric">
                      <span className="classes-metric-value is-brand">{s.students}/{s.capacity}</span>
                      <span className="classes-metric-label">{t('pageBody.classes.inClass')}</span>
                    </div>
                    <div className="classes-metric">
                      <span className={`classes-metric-value ${isFull ? 'is-full' : ''}`}>{s.remaining}</span>
                      <span className="classes-metric-label">{t('pageBody.classes.remaining')}</span>
                    </div>
                    <div className="classes-metric">
                      <span className="classes-metric-value">{s.boys}</span>
                      <span className="classes-metric-label">{t('pageBody.classes.boys')}</span>
                    </div>
                    <div className="classes-metric">
                      <span className="classes-metric-value">{s.girls}</span>
                      <span className="classes-metric-label">{t('pageBody.classes.girls')}</span>
                    </div>
                    <div className="classes-metric">
                      <span className="classes-metric-value">{s.courses}</span>
                      <span className="classes-metric-label">{t('pageBody.classes.courses')}</span>
                    </div>
                    <div className="classes-metric">
                      <span className="classes-metric-value">{cls.section}</span>
                      <span className="classes-metric-label">{t('ui.section')}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="classes-open-btn"
                    onClick={() => openDetail(cls)}
                  >
                    <Users className="w-4 h-4" />
                    {t('pageBody.classes.viewStudents')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
