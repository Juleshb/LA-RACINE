import prisma from './prisma.js';
import { hasPermission, ROLE_PERMISSIONS } from '../config/permissions.js';
import {
  MATRIX_MODULES,
  MATRIX_ROLES,
  moduleForPermission,
  isKnownGrant,
} from '../config/accessMatrix.js';

const STATIC_ROLES = new Set(['PARENT', 'STUDENT', 'SCHOOL_ADMIN']);
const cache = new Map();

function cacheKey(campusId, role) {
  return `${campusId}:${role}`;
}

export function clearAccessCache(campusId, role) {
  if (role) cache.delete(cacheKey(campusId, role));
  else {
    [...cache.keys()].forEach((key) => {
      if (key.startsWith(`${campusId}:`)) cache.delete(key);
    });
  }
}

async function savedRows(campusId, role) {
  const key = cacheKey(campusId, role);
  if (cache.has(key)) return cache.get(key);
  const rows = await prisma.rolePermission.findMany({
    where: { campusId, role },
  });
  const value = rows.length ? rows : null;
  cache.set(key, value);
  return value;
}

function methodAction(req) {
  const path = `${req.baseUrl || ''}${req.path || ''}`.toLowerCase();
  if (path.includes('publish')) return 'PUBLISH';
  if (path.includes('validate') || path.includes('approve')) return 'VALIDATE';
  if (path.includes('export')) return 'EXPORT';
  if (req.method === 'DELETE') return 'DELETE';
  if (req.method === 'PUT' || req.method === 'PATCH') return 'UPDATE';
  if (req.method === 'POST') return 'CREATE';
  return 'VIEW';
}

export async function allows(role, campusId, permission, action = 'VIEW') {
  if (!role) return false;
  if (STATIC_ROLES.has(role) || !campusId || !MATRIX_ROLES.includes(role)) {
    return hasPermission(role, permission);
  }
  const rows = await savedRows(campusId, role);
  if (!rows) return hasPermission(role, permission);
  const moduleId = moduleForPermission(permission);
  if (!moduleId) return hasPermission(role, permission);
  const wanted = isKnownGrant(moduleId, action) ? action : 'VIEW';
  const row = rows.find((item) => item.module === moduleId && item.action === wanted);
  return Boolean(row?.allowed);
}

export async function permissionList(role, campusId) {
  if (STATIC_ROLES.has(role) || !MATRIX_ROLES.includes(role)) {
    return ROLE_PERMISSIONS[role] || [];
  }
  const rows = campusId ? await savedRows(campusId, role) : null;
  if (!rows) return ROLE_PERMISSIONS[role] || [];
  const viewModules = new Set(
    rows.filter((row) => row.action === 'VIEW' && row.allowed).map((row) => row.module),
  );
  const granted = [];
  MATRIX_MODULES.forEach((moduleDef) => {
    if (viewModules.has(moduleDef.id)) granted.push(...moduleDef.permissions);
  });
  return [...new Set(granted)];
}

export function requestAction(req) {
  return methodAction(req);
}
