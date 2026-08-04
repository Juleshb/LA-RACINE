export const PERMISSIONS = {
  DASHBOARD: 'dashboard',
  STUDENTS: 'students',
  TEACHERS: 'teachers',
  CLASSES: 'classes',
  COURSES: 'courses',
  MARKS: 'marks',
  ATTENDANCE: 'attendance',
  FEES: 'fees',
  SCHOOL: 'school',
  USERS: 'users',
  CAMPUSES: 'campuses',
  ACADEMIC_YEAR: 'academic_year',
  LIBRARY: 'library',
  E_LIBRARY: 'e_library',
  E_LEARNING: 'e_learning',
  TIMETABLE: 'timetable',
  HOMEWORK: 'homework',
  EXTRACURRICULAR: 'extracurricular',
  TRANSPORT: 'transport',
  COMMUNICATION: 'communication',
  REGISTRATION: 'registration',
  ONLINE_CLASSES: 'online_classes',
  REPORTS: 'reports',
  WEBSITE: 'website',
};

export const ROLE_LABELS = {
  SCHOOL_MANAGER: 'School Manager',
  TEACHER: 'Teacher',
  PARENT: 'Parent',
  STUDENT: 'Student',
  HEAD_OF_STUDIES: 'Head of Studies',
  HEAD_OF_DISCIPLINE: 'Head of Discipline',
  SECRETARY: 'Secretary (Admin)',
  ACCOUNTANT: 'Accountant',
  LIBRARIAN: 'Librarian',
};

const CAMPUS_ADMIN = [
  PERMISSIONS.DASHBOARD,
  PERMISSIONS.STUDENTS,
  PERMISSIONS.TEACHERS,
  PERMISSIONS.CLASSES,
  PERMISSIONS.COURSES,
  PERMISSIONS.MARKS,
  PERMISSIONS.ATTENDANCE,
  PERMISSIONS.FEES,
  PERMISSIONS.SCHOOL,
  PERMISSIONS.ACADEMIC_YEAR,
  PERMISSIONS.LIBRARY,
  PERMISSIONS.E_LIBRARY,
  PERMISSIONS.E_LEARNING,
  PERMISSIONS.TIMETABLE,
  PERMISSIONS.HOMEWORK,
  PERMISSIONS.ONLINE_CLASSES,
  PERMISSIONS.EXTRACURRICULAR,
  PERMISSIONS.TRANSPORT,
  PERMISSIONS.COMMUNICATION,
  PERMISSIONS.USERS,
  PERMISSIONS.REPORTS,
  PERMISSIONS.WEBSITE,
];

export const ROLE_PERMISSIONS = {
  SCHOOL_MANAGER: Object.values(PERMISSIONS),
  SECRETARY: CAMPUS_ADMIN,
  HEAD_OF_STUDIES: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.STUDENTS,
    PERMISSIONS.TEACHERS,
    PERMISSIONS.CLASSES,
    PERMISSIONS.COURSES,
    PERMISSIONS.MARKS,
    PERMISSIONS.ATTENDANCE,
    PERMISSIONS.SCHOOL,
    PERMISSIONS.TIMETABLE,
    PERMISSIONS.HOMEWORK,
    PERMISSIONS.ONLINE_CLASSES,
    PERMISSIONS.E_LIBRARY,
    PERMISSIONS.E_LEARNING,
    PERMISSIONS.EXTRACURRICULAR,
    PERMISSIONS.TRANSPORT,
    PERMISSIONS.COMMUNICATION,
    PERMISSIONS.REPORTS,
    PERMISSIONS.WEBSITE,
  ],
  HEAD_OF_DISCIPLINE: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.STUDENTS,
    PERMISSIONS.CLASSES,
    PERMISSIONS.ATTENDANCE,
    PERMISSIONS.SCHOOL,
    PERMISSIONS.EXTRACURRICULAR,
    PERMISSIONS.TRANSPORT,
    PERMISSIONS.COMMUNICATION,
    PERMISSIONS.REPORTS,
    PERMISSIONS.WEBSITE,
  ],
  ACCOUNTANT: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.FEES,
    PERMISSIONS.STUDENTS,
    PERMISSIONS.SCHOOL,
    PERMISSIONS.TRANSPORT,
    PERMISSIONS.COMMUNICATION,
    PERMISSIONS.REPORTS,
  ],
  LIBRARIAN: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.LIBRARY,
    PERMISSIONS.E_LIBRARY,
    PERMISSIONS.REPORTS,
  ],
  TEACHER: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.STUDENTS,
    PERMISSIONS.CLASSES,
    PERMISSIONS.COURSES,
    PERMISSIONS.MARKS,
    PERMISSIONS.ATTENDANCE,
    PERMISSIONS.TIMETABLE,
    PERMISSIONS.HOMEWORK,
    PERMISSIONS.ONLINE_CLASSES,
    PERMISSIONS.E_LIBRARY,
    PERMISSIONS.E_LEARNING,
    PERMISSIONS.EXTRACURRICULAR,
    PERMISSIONS.TRANSPORT,
    PERMISSIONS.COMMUNICATION,
  ],
  PARENT: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.REGISTRATION,
    PERMISSIONS.ATTENDANCE,
    PERMISSIONS.MARKS,
    PERMISSIONS.FEES,
    PERMISSIONS.TIMETABLE,
    PERMISSIONS.HOMEWORK,
    PERMISSIONS.E_LEARNING,
    PERMISSIONS.ONLINE_CLASSES,
    PERMISSIONS.EXTRACURRICULAR,
    PERMISSIONS.TRANSPORT,
    PERMISSIONS.COMMUNICATION,
  ],
  STUDENT: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.HOMEWORK,
    PERMISSIONS.ONLINE_CLASSES,
    PERMISSIONS.E_LIBRARY,
    PERMISSIONS.E_LEARNING,
  ],
};

export const NAV_ITEMS = [
  { to: '', permission: PERMISSIONS.DASHBOARD, icon: 'LayoutDashboard', label: 'Dashboard' },
  { to: 'reports', permission: PERMISSIONS.REPORTS, icon: 'BarChart3', label: 'Reports' },
  { to: 'communication', permission: PERMISSIONS.COMMUNICATION, icon: 'MessageSquare', label: 'Communication' },
  { to: 'students', permission: PERMISSIONS.STUDENTS, icon: 'Users', label: 'Students' },
  { to: 'teachers', permission: PERMISSIONS.TEACHERS, icon: 'GraduationCap', label: 'Teachers' },
  { to: 'classes', permission: PERMISSIONS.CLASSES, icon: 'BookOpen', label: 'Classes' },
  { to: 'courses', permission: PERMISSIONS.COURSES, icon: 'BookMarked', label: 'Courses' },
  { to: 'marks', permission: PERMISSIONS.MARKS, icon: 'Award', label: 'Marks' },
  { to: 'bulletin-report', permission: PERMISSIONS.MARKS, icon: 'FileText', label: 'Bulletin' },
  { to: 'attendance', permission: PERMISSIONS.ATTENDANCE, icon: 'ClipboardCheck', label: 'Attendance' },
  { to: 'fees', permission: PERMISSIONS.FEES, icon: 'Wallet', label: 'Fees' },
  { to: 'library', permission: PERMISSIONS.LIBRARY, icon: 'Library', label: 'Library' },
  { to: 'e-library', permission: PERMISSIONS.E_LIBRARY, icon: 'Library', label: 'E-Library' },
  { to: 'e-learning', permission: PERMISSIONS.E_LEARNING, icon: 'GraduationCap', label: 'E-Learning' },
  { to: 'timetable', permission: PERMISSIONS.TIMETABLE, icon: 'Clock', label: 'Timetable' },
  { to: 'homework', permission: PERMISSIONS.HOMEWORK, icon: 'FileText', label: 'Homework' },
  { to: 'online-classes', permission: PERMISSIONS.ONLINE_CLASSES, icon: 'Video', label: 'Online classes' },
  { to: 'extracurricular', permission: PERMISSIONS.EXTRACURRICULAR, icon: 'Sparkles', label: 'Activities' },
  { to: 'transport', permission: PERMISSIONS.TRANSPORT, icon: 'Bus', label: 'Transport' },
  { to: 'school', permission: PERMISSIONS.SCHOOL, icon: 'School', label: 'School Profile' },
  { to: 'website', permission: PERMISSIONS.WEBSITE, icon: 'Globe', label: 'Website CMS' },
  { to: 'academic-years', permission: PERMISSIONS.ACADEMIC_YEAR, icon: 'Calendar', label: 'Academic Year' },
  { to: 'users', permission: PERMISSIONS.USERS, icon: 'Shield', label: 'Users' },
];

/** Parent-facing menu — labels and routes tuned for families */
export const PARENT_NAV_ITEMS = [
  { to: '', permission: PERMISSIONS.DASHBOARD, icon: 'LayoutDashboard', label: 'Home' },
  { to: 'register-child', permission: PERMISSIONS.REGISTRATION, icon: 'FileText', label: 'Register child' },
  { to: 'child-accounts', permission: PERMISSIONS.REGISTRATION, icon: 'Shield', label: 'Child accounts' },
  { to: 'my-registrations', permission: PERMISSIONS.REGISTRATION, icon: 'ClipboardList', label: 'My applications' },
  { to: 'communication', permission: PERMISSIONS.COMMUNICATION, icon: 'MessageSquare', label: 'Messages' },
  { to: 'attendance', permission: PERMISSIONS.ATTENDANCE, icon: 'ClipboardCheck', label: 'Attendance' },
  { to: 'bulletin-report', permission: PERMISSIONS.MARKS, icon: 'Award', label: 'Report cards' },
  { to: 'homework', permission: PERMISSIONS.HOMEWORK, icon: 'BookOpen', label: 'Homework' },
  { to: 'e-learning', permission: PERMISSIONS.E_LEARNING, icon: 'GraduationCap', label: 'E-Learning' },
  { to: 'online-classes', permission: PERMISSIONS.ONLINE_CLASSES, icon: 'Video', label: 'Live classes' },
  { to: 'timetable', permission: PERMISSIONS.TIMETABLE, icon: 'Clock', label: 'Timetable' },
  { to: 'fees', permission: PERMISSIONS.FEES, icon: 'Wallet', label: 'Fees & payments' },
  { to: 'transport', permission: PERMISSIONS.TRANSPORT, icon: 'Bus', label: 'School bus' },
  { to: 'extracurricular', permission: PERMISSIONS.EXTRACURRICULAR, icon: 'Sparkles', label: 'Activities' },
];

export const PARENT_NAV_GROUPS = [
  { id: 'overview', title: 'Overview', permissions: [PERMISSIONS.DASHBOARD, PERMISSIONS.REGISTRATION] },
  { id: 'messages', title: 'Messages', permissions: [PERMISSIONS.COMMUNICATION] },
  { id: 'children', title: 'My children', permissions: [PERMISSIONS.ATTENDANCE, PERMISSIONS.MARKS, PERMISSIONS.HOMEWORK, PERMISSIONS.E_LEARNING, PERMISSIONS.TIMETABLE, PERMISSIONS.ONLINE_CLASSES] },
  { id: 'services', title: 'School services', permissions: [PERMISSIONS.FEES, PERMISSIONS.TRANSPORT, PERMISSIONS.EXTRACURRICULAR] },
];

/** Teacher-facing menu — daily classroom tools */
export const TEACHER_NAV_ITEMS = [
  { to: '', permission: PERMISSIONS.DASHBOARD, icon: 'LayoutDashboard', label: 'Home' },
  { to: 'communication', permission: PERMISSIONS.COMMUNICATION, icon: 'MessageSquare', label: 'Messages' },
  { to: 'classes', permission: PERMISSIONS.CLASSES, icon: 'BookOpen', label: 'My classes' },
  { to: 'students', permission: PERMISSIONS.STUDENTS, icon: 'Users', label: 'My students' },
  { to: 'courses', permission: PERMISSIONS.COURSES, icon: 'BookMarked', label: 'My courses' },
  { to: 'attendance', permission: PERMISSIONS.ATTENDANCE, icon: 'ClipboardCheck', label: 'Attendance' },
  { to: 'marks', permission: PERMISSIONS.MARKS, icon: 'Award', label: 'Enter marks' },
  { to: 'homework', permission: PERMISSIONS.HOMEWORK, icon: 'FileText', label: 'Homework' },
  { to: 'online-classes', permission: PERMISSIONS.ONLINE_CLASSES, icon: 'Video', label: 'Live classes' },
  { to: 'timetable', permission: PERMISSIONS.TIMETABLE, icon: 'Clock', label: 'My timetable' },
  { to: 'extracurricular', permission: PERMISSIONS.EXTRACURRICULAR, icon: 'Sparkles', label: 'Activities' },
  { to: 'transport', permission: PERMISSIONS.TRANSPORT, icon: 'Bus', label: 'Transport' },
];

export const TEACHER_NAV_GROUPS = [
  { id: 'overview', title: 'Overview', permissions: [PERMISSIONS.DASHBOARD] },
  { id: 'messages', title: 'Messages', permissions: [PERMISSIONS.COMMUNICATION] },
  { id: 'classroom', title: 'My classroom', permissions: [PERMISSIONS.CLASSES, PERMISSIONS.STUDENTS, PERMISSIONS.COURSES, PERMISSIONS.ATTENDANCE] },
  { id: 'teaching', title: 'Teaching', permissions: [PERMISSIONS.MARKS, PERMISSIONS.HOMEWORK, PERMISSIONS.ONLINE_CLASSES, PERMISSIONS.TIMETABLE] },
  { id: 'school', title: 'School', permissions: [PERMISSIONS.EXTRACURRICULAR, PERMISSIONS.TRANSPORT] },
];

/** Student-facing menu — learning resources only */
export const STUDENT_NAV_ITEMS = [
  { to: '', permission: PERMISSIONS.DASHBOARD, icon: 'LayoutDashboard', label: 'Home', shortLabel: 'Home' },
  { to: 'homework', permission: PERMISSIONS.HOMEWORK, icon: 'BookOpen', label: 'My homework', shortLabel: 'Homework' },
  { to: 'online-classes', permission: PERMISSIONS.ONLINE_CLASSES, icon: 'Video', label: 'Live classes', shortLabel: 'Live' },
  { to: 'e-library', permission: PERMISSIONS.E_LIBRARY, icon: 'Library', label: 'E-Library', shortLabel: 'E-Library' },
  { to: 'e-learning', permission: PERMISSIONS.E_LEARNING, icon: 'GraduationCap', label: 'E-Learning', shortLabel: 'Learning' },
];

export const STUDENT_NAV_GROUPS = [
  { id: 'learning', title: 'My learning', permissions: [PERMISSIONS.DASHBOARD, PERMISSIONS.HOMEWORK, PERMISSIONS.ONLINE_CLASSES, PERMISSIONS.E_LIBRARY, PERMISSIONS.E_LEARNING] },
];

const STAFF_ROLES = new Set([
  'SCHOOL_MANAGER',
  'SECRETARY',
  'HEAD_OF_STUDIES',
  'HEAD_OF_DISCIPLINE',
  'ACCOUNTANT',
  'LIBRARIAN',
]);

/** Staff / admin sidebar groups — collapsible sections */
export const ADMIN_NAV_GROUPS = [
  { id: 'overview', title: 'Overview', permissions: [PERMISSIONS.DASHBOARD, PERMISSIONS.REPORTS, PERMISSIONS.COMMUNICATION] },
  { id: 'people', title: 'People', permissions: [PERMISSIONS.STUDENTS, PERMISSIONS.TEACHERS, PERMISSIONS.USERS] },
  { id: 'classes', title: 'Classes & courses', permissions: [PERMISSIONS.CLASSES, PERMISSIONS.COURSES, PERMISSIONS.TIMETABLE] },
  { id: 'assessment', title: 'Assessment', permissions: [PERMISSIONS.MARKS, PERMISSIONS.ATTENDANCE, PERMISSIONS.HOMEWORK] },
  { id: 'digital', title: 'Digital learning', permissions: [PERMISSIONS.ONLINE_CLASSES, PERMISSIONS.E_LIBRARY, PERMISSIONS.E_LEARNING] },
  { id: 'library', title: 'Library', permissions: [PERMISSIONS.LIBRARY] },
  { id: 'activities', title: 'Activities & transport', permissions: [PERMISSIONS.EXTRACURRICULAR, PERMISSIONS.TRANSPORT] },
  { id: 'finance', title: 'Finance', permissions: [PERMISSIONS.FEES] },
  { id: 'administration', title: 'Administration', permissions: [PERMISSIONS.ACADEMIC_YEAR, PERMISSIONS.SCHOOL, PERMISSIONS.WEBSITE] },
];

/** @deprecated use ADMIN_NAV_GROUPS */
export const MANAGER_NAV_GROUPS = ADMIN_NAV_GROUPS;

export function hasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

function buildNavPath(campusId, to) {
  return campusId ? `/campus/${campusId}${to ? `/${to}` : ''}` : to;
}

export function getNavForRole(role, campusId) {
  const source = role === 'PARENT'
    ? PARENT_NAV_ITEMS
    : role === 'TEACHER'
      ? TEACHER_NAV_ITEMS
      : role === 'STUDENT'
        ? STUDENT_NAV_ITEMS
        : NAV_ITEMS;
  const base = source.filter((item) => hasPermission(role, item.permission));
  return base.map((item) => ({
    ...item,
    to: buildNavPath(campusId, item.to),
  }));
}

export function getNavGroupsForRole(role, campusId) {
  if (STAFF_ROLES.has(role)) {
    const items = NAV_ITEMS
      .filter((item) => hasPermission(role, item.permission))
      .map((item) => ({
        ...item,
        to: buildNavPath(campusId, item.to),
      }));

    return ADMIN_NAV_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      items: items.filter((item) => group.permissions.includes(item.permission)),
    })).filter((group) => group.items.length > 0);
  }

  if (role === 'PARENT') {
    const items = PARENT_NAV_ITEMS
      .filter((item) => hasPermission(role, item.permission))
      .map((item) => ({
        ...item,
        to: buildNavPath(campusId, item.to),
      }));

    return PARENT_NAV_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      items: items.filter((item) => group.permissions.includes(item.permission)),
    })).filter((group) => group.items.length > 0);
  }

  if (role === 'TEACHER') {
    const items = TEACHER_NAV_ITEMS
      .filter((item) => hasPermission(role, item.permission))
      .map((item) => ({
        ...item,
        to: buildNavPath(campusId, item.to),
      }));

    return TEACHER_NAV_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      items: items.filter((item) => group.permissions.includes(item.permission)),
    })).filter((group) => group.items.length > 0);
  }

  if (role === 'STUDENT') {
    const items = STUDENT_NAV_ITEMS
      .filter((item) => hasPermission(role, item.permission))
      .map((item) => ({
        ...item,
        to: buildNavPath(campusId, item.to),
      }));

    return STUDENT_NAV_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      items: items.filter((item) => group.permissions.includes(item.permission)),
    })).filter((group) => group.items.length > 0);
  }

  return null;
}

export function getLoginRedirect(user, defaultCampusId) {
  if (user.role === 'SCHOOL_MANAGER') return '/campuses';
  if (defaultCampusId) return `/campus/${defaultCampusId}`;
  return '/campuses';
}
