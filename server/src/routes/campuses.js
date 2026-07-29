import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../config/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const where =
      req.user.role === 'SCHOOL_MANAGER'
        ? {}
        : { id: (await prisma.user.findUnique({ where: { id: req.user.id }, select: { campusId: true } }))?.campusId || 'none' };

    const campuses = await prisma.campus.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, students: true, teachers: true, classes: true } },
      },
    });
    res.json(campuses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const campus = await prisma.campus.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, students: true, teachers: true, classes: true } },
      },
    });
    if (!campus) return res.status(404).json({ error: 'Campus not found' });

    if (req.user.role !== 'SCHOOL_MANAGER') {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { campusId: true },
      });
      if (dbUser?.campusId !== campus.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(campus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authorizeRoles('SCHOOL_MANAGER'), async (req, res) => {
  try {
    const { name, code, city, district, province, country, address, phone, email } = req.body;
    if (!name || !code || !city || !district) {
      return res.status(400).json({ error: 'Name, code, city, and district are required' });
    }

    const campus = await prisma.campus.create({
      data: {
        name,
        code: code.toUpperCase(),
        city,
        district,
        province: province || 'WESTERN',
        country: country || 'RWANDA',
        address,
        phone,
        email,
      },
    });
    res.status(201).json(campus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authorizeRoles('SCHOOL_MANAGER'), async (req, res) => {
  try {
    const { code, ...data } = req.body;
    const campus = await prisma.campus.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(code ? { code: code.toUpperCase() } : {}),
      },
    });
    res.json(campus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', authorizeRoles('SCHOOL_MANAGER'), async (req, res) => {
  try {
    const campus = await prisma.campus.update({
      where: { id: req.params.id },
      data: { isActive: req.body.isActive },
    });
    res.json(campus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
