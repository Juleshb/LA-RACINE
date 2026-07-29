import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { classScopeWhere } from '../lib/scope.js';
import { resolveTeacherId } from '../lib/teacherAccess.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { listBulletinPresets, resolveBulletinConfig } from '../config/bulletinPresets.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.CLASSES));

router.get('/bulletin-presets', (_req, res) => {
  res.json(listBulletinPresets());
});

router.get('/:id/bulletin-config', async (req, res) => {
  try {
    const scope = await classScopeWhere(req);
    const cls = await prisma.class.findFirst({
      where: { id: req.params.id, ...scope },
      select: { id: true, name: true, grade: true, bulletinConfig: true },
    });
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    const config = resolveBulletinConfig(cls.bulletinConfig, cls.grade);
    res.json({ classId: cls.id, className: cls.name, grade: cls.grade, stored: cls.bulletinConfig, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/bulletin-config', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit bulletin settings' });
    }
    const scope = await classScopeWhere(req);
    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Class not found' });

    const { preset, assessments, terms, label } = req.body;
    let bulletinConfig = null;

    if (preset === 'CUSTOM') {
      if (!Array.isArray(assessments) || !assessments.length) {
        return res.status(400).json({ error: 'Custom bulletin requires at least one assessment' });
      }
      bulletinConfig = {
        preset: 'CUSTOM',
        label: label || 'Custom bulletin',
        assessments: assessments.map((a) => ({
          key: String(a.key || '').trim().toUpperCase(),
          label: String(a.label || a.key || '').trim(),
          maxField: a.maxField || 'custom',
          customMax: a.customMax ? Number(a.customMax) : undefined,
          fallbackMax: a.fallbackMax ? Number(a.fallbackMax) : 100,
        })),
        terms: terms?.length ? terms : undefined,
      };
    } else if (preset) {
      bulletinConfig = { preset, terms: terms?.length ? terms : undefined };
    } else {
      return res.status(400).json({ error: 'preset is required' });
    }

    const cls = await prisma.class.update({
      where: { id: req.params.id },
      data: { bulletinConfig },
      select: { id: true, name: true, grade: true, bulletinConfig: true },
    });
    const config = resolveBulletinConfig(cls.bulletinConfig, cls.grade);
    res.json({ classId: cls.id, className: cls.name, grade: cls.grade, stored: cls.bulletinConfig, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const scope = await classScopeWhere(req);
    const classes = await prisma.class.findMany({
      where: scope,
      orderBy: [{ grade: 'asc' }, { section: 'asc' }],
      include: {
        teacher: true,
        _count: { select: { students: true, subjects: true } },
      },
    });
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const scope = await classScopeWhere(req);
    const cls = await prisma.class.findFirst({
      where: { id: req.params.id, ...scope },
      include: {
        teacher: true,
        students: true,
        subjects: { include: { teacher: true } },
      },
    });
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    if (req.user.role === 'TEACHER') {
      const teacherId = await resolveTeacherId(req);
      const filtered = {
        ...cls,
        subjects: teacherId
          ? cls.subjects.filter((s) => s.teacherId === teacherId)
          : [],
      };
      return res.json(filtered);
    }
    res.json(cls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot create classes' });
    }
    const cls = await prisma.class.create({
      data: { ...req.body, campusId: req.campusId, academicYearId: req.academicYearId },
      include: { teacher: true },
    });
    res.status(201).json(cls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit classes' });
    }
    const scope = await classScopeWhere(req);
    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Class not found' });

    const { campusId: _, academicYearId: __, ...data } = req.body;
    const cls = await prisma.class.update({
      where: { id: req.params.id },
      data,
      include: { teacher: true },
    });
    res.json(cls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'SCHOOL_MANAGER' && req.user.role !== 'SECRETARY') {
      return res.status(403).json({ error: 'You cannot delete classes' });
    }
    const scope = await classScopeWhere(req);
    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Class not found' });
    await prisma.class.delete({ where: { id: req.params.id } });
    res.json({ message: 'Class deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
