import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizeRoles } from '../config/permissions.js';
import {
  MATRIX_ROLES,
  MATRIX_MODULES,
  moduleActions,
  defaultGrantMap,
  isKnownGrant,
  allGrantKeys,
} from '../config/accessMatrix.js';
import { clearAccessCache, permissionList } from '../lib/accessControl.js';

const router = Router();
const canConfigure = authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN');

function actorName(user) {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Administrator';
}

async function writeAudit(req, title, detail) {
  await prisma.permissionAudit.create({
    data: {
      campusId: req.campusId,
      actorId: req.user.id,
      actorName: actorName(req.user),
      title,
      detail,
    },
  });
}

async function grantsFor(campusId, role) {
  const rows = await prisma.rolePermission.findMany({ where: { campusId, role } });
  if (!rows.length) return { customized: false, grants: defaultGrantMap(role) };
  const grants = defaultGrantMap(role);
  allGrantKeys().forEach((key) => { grants[key] = false; });
  rows.forEach((row) => {
    const key = `${row.module}:${row.action}`;
    if (key in grants) grants[key] = row.allowed;
  });
  return { customized: true, grants };
}

function cleanGrants(grants = {}) {
  const next = {};
  Object.entries(grants).forEach(([key, value]) => {
    const [moduleId, action] = String(key).split(':');
    if (isKnownGrant(moduleId, action)) next[key] = Boolean(value);
  });
  allGrantKeys().forEach((key) => {
    if (!(key in next)) next[key] = false;
  });
  return next;
}

async function replaceGrants(campusId, role, grants) {
  const data = Object.entries(grants).map(([key, allowed]) => {
    const [module, action] = key.split(':');
    return { campusId, role, module, action, allowed };
  });
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { campusId, role } }),
    prisma.rolePermission.createMany({ data }),
  ]);
  clearAccessCache(campusId, role);
}

router.get('/me', async (req, res) => {
  try {
    const permissions = await permissionList(req.user.role, req.campusId);
    res.json({ permissions, role: req.user.role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.use(canConfigure);

router.get('/matrix', async (req, res) => {
  try {
    const role = MATRIX_ROLES.includes(req.query.role) ? req.query.role : 'TEACHER';
    const [stored, users, campuses] = await Promise.all([
      grantsFor(req.campusId, role),
      prisma.user.findMany({
        where: { campusId: req.campusId, role },
        select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.campus.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    res.json({
      roles: MATRIX_ROLES,
      modules: MATRIX_MODULES.map((item) => ({
        ...item,
        actions: moduleActions(item.id),
      })),
      role,
      campusId: req.campusId,
      campuses,
      users,
      ...stored,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/matrix', async (req, res) => {
  try {
    const role = req.body.role;
    if (!MATRIX_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Choose one of the eight staff roles' });
    }
    const grants = cleanGrants(req.body.grants);
    if (role === 'SCHOOL_MANAGER' && !grants['administration:VIEW']) {
      return res.status(400).json({ error: 'School Manager must keep Administration · View, so this screen stays available' });
    }
    await replaceGrants(req.campusId, role, grants);
    const active = Object.values(grants).filter(Boolean).length;
    await writeAudit(
      req,
      'Role permissions saved',
      `${role} on ${req.campus?.name || 'this campus'} — ${active} rights, inherited by every user with this role`,
    );
    res.json({ saved: true, grants, customized: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/matrix/reset', async (req, res) => {
  try {
    const role = req.body.role;
    if (!MATRIX_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Choose one of the eight staff roles' });
    }
    const grants = defaultGrantMap(role);
    await replaceGrants(req.campusId, role, grants);
    await writeAudit(req, 'Role profile restored', `${role} on ${req.campus?.name || 'this campus'}`);
    res.json({ saved: true, grants, customized: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/matrix/clear', async (req, res) => {
  try {
    const role = req.body.role;
    if (!MATRIX_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Choose one of the eight staff roles' });
    }
    if (role === 'SCHOOL_MANAGER') {
      return res.status(400).json({ error: 'School Manager cannot be cleared. Restore the profile instead.' });
    }
    const grants = defaultGrantMap(role);
    Object.keys(grants).forEach((key) => { grants[key] = false; });
    await replaceGrants(req.campusId, role, grants);
    await writeAudit(req, 'Role permissions cleared', `${role} on ${req.campus?.name || 'this campus'}`);
    res.json({ saved: true, grants, customized: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/matrix/copy', async (req, res) => {
  try {
    const role = req.body.role;
    const targetCampusId = req.body.targetCampusId;
    if (!MATRIX_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Choose one of the eight staff roles' });
    }
    if (!targetCampusId || targetCampusId === req.campusId) {
      return res.status(400).json({ error: 'Choose another campus' });
    }
    const target = await prisma.campus.findFirst({ where: { id: targetCampusId, isActive: true } });
    if (!target) return res.status(404).json({ error: 'Campus not found' });
    const source = await grantsFor(req.campusId, role);
    await replaceGrants(target.id, role, source.grants);
    await writeAudit(
      req,
      'Role permissions copied',
      `${role}: ${req.campus?.name || 'this campus'} to ${target.name}`,
    );
    res.json({ saved: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit', async (req, res) => {
  try {
    const rows = await prisma.permissionAudit.findMany({
      where: { campusId: req.campusId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
