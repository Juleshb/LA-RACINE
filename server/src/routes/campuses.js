import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, isManagerRole } from '../config/permissions.js';

const router = Router();

const STAFF_ROLES = [
  'SCHOOL_MANAGER',
  'SCHOOL_ADMIN',
  'TEACHER',
  'HEAD_OF_STUDIES',
  'HEAD_OF_DISCIPLINE',
  'SECRETARY',
  'ACCOUNTANT',
  'ACTIVITIES_MANAGER',
  'LIBRARIAN',
];

router.use(authenticate);

async function campusStats(campusId) {
  const activeYear = await prisma.academicYear.findFirst({
    where: { campusId, isActive: true },
    select: { id: true, name: true },
  });

  const yearFilter = activeYear ? { academicYearId: activeYear.id } : {};

  const [students, pending, teachers, classes, staffUsers] = await Promise.all([
    prisma.student.count({
      where: {
        campusId,
        registrationStatus: 'APPROVED',
        ...yearFilter,
      },
    }),
    prisma.student.count({
      where: {
        campusId,
        registrationStatus: 'PENDING',
        ...yearFilter,
      },
    }),
    // Teachers may be copied per year; hub shows all staff linked to the campus
    prisma.teacher.count({ where: { campusId } }),
    prisma.class.count({
      where: {
        campusId,
        ...yearFilter,
      },
    }),
    prisma.user.count({
      where: {
        campusId,
        isActive: true,
        role: { in: STAFF_ROLES },
      },
    }),
  ]);

  return {
    students,
    pending,
    teachers,
    classes,
    staffUsers,
    activeYear: activeYear?.name || null,
    activeYearId: activeYear?.id || null,
  };
}

async function attachCampusStats(campuses) {
  return Promise.all(
    campuses.map(async (campus) => ({
      ...campus,
      stats: await campusStats(campus.id),
    })),
  );
}

router.get('/', async (req, res) => {
  try {
    const where =
      isManagerRole(req.user.role)
        ? {}
        : { id: (await prisma.user.findUnique({ where: { id: req.user.id }, select: { campusId: true } }))?.campusId || 'none' };

    const campuses = await prisma.campus.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, students: true, teachers: true, classes: true } },
      },
    });
    res.json(await attachCampusStats(campuses));
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

    if (!isManagerRole(req.user.role)) {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { campusId: true },
      });
      if (dbUser?.campusId !== campus.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const stats = await campusStats(campus.id);
    res.json({ ...campus, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN'), async (req, res) => {
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

router.put('/:id', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN'), async (req, res) => {
  try {
    const existing = await prisma.campus.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Campus not found' });

    const {
      name,
      code,
      city,
      district,
      province,
      country,
      address,
      phone,
      email,
      isActive,
    } = req.body;

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: 'Campus name is required' });
    }
    if (code !== undefined && !String(code).trim()) {
      return res.status(400).json({ error: 'Campus code is required' });
    }
    if (city !== undefined && !String(city).trim()) {
      return res.status(400).json({ error: 'City is required' });
    }
    if (district !== undefined && !String(district).trim()) {
      return res.status(400).json({ error: 'District is required' });
    }

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (code !== undefined) data.code = String(code).trim().toUpperCase();
    if (city !== undefined) data.city = String(city).trim();
    if (district !== undefined) data.district = String(district).trim();
    if (province !== undefined) data.province = String(province).trim() || 'WESTERN';
    if (country !== undefined) data.country = String(country).trim() || 'RWANDA';
    if (address !== undefined) data.address = address ? String(address).trim() : null;
    if (phone !== undefined) data.phone = phone ? String(phone).trim() : null;
    if (email !== undefined) data.email = email ? String(email).trim() : null;
    if (typeof isActive === 'boolean') data.isActive = isActive;

    const campus = await prisma.campus.update({
      where: { id: req.params.id },
      data,
      include: {
        _count: { select: { users: true, students: true, teachers: true, classes: true } },
      },
    });
    res.json(campus);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A campus with this code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN'), async (req, res) => {
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

router.delete('/:id', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN'), async (req, res) => {
  try {
    const existing = await prisma.campus.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, students: true, teachers: true, classes: true } },
      },
    });
    if (!existing) return res.status(404).json({ error: 'Campus not found' });

    const totalCampuses = await prisma.campus.count();
    if (totalCampuses <= 1) {
      return res.status(400).json({ error: 'You cannot delete the only remaining campus' });
    }

    await prisma.$transaction(async (tx) => {
      // Users reference campus without cascade — detach them first
      await tx.user.updateMany({
        where: { campusId: existing.id },
        data: { campusId: null },
      });
      await tx.campus.delete({ where: { id: existing.id } });
    });

    res.json({
      message: 'Campus deleted',
      id: existing.id,
      name: existing.name,
      detachedUsers: existing._count.users,
    });
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(409).json({
        error: 'This campus still has related records that block deletion. Deactivate it instead, or contact support.',
      });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
