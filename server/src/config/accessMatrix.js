/** Staff permission matrix from the school access design.
 * Rights are stored per campus and per role. Every user with that role inherits them.
 * Parent, student, and school admin accounts stay on the built-in access list.
 */
export const MATRIX_ROLES = [
  'SCHOOL_MANAGER',
  'TEACHER',
  'HEAD_OF_STUDIES',
  'HEAD_OF_DISCIPLINE',
  'SECRETARY',
  'ACCOUNTANT',
  'ACTIVITIES_MANAGER',
  'LIBRARIAN',
  'INVENTORY_MANAGER',
];

export const MATRIX_MODULES = [
  { id: 'dashboard', label: 'Dashboard', description: 'Home and statistics', extras: ['EXPORT'], permissions: ['dashboard'] },
  { id: 'people', label: 'People', description: 'Students, parents, and staff', extras: ['EXPORT', 'PRINT'], permissions: ['students', 'teachers'] },
  { id: 'classes', label: 'Classes & Courses', description: 'Classes, subjects, and timetable', extras: ['ASSIGN'], permissions: ['classes', 'courses', 'timetable'] },
  { id: 'evaluation', label: 'Evaluation', description: 'Marks, attendance, and report cards', extras: ['VALIDATE', 'PUBLISH', 'EXPORT', 'PRINT'], permissions: ['marks', 'attendance'] },
  { id: 'elearning', label: 'E-learning', description: 'Digital lessons, homework, and the e-library', extras: ['PUBLISH'], permissions: ['e_learning', 'e_library', 'homework', 'online_classes'] },
  { id: 'library', label: 'Library', description: 'Catalog, loans, and returns', extras: ['VALIDATE', 'EXPORT'], permissions: ['library'] },
  { id: 'activities', label: 'Activities & Transport', description: 'Activities and school transport', extras: ['VALIDATE', 'EXPORT'], permissions: ['extracurricular', 'transport'] },
  { id: 'finance', label: 'Finance', description: 'Fees and payments', extras: ['VALIDATE', 'EXPORT', 'PRINT'], permissions: ['fees'] },
  { id: 'inventory', label: 'Stock & Inventory', description: 'Articles, stores, requests, and equipment', extras: ['VALIDATE', 'EXPORT'], permissions: ['inventory'] },
  { id: 'administration', label: 'Administration', description: 'School settings and accounts', extras: ['MANAGE'], permissions: ['school', 'academic_year', 'website', 'users', 'campuses'] },
  { id: 'communication', label: 'Communication', description: 'Messages and announcements', extras: ['VALIDATE', 'PUBLISH', 'EXPORT'], permissions: ['communication'] },
  { id: 'reports', label: 'Reports', description: 'Reports and statistics', extras: ['EXPORT', 'PRINT'], permissions: ['reports'] },
  { id: 'ai', label: 'La Racine AI', description: 'Staff and student assistance', extras: ['EXPORT'], permissions: ['staff_guide', 'ai_tutor'] },
];

const CORE_ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE'];

export function moduleActions(moduleId) {
  const moduleDef = MATRIX_MODULES.find((item) => item.id === moduleId);
  if (!moduleDef) return [];
  return [...CORE_ACTIONS, ...moduleDef.extras];
}

export function allGrantKeys() {
  const keys = [];
  MATRIX_MODULES.forEach((moduleDef) => {
    moduleActions(moduleDef.id).forEach((action) => {
      keys.push(`${moduleDef.id}:${action}`);
    });
  });
  return keys;
}

/** Starting profile from the design. Used when an administrator resets a role. */
export const DEFAULT_GRANTS = {
  SCHOOL_MANAGER: [
    'dashboard:VIEW',
    'people:VIEW', 'people:CREATE', 'people:UPDATE',
    'classes:VIEW', 'classes:UPDATE', 'classes:ASSIGN',
    'evaluation:VIEW', 'evaluation:VALIDATE', 'evaluation:PUBLISH',
    'elearning:VIEW',
    'library:VIEW',
    'activities:VIEW',
    'finance:VIEW',
    'administration:VIEW',
    'communication:VIEW', 'communication:PUBLISH',
    'reports:VIEW', 'reports:EXPORT',
    'ai:VIEW',
    'inventory:VIEW', 'inventory:CREATE', 'inventory:UPDATE', 'inventory:VALIDATE', 'inventory:EXPORT',
  ],
  TEACHER: [
    'dashboard:VIEW', 'people:VIEW', 'classes:VIEW',
    'evaluation:VIEW', 'evaluation:CREATE', 'evaluation:UPDATE',
    'elearning:VIEW', 'elearning:CREATE', 'elearning:UPDATE',
    'library:VIEW', 'activities:VIEW', 'communication:VIEW', 'reports:VIEW',
    'inventory:VIEW', 'inventory:CREATE',
  ],
  HEAD_OF_STUDIES: [
    'dashboard:VIEW', 'people:VIEW', 'classes:VIEW', 'classes:UPDATE',
    'evaluation:VIEW', 'evaluation:VALIDATE', 'evaluation:PUBLISH',
    'elearning:VIEW', 'library:VIEW', 'activities:VIEW',
    'communication:VIEW', 'reports:VIEW', 'reports:EXPORT',
    'inventory:VIEW', 'inventory:VALIDATE',
  ],
  HEAD_OF_DISCIPLINE: [
    'dashboard:VIEW', 'people:VIEW', 'classes:VIEW', 'evaluation:VIEW',
    'activities:VIEW', 'communication:VIEW', 'reports:VIEW',
  ],
  SECRETARY: [
    'dashboard:VIEW', 'people:VIEW', 'people:CREATE', 'people:UPDATE',
    'classes:VIEW', 'evaluation:VIEW', 'library:VIEW', 'activities:VIEW', 'finance:VIEW',
    'communication:VIEW', 'communication:CREATE', 'communication:UPDATE',
    'reports:VIEW', 'reports:EXPORT',
    'inventory:VIEW', 'inventory:CREATE', 'inventory:UPDATE', 'inventory:EXPORT',
  ],
  ACCOUNTANT: [
    'dashboard:VIEW', 'people:VIEW',
    'finance:VIEW', 'finance:CREATE', 'finance:UPDATE', 'finance:VALIDATE', 'finance:EXPORT', 'finance:PRINT',
    'reports:VIEW', 'reports:EXPORT',
  ],
  ACTIVITIES_MANAGER: [
    'dashboard:VIEW', 'people:VIEW', 'classes:VIEW',
    'activities:VIEW', 'activities:CREATE', 'activities:UPDATE', 'activities:VALIDATE', 'activities:EXPORT',
    'communication:VIEW', 'communication:CREATE', 'communication:UPDATE',
    'reports:VIEW', 'reports:EXPORT',
  ],
  LIBRARIAN: [
    'dashboard:VIEW', 'people:VIEW',
    'library:VIEW', 'library:CREATE', 'library:UPDATE', 'library:DELETE', 'library:VALIDATE', 'library:EXPORT',
    'elearning:VIEW', 'reports:VIEW', 'reports:EXPORT',
  ],
  INVENTORY_MANAGER: [
    'dashboard:VIEW',
    'inventory:VIEW', 'inventory:CREATE', 'inventory:UPDATE', 'inventory:VALIDATE', 'inventory:EXPORT',
    'communication:VIEW', 'communication:CREATE',
    'reports:VIEW', 'reports:EXPORT',
    'ai:VIEW',
  ],
};

const PERMISSION_MODULE = {};
MATRIX_MODULES.forEach((moduleDef) => {
  moduleDef.permissions.forEach((permission) => {
    PERMISSION_MODULE[permission] = moduleDef.id;
  });
});

export function moduleForPermission(permission) {
  return PERMISSION_MODULE[permission] || null;
}

export function isKnownGrant(moduleId, action) {
  return moduleActions(moduleId).includes(action);
}

export function defaultGrantMap(role) {
  const allowed = new Set(DEFAULT_GRANTS[role] || []);
  const grants = {};
  allGrantKeys().forEach((key) => {
    grants[key] = allowed.has(key);
  });
  return grants;
}
