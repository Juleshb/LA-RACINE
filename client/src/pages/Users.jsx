import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, UserCheck, UserX, KeyRound, Pencil, Search, Eye,
  Users as UsersIcon, GraduationCap, HeartHandshake, Briefcase,
} from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import { ROLE_LABELS, isManagerRole } from '../config/permissions';
import PageHeader from '../components/PageHeader';
import FormModeModal from '../components/form/FormModeModal';
import FormSection from '../components/form/FormSection';
import { useTranslation } from '../context/LanguageContext';
import StudentSelect from '../components/StudentSelect';
import { SortableTh, useTableSort } from '../hooks/useTableSort';

const EMPTY_FORM = {
  email: '', password: '', firstName: '', lastName: '', phone: '', role: 'TEACHER',
  teacherId: '', studentId: '', parentId: '',
};

function displayPhone(user) {
  return user.phone || user.parent?.phone || '';
}

function roleNeedsPhone(role) {
  return role !== 'STUDENT';
}

const STAFF_ROLES = Object.keys(ROLE_LABELS).filter((role) => role !== 'STUDENT' && role !== 'PARENT');

const TABS = [
  { id: 'staff', icon: Briefcase },
  { id: 'students', icon: GraduationCap },
  { id: 'parents', icon: HeartHandshake },
];

function matchesSearch(user, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    user.firstName,
    user.lastName,
    `${user.firstName || ''} ${user.lastName || ''}`,
    user.email,
    ROLE_LABELS[user.role],
    user.role,
    user.teacher?.name,
    user.student?.studentId,
    user.student?.firstName,
    user.student?.lastName,
    user.student?.class?.name,
    user.phone,
    user.parent?.phone,
    ...(user.parent?.students || []).flatMap((s) => [s.firstName, s.lastName, s.studentId, `${s.firstName} ${s.lastName}`]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function userCategory(role) {
  if (role === 'STUDENT') return 'students';
  if (role === 'PARENT') return 'parents';
  return 'staff';
}

function defaultRoleForTab(tab) {
  if (tab === 'students') return 'STUDENT';
  if (tab === 'parents') return 'PARENT';
  return 'TEACHER';
}

export default function Users() {
  const { campusId, campus } = useCampus();
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [tab, setTab] = useState('staff');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffRoleFilter, setStaffRoleFilter] = useState('all');
  const [modalMode, setModalMode] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [resetPreview, setResetPreview] = useState(null);
  const [resetViewOnly, setResetViewOnly] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = () => api.getUsers(campusId).then(setUsers).catch(console.error);

  useEffect(() => {
    if (!campusId) return;
    loadUsers();
    api.getTeachers().then(setTeachers).catch(console.error);
    api.getStudents().then(setStudents).catch(console.error);
    api.getParents(campusId).then(setParents).catch(console.error);
  }, [campusId]);

  const counts = useMemo(() => ({
    staff: users.filter((u) => userCategory(u.role) === 'staff').length,
    students: users.filter((u) => u.role === 'STUDENT').length,
    parents: users.filter((u) => u.role === 'PARENT').length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userCategory(u.role) !== tab) return false;
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (tab === 'staff' && staffRoleFilter !== 'all' && u.role !== staffRoleFilter) return false;
      return matchesSearch(u, search);
    });
  }, [users, tab, search, statusFilter, staffRoleFilter]);

  const getUserSortValue = useCallback((row, key) => {
    switch (key) {
      case 'name': return `${row.firstName || ''} ${row.lastName || ''}`.trim();
      case 'email': return row.email || '';
      case 'phone': return displayPhone(row);
      case 'role': return ROLE_LABELS[row.role] || row.role || '';
      case 'linked':
        return row.teacher?.name
          || row.student?.studentId
          || (row.parent?.students?.length ?? 0);
      case 'status': return row.isActive ? 1 : 0;
      case 'studentId': return row.student?.studentId || '';
      case 'class': return row.student?.class?.name || '';
      case 'children': {
        const kids = row.parent?.students || [];
        return kids.length
          ? kids.map((s) => `${s.firstName || ''} ${s.lastName || ''}`.trim()).join(', ')
          : '';
      }
      default: return '';
    }
  }, []);

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
    filteredUsers,
    getUserSortValue,
    { initialKey: 'name' },
  );

  const closeUserModal = () => {
    setModalMode(null);
    setEditingUser(null);
    setForm({ ...EMPTY_FORM, role: defaultRoleForTab(tab) });
    setError('');
    setSubmitting(false);
  };

  const openCreate = () => {
    setModalMode('create');
    setEditingUser(null);
    setForm({ ...EMPTY_FORM, role: defaultRoleForTab(tab) });
    setError('');
  };

  const openEdit = (user) => {
    setModalMode('edit');
    setEditingUser(user);
    setForm({
      email: user.email || '',
      password: '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: displayPhone(user),
      role: user.role || 'TEACHER',
      teacherId: user.teacherId || user.teacher?.id || '',
      studentId: user.studentId || user.student?.id || '',
      parentId: user.parentId || user.parent?.id || '',
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (roleNeedsPhone(form.role) && !form.phone.trim()) {
      setError(t('pages.users.phoneRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: form.role,
        phone: roleNeedsPhone(form.role) ? form.phone.trim() : (form.phone.trim() || null),
        campusId: isManagerRole(form.role) ? null : campusId,
        teacherId: form.role === 'TEACHER' ? (form.teacherId || null) : null,
        studentId: form.role === 'STUDENT' ? (form.studentId || null) : null,
        parentId: form.role === 'PARENT' ? (form.parentId || null) : null,
      };

      if (modalMode === 'edit' && editingUser) {
        await api.updateUser(editingUser.id, payload);
      } else {
        payload.password = form.password;
        await api.createUser(payload);
      }
      const nextTab = userCategory(form.role);
      setTab(nextTab);
      closeUserModal();
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const closeReset = () => {
    setResetUser(null);
    setResetPreview(null);
    setResetViewOnly(false);
    setError('');
    setSubmitting(false);
  };

  const handleSendResetEmail = async (e) => {
    e.preventDefault();
    if (!resetUser) return;
    setError('');
    setSubmitting(true);
    try {
      const result = await api.sendUserPasswordReset(resetUser.id);
      setResetPreview(result);
      setResetViewOnly(true);
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openViewTempPassword = async (user) => {
    setResetUser(user);
    setResetPreview(null);
    setResetViewOnly(true);
    setError('');
    setSubmitting(true);
    try {
      const result = await api.getUserPasswordReset(user.id);
      setResetPreview(result);
    } catch (err) {
      setError(err.message);
      setResetViewOnly(false);
    } finally {
      setSubmitting(false);
    }
  };

  const openSendReset = (user) => {
    setResetUser(user);
    setResetPreview(null);
    setResetViewOnly(false);
    setError('');
  };

  const toggleStatus = async (id, isActive) => {
    try {
      await api.toggleUserStatus(id, !isActive);
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('pageBody.users.deleteConfirm'))) return;
    try {
      await api.deleteUser(id);
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const parentOptions = parents.filter((p) => {
    if (!editingUser) return true;
    if (!p.user) return true;
    return p.user.id === editingUser.id;
  });

  const roleOptions = useMemo(() => {
    if (tab === 'students') return [['STUDENT', ROLE_LABELS.STUDENT]];
    if (tab === 'parents') return [['PARENT', ROLE_LABELS.PARENT]];
    return Object.entries(ROLE_LABELS).filter(([value]) => STAFF_ROLES.includes(value));
  }, [tab]);

  const createLabel = tab === 'students'
    ? t('pages.users.newStudent')
    : tab === 'parents'
      ? t('pages.users.newParent')
      : t('pages.users.newStaff');

  const emptyMessage = search.trim()
    ? t('pages.users.noSearchResults')
    : tab === 'students'
      ? t('pages.users.emptyStudents')
      : tab === 'parents'
        ? t('pages.users.emptyParents')
        : t('pages.users.emptyStaff');

  const renderActions = (u) => (
    <div className="flex gap-1 justify-end">
      <button type="button" onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-brand-600" title={t('ui.edit')}>
        <Pencil className="w-4 h-4" />
      </button>
      {u.pendingReset && (
        <button
          type="button"
          onClick={() => openViewTempPassword(u)}
          className="p-1.5 text-amber-500 hover:text-amber-700"
          title={t('pages.users.viewTempPassword')}
        >
          <Eye className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        onClick={() => openSendReset(u)}
        className="p-1.5 text-gray-400 hover:text-brand-600"
        title={t('ui.resetPassword')}
      >
        <KeyRound className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => toggleStatus(u.id, u.isActive)}
        className="p-1.5 text-gray-400 hover:text-brand-600"
        title={u.isActive ? t('ui.deactivate') : t('ui.activate')}
      >
        {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
      </button>
      <button type="button" onClick={() => handleDelete(u.id)} className="p-1.5 text-gray-400 hover:text-red-400" title={t('ui.delete')}>
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  const statusBadge = (u) => (
    <div className="flex flex-col gap-1 items-start">
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${u.isActive ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-600'}`}>
        {u.isActive ? t('ui.active') : t('ui.inactive')}
      </span>
      {u.pendingReset && (
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          {t('pages.users.pendingPasswordReset')}
        </span>
      )}
    </div>
  );

  return (
    <div className="users-page">
      <PageHeader
        title={t('pages.users.title')}
        description={t('pages.users.description', { campus: campus?.name || t('ui.thisCampus') })}
        action={(
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {createLabel}
          </button>
        )}
      />

      <div className="users-tabs" role="tablist" aria-label={t('pages.users.title')}>
        {TABS.map(({ id, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`users-tab users-tab-${id} ${active ? 'users-tab-active' : ''}`}
              onClick={() => {
                setTab(id);
                setStaffRoleFilter('all');
                setSearch('');
              }}
            >
              <Icon className="w-4 h-4" />
              <span>{t(`pages.users.tab.${id}`)}</span>
              <span className="users-tab-count">{counts[id]}</span>
            </button>
          );
        })}
      </div>

      <div className={`users-toolbar users-toolbar-${tab}`}>
        <div className="users-search-wrap">
          <Search className="users-search-icon" aria-hidden />
          <input
            className="users-search-input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(`pages.users.searchPlaceholder.${tab}`)}
            aria-label={t('pages.users.searchLabel')}
          />
        </div>
        <div className="users-filters">
          {tab === 'staff' && (
            <select
              className="input users-filter-select"
              value={staffRoleFilter}
              onChange={(e) => setStaffRoleFilter(e.target.value)}
              aria-label={t('ui.role')}
            >
              <option value="all">{t('pages.users.allStaffRoles')}</option>
              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          )}
          <select
            className="input users-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('ui.status')}
          >
            <option value="all">{t('pages.users.allStatuses')}</option>
            <option value="active">{t('ui.active')}</option>
            <option value="inactive">{t('ui.inactive')}</option>
          </select>
        </div>
      </div>

      <div className={`users-panel users-panel-${tab}`}>
        <div className="users-panel-meta">
          <UsersIcon className="w-4 h-4 text-gray-400" />
          <span>
            {t('pages.users.showingCount', { count: filteredUsers.length, total: counts[tab] })}
          </span>
        </div>

        <div className="overflow-x-auto">
          {tab === 'staff' && (
            <table className="w-full users-table">
              <thead>
                <tr>
                  <SortableTh label={t('ui.name')} columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('ui.email')} columnKey="email" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('pages.users.phone')} columnKey="phone" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('ui.role')} columnKey="role" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('pages.users.linkedProfile')} columnKey="linked" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('ui.status')} columnKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="text-right">{t('ui.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={7} className="users-empty">{emptyMessage}</td></tr>
                ) : sorted.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="users-name-cell">
                        <span className="users-avatar users-avatar-staff">
                          {(u.firstName?.[0] || '?').toUpperCase()}{(u.lastName?.[0] || '').toUpperCase()}
                        </span>
                        <span className="font-medium text-gray-900">{u.firstName} {u.lastName}</span>
                      </div>
                    </td>
                    <td className="text-gray-500">{u.email}</td>
                    <td className="text-sm text-gray-600">{displayPhone(u) || <span className="text-amber-700 text-xs">{t('pages.users.phoneMissing')}</span>}</td>
                    <td>
                      <span className="users-role-badge users-role-staff">{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td className="text-sm text-gray-500">
                      {u.teacher?.name || (u.role === 'TEACHER' ? t('pages.users.noLinkedTeacher') : '—')}
                    </td>
                    <td>{statusBadge(u)}</td>
                    <td>{renderActions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'students' && (
            <table className="w-full users-table">
              <thead>
                <tr>
                  <SortableTh label={t('ui.name')} columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('ui.email')} columnKey="email" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('pages.users.studentId')} columnKey="studentId" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('pages.users.class')} columnKey="class" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('ui.status')} columnKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="text-right">{t('ui.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={6} className="users-empty">{emptyMessage}</td></tr>
                ) : sorted.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="users-name-cell">
                        <span className="users-avatar users-avatar-student">
                          {(u.firstName?.[0] || '?').toUpperCase()}{(u.lastName?.[0] || '').toUpperCase()}
                        </span>
                        <span className="font-medium text-gray-900">{u.firstName} {u.lastName}</span>
                      </div>
                    </td>
                    <td className="text-gray-500">{u.email}</td>
                    <td>
                      {u.student?.studentId ? (
                        <code className="users-code">{u.student.studentId}</code>
                      ) : (
                        <span className="text-amber-700 text-xs">{t('pages.users.notLinked')}</span>
                      )}
                    </td>
                    <td className="text-sm text-gray-600">{u.student?.class?.name || '—'}</td>
                    <td>{statusBadge(u)}</td>
                    <td>{renderActions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'parents' && (
            <table className="w-full users-table">
              <thead>
                <tr>
                  <SortableTh label={t('ui.name')} columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('ui.email')} columnKey="email" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('pages.users.phone')} columnKey="phone" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('pages.users.children')} columnKey="children" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label={t('ui.status')} columnKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="text-right">{t('ui.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={6} className="users-empty">{emptyMessage}</td></tr>
                ) : sorted.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="users-name-cell">
                        <span className="users-avatar users-avatar-parent">
                          {(u.firstName?.[0] || '?').toUpperCase()}{(u.lastName?.[0] || '').toUpperCase()}
                        </span>
                        <span className="font-medium text-gray-900">{u.firstName} {u.lastName}</span>
                      </div>
                    </td>
                    <td className="text-gray-500">{u.email}</td>
                    <td className="text-sm text-gray-600">
                      {displayPhone(u) || <span className="text-amber-700 text-xs">{t('pages.users.phoneMissing')}</span>}
                    </td>
                    <td>
                      {u.parent?.students?.length ? (
                        <div className="users-children">
                          {u.parent.students.map((s) => (
                            <span key={s.id} className="users-child-chip">
                              {s.firstName} {s.lastName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-amber-700 text-xs">{t('pages.users.noChildren')}</span>
                      )}
                    </td>
                    <td>{statusBadge(u)}</td>
                    <td>{renderActions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <FormModeModal
        open={Boolean(modalMode)}
        mode={modalMode === 'edit' ? 'edit' : 'create'}
        title={modalMode === 'edit' ? t('pages.users.editUserTitle') : t('pages.users.newUserTitle')}
        subtitle={modalMode === 'edit' ? t('pages.users.editUserSubtitle') : t('pages.users.newUserSubtitle')}
        onClose={closeUserModal}
        onSubmit={handleSubmit}
        formId="user-form"
        submitLabel={modalMode === 'edit' ? t('ui.saveChanges') : t('ui.createUser')}
        submitting={submitting}
        error={error}
        size="lg"
      >
        <FormSection title={t('ui.accountDetails')}>
          <div>
            <label className="label">{t('ui.firstName')} *</label>
            <input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('ui.lastName')} *</label>
            <input className="input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('ui.email')} *</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          {roleNeedsPhone(form.role) && (
            <div>
              <label className="label">{t('pages.users.phone')} *</label>
              <input
                className="input"
                type="tel"
                required
                minLength={8}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="078XXXXXXX"
              />
              <p className="text-xs text-gray-500 mt-1">{t('pages.users.phoneHint')}</p>
            </div>
          )}
          {modalMode === 'create' && (
            <div>
              <label className="label">{t('ui.password')} *</label>
              <input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="text-xs text-gray-500 mt-1">{t('pages.users.passwordPolicyHint')}</p>
            </div>
          )}
          {modalMode === 'edit' && (
            <div className="form-field-full md:col-span-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900">
              {t('pages.users.editPasswordHint')}
            </div>
          )}
          <div className="form-field-full md:col-span-2">
            <label className="label">{t('ui.role')} *</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value, teacherId: '', studentId: '', parentId: '' })}
            >
              {(modalMode === 'edit' ? Object.entries(ROLE_LABELS) : roleOptions).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {form.role === 'TEACHER' && (
            <div className="form-field-full md:col-span-2">
              <label className="label">{t('ui.linkTeacherProfile')}</label>
              <select className="input" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
                <option value="">{t('ui.none')}</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
            </div>
          )}
          {form.role === 'STUDENT' && (
            <div className="form-field-full md:col-span-2">
              <label className="label">{t('ui.linkStudentRecord')}</label>
              <StudentSelect
                students={students}
                value={form.studentId}
                onChange={(studentId) => setForm({ ...form, studentId })}
                emptyLabel={t('ui.none')}
                getLabel={(s) => `${s.studentId} — ${s.firstName} ${s.lastName}`}
              />
            </div>
          )}
          {form.role === 'PARENT' && (
            <>
              <div className="form-field-full md:col-span-2 rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-sm text-brand-900">
                <p className="font-semibold mb-1">{t('pages.users.parentHelpTitle')}</p>
                <ul className="list-disc list-inside space-y-1 text-brand-800">
                  <li>{t('pages.users.parentHelp1')}</li>
                  <li>{t('pages.users.parentHelp2')}</li>
                  <li>{t('pages.users.parentHelp3')}</li>
                </ul>
              </div>
              <div className="form-field-full md:col-span-2">
                <label className="label">{t('ui.selectParentRecord')} *</label>
              <select
                className="input"
                required
                value={form.parentId || ''}
                onChange={(e) => {
                  const parentId = e.target.value;
                  const selected = parents.find((p) => p.id === parentId);
                  setForm({
                    ...form,
                    parentId,
                    phone: form.phone || selected?.phone || '',
                  });
                }}
              >
                  <option value="">{t('ui.selectParentRecord')}</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id} disabled={Boolean(p.user) && p.user.id !== editingUser?.id}>
                      {p.phone || p.id.slice(0, 8)} — {p.students.map((s) => s.firstName).join(', ') || t('ui.none')}
                      {p.user && p.user.id !== editingUser?.id ? ` (${p.user.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </FormSection>
      </FormModeModal>

      <FormModeModal
        open={Boolean(resetUser)}
        mode="edit"
        title={resetViewOnly && resetPreview ? t('pages.users.viewResetTitle') : t('pages.users.resetTitle')}
        subtitle={resetViewOnly && resetPreview ? t('pages.users.viewResetSubtitle') : t('pages.users.resetEmailSubtitle')}
        onClose={closeReset}
        onSubmit={resetPreview ? (e) => { e.preventDefault(); closeReset(); } : handleSendResetEmail}
        formId="reset-password-form"
        submitLabel={resetPreview ? t('ui.close') : t('pages.users.sendResetEmail')}
        submitting={submitting}
        error={error}
        size="lg"
      >
        {!resetPreview ? (
          <div className="space-y-3 text-sm text-gray-600">
            {resetViewOnly ? (
              <p className="text-sm text-gray-500">{t('pages.users.loadingTempPassword')}</p>
            ) : (
              <>
                <p>
                  {t('pages.users.resetEmailConfirm', {
                    name: `${resetUser?.firstName || ''} ${resetUser?.lastName || ''}`.trim(),
                    email: resetUser?.email || '',
                  })}
                </p>
                <p className="text-xs text-gray-500">{t('pages.users.resetEmailHelp')}</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg text-sm border ${resetPreview.emailSent ? 'bg-brand-50 border-brand-200 text-brand-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              {resetPreview.message}
            </div>
            {resetPreview.expiresAt && (
              <p className="text-xs text-gray-500">
                {t('pages.users.expiresAt', {
                  date: new Date(resetPreview.expiresAt).toLocaleString(),
                })}
              </p>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                {t('pages.users.emailPreviewTitle')}
              </p>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm space-y-2">
                <p><span className="text-gray-500">To:</span> <strong>{resetPreview.emailPreview?.to}</strong></p>
                <p><span className="text-gray-500">Subject:</span> {resetPreview.emailPreview?.subject}</p>
                {resetPreview.temporaryPassword && (
                  <p>
                    <span className="text-gray-500">{t('pages.users.temporaryPassword')}:</span>{' '}
                    <code className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono text-brand-800 text-base">
                      {resetPreview.temporaryPassword}
                    </code>
                  </p>
                )}
                {resetPreview.resetUrl && (
                  <p className="break-all">
                    <span className="text-gray-500">{t('pages.users.resetLink')}:</span>{' '}
                    <a href={resetPreview.resetUrl} className="text-brand-700 underline" target="_blank" rel="noreferrer">
                      {resetPreview.resetUrl}
                    </a>
                  </p>
                )}
                <pre className="mt-3 whitespace-pre-wrap text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3 max-h-64 overflow-auto">
                  {resetPreview.emailPreview?.body}
                </pre>
              </div>
            </div>
          </div>
        )}
      </FormModeModal>
    </div>
  );
}
