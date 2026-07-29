import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { signToken, userSelect } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '../config/permissions.js';

const ALLOWED_LANGUAGES = ['en', 'rw', 'sw', 'fr'];

const router = Router();

async function getCampusesForUser(user) {
  if (user.role === 'SCHOOL_MANAGER') {
    return prisma.campus.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, city: true, district: true },
    });
  }
  if (user.campusId) {
    const campus = await prisma.campus.findUnique({
      where: { id: user.campusId },
      select: { id: true, name: true, code: true, city: true, district: true },
    });
    return campus ? [campus] : [];
  }
  return [];
}

const meUserSelect = {
  ...userSelect,
  teacher: { select: { id: true, name: true, subject: true, email: true, phone: true, campusId: true } },
  student: {
    select: {
      id: true, studentId: true, firstName: true, lastName: true, campusId: true,
      classId: true, class: { select: { name: true, grade: true, section: true } },
    },
  },
  parent: {
    select: {
      id: true,
      phone: true,
      students: {
        select: {
          id: true, studentId: true, firstName: true, lastName: true, campusId: true,
          class: { select: { name: true } },
        },
      },
    },
  },
};

async function buildMeResponse(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: meUserSelect,
  });

  if (!user || !user.isActive) {
    return null;
  }

  const campuses = await getCampusesForUser(user);

  return {
    user,
    campuses,
    defaultCampusId: user.campusId || campuses[0]?.id || null,
    roleLabel: ROLE_LABELS[user.role],
    permissions: ROLE_PERMISSIONS[user.role],
  };
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { campus: { select: { id: true, name: true, code: true, city: true } } },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.role !== 'SCHOOL_MANAGER' && !user.campusId) {
      return res.status(403).json({ error: 'Your account is not assigned to a campus. Contact the school manager.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const campuses = await getCampusesForUser(user);

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      campusId: user.campusId,
      firstName: user.firstName,
      lastName: user.lastName,
      teacherId: user.teacherId,
      studentId: user.studentId,
      parentId: user.parentId,
    });

    const { password: _, ...safeUser } = user;
    res.json({
      token,
      user: safeUser,
      campuses,
      defaultCampusId: user.campusId || campuses[0]?.id || null,
      roleLabel: ROLE_LABELS[user.role],
      permissions: ROLE_PERMISSIONS[user.role],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    res.json({
      message: 'If that email exists, a reset link has been sent.',
      resetToken: token,
      expiresAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashed },
      }),
      prisma.passwordResetToken.delete({ where: { id: resetToken.id } }),
    ]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const data = await buildMeResponse(req.user.id);
    if (!data) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/me', authenticate, async (req, res) => {
  try {
    const { firstName, lastName, phone, preferredLanguage } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, isActive: true, parentId: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const data = {};
    if (firstName !== undefined) {
      const value = String(firstName).trim();
      if (!value) return res.status(400).json({ error: 'First name is required' });
      data.firstName = value;
    }
    if (lastName !== undefined) {
      const value = String(lastName).trim();
      if (!value) return res.status(400).json({ error: 'Last name is required' });
      data.lastName = value;
    }
    if (preferredLanguage !== undefined) {
      const value = String(preferredLanguage).trim().toLowerCase();
      if (!ALLOWED_LANGUAGES.includes(value)) {
        return res.status(400).json({ error: 'Invalid language' });
      }
      data.preferredLanguage = value;
    }

    if (Object.keys(data).length) {
      await prisma.user.update({ where: { id: user.id }, data });
    }

    if (phone !== undefined && user.parentId) {
      await prisma.parent.update({
        where: { id: user.parentId },
        data: { phone: String(phone).trim() },
      });
    }

    const response = await buildMeResponse(user.id);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/me/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/roles', authenticate, (_req, res) => {
  res.json({
    roles: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
    permissions: ROLE_PERMISSIONS,
  });
});

export default router;
