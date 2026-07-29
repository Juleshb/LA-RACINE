import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { userSelect } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../config/permissions.js';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles('SCHOOL_MANAGER', 'SECRETARY'));

router.get('/', async (req, res) => {
  try {
    const { campusId } = req.query;
    const users = await prisma.user.findMany({
      where: campusId ? { campusId } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        ...userSelect,
        teacher: { select: { id: true, name: true } },
        student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
        parent: { select: { id: true, phone: true } },
      },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/parents', async (req, res) => {
  try {
    const { campusId } = req.query;
    const parents = await prisma.parent.findMany({
      where: campusId
        ? { students: { some: { campusId } } }
        : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phone: true,
        user: {
          select: { id: true, email: true, isActive: true, firstName: true, lastName: true },
        },
        students: {
          select: { id: true, studentId: true, firstName: true, lastName: true },
        },
      },
    });
    res.json(parents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, campusId, teacherId, studentId, parentId } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    if (role !== 'SCHOOL_MANAGER' && !campusId) {
      return res.status(400).json({ error: 'Campus is required for this role' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashed,
        firstName,
        lastName,
        role,
        campusId: role === 'SCHOOL_MANAGER' ? null : campusId,
        teacherId: teacherId || null,
        studentId: studentId || null,
        parentId: parentId || null,
      },
      select: userSelect,
    });

    if (role === 'STUDENT' && studentId) {
      await prisma.student.update({
        where: { id: studentId },
        data: { studentAccountCreatedBy: 'STAFF' },
      });
    }

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: req.body.isActive },
      select: userSelect,
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hashed },
      select: userSelect,
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
