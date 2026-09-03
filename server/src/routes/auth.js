import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { signToken, userSelect } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';
import { ROLE_LABELS, ROLE_PERMISSIONS, isManagerRole } from '../config/permissions.js';
import { issuePasswordReset } from '../lib/passwordReset.js';
import { validateStrongPassword, PASSWORD_POLICY_HINT } from '../lib/passwordPolicy.js';
import { OTP_PURPOSE, createAndSendOtp, verifyOtpChallenge } from '../lib/authOtp.js';
import { isOtpEnabled } from '../lib/appSettings.js';
import {
  extractPhotoPayload,
  removeUserPhotoFile,
  resolveUserPhotoAbsPath,
  saveUserPhotoFile,
  serializeUserPhoto,
  syncPhotoToLinkedTeacher,
} from '../lib/userPhotos.js';

const ALLOWED_LANGUAGES = ['en', 'rw', 'sw', 'fr'];
const STAFF_ROLES = new Set([
  'SCHOOL_MANAGER',
  'SCHOOL_ADMIN',
  'TEACHER',
  'HEAD_OF_STUDIES',
  'HEAD_OF_DISCIPLINE',
  'SECRETARY',
  'ACCOUNTANT',
  'ACTIVITIES_MANAGER',
  'LIBRARIAN',
]);

const router = Router();

async function getCampusesForUser(user) {
  if (isManagerRole(user.role)) {
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
  photoPath: true,
  photoMimeType: true,
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
    user: serializeUserPhoto(user),
    campuses,
    defaultCampusId: user.campusId || campuses[0]?.id || null,
    roleLabel: ROLE_LABELS[user.role],
    permissions: ROLE_PERMISSIONS[user.role],
  };
}

async function issueLoginSession(user) {
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
  return {
    token,
    user: safeUser,
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

    if (user.role !== 'SCHOOL_MANAGER' && user.role !== 'SCHOOL_ADMIN' && !user.campusId) {
      return res.status(403).json({ error: 'Your account is not assigned to a campus. Contact the school manager.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!(await isOtpEnabled())) {
      return res.json(await issueLoginSession(user));
    }

    const otp = await createAndSendOtp({
      userId: user.id,
      email: user.email,
      purpose: OTP_PURPOSE.LOGIN,
      subject: 'Your École La RACINE login code',
      introHtml: `Hello ${user.firstName || ''}, use this code to finish signing in:`,
    });

    res.json({
      requiresOtp: true,
      challengeId: otp.challengeId,
      emailMasked: otp.emailMasked,
      expiresAt: otp.expiresAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login/verify-otp', async (req, res) => {
  try {
    if (!(await isOtpEnabled())) {
      return res.status(400).json({ error: 'OTP login is currently disabled. Sign in with email and password.' });
    }
    const { challengeId, code } = req.body;
    if (!challengeId || !code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const challenge = await verifyOtpChallenge({
      challengeId,
      code,
      purpose: OTP_PURPOSE.LOGIN,
    });

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      include: { campus: { select: { id: true, name: true, code: true, city: true } } },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Account is no longer available' });
    }

    res.json(await issueLoginSession(user));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/login/resend-otp', async (req, res) => {
  try {
    if (!(await isOtpEnabled())) {
      return res.status(400).json({ error: 'OTP login is currently disabled. Sign in with email and password.' });
    }
    const { challengeId } = req.body;
    if (!challengeId) {
      return res.status(400).json({ error: 'Challenge id is required' });
    }

    const existing = await prisma.authOtpChallenge.findUnique({ where: { id: challengeId } });
    if (!existing || existing.purpose !== OTP_PURPOSE.LOGIN) {
      return res.status(400).json({ error: 'Invalid challenge. Sign in again.' });
    }

    const user = await prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Account is no longer available' });
    }

    const otp = await createAndSendOtp({
      userId: user.id,
      email: user.email,
      purpose: OTP_PURPOSE.LOGIN,
      subject: 'Your École La RACINE login code',
      introHtml: `Hello ${user.firstName || ''}, use this code to finish signing in:`,
    });

    res.json({
      requiresOtp: true,
      challengeId: otp.challengeId,
      emailMasked: otp.emailMasked,
      expiresAt: otp.expiresAt,
      message: 'A new verification code was sent.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    // Always return a generic message to avoid email enumeration
    const genericMessage = 'If that email exists, a temporary password has been sent. Check your inbox and set a new strong password.';

    if (!user || !user.isActive) {
      return res.json({ message: genericMessage });
    }

    const result = await issuePasswordReset(user, { initiatedBy: 'forgot-password' });

    if (!result.emailSent) {
      return res.status(500).json({
        error: result.emailError || 'Could not send the reset email. Please contact the school office.',
      });
    }

    res.json({ message: genericMessage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const strength = validateStrongPassword(password);
    if (!strength.ok) {
      return res.status(400).json({ error: strength.error });
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
        data: { password: hashed, mustChangePassword: false },
      }),
      prisma.passwordResetToken.delete({ where: { id: resetToken.id } }),
    ]);

    res.json({ message: 'Password reset successfully. You can now sign in.' });
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

router.get('/me/photo', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { photoPath: true, photoMimeType: true, isActive: true },
    });
    if (!user?.isActive || !user.photoPath) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    const absPath = resolveUserPhotoAbsPath(user.photoPath);
    if (!absPath) return res.status(404).json({ error: 'Photo file missing' });
    if (user.photoMimeType) res.setHeader('Content-Type', user.photoMimeType);
    res.sendFile(absPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/me', authenticate, async (req, res) => {
  try {
    const { firstName, lastName, phone, preferredLanguage } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, isActive: true, parentId: true, role: true, teacherId: true, photoPath: true },
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

    if (phone !== undefined && user.role !== 'STUDENT') {
      const value = String(phone).trim();
      if (!value || value.length < 8) {
        return res.status(400).json({ error: 'Phone number is required (at least 8 characters)' });
      }
      data.phone = value;
    }

    if (Object.keys(data).length) {
      await prisma.user.update({ where: { id: user.id }, data });
    }

    if (phone !== undefined && user.parentId && data.phone) {
      await prisma.parent.update({
        where: { id: user.parentId },
        data: { phone: data.phone },
      });
    }

    if (phone !== undefined && user.teacherId && data.phone) {
      await prisma.teacher.update({
        where: { id: user.teacherId },
        data: { phone: data.phone },
      }).catch(() => {});
    }

    if (STAFF_ROLES.has(user.role)) {
      const photoPayload = extractPhotoPayload(req.body);
      const clearPhoto = req.body.clearPhoto === true;
      if (clearPhoto && !photoPayload) {
        removeUserPhotoFile(user.photoPath);
        await prisma.user.update({
          where: { id: user.id },
          data: { photoPath: null, photoMimeType: null },
        });
        if (user.teacherId) {
          await syncPhotoToLinkedTeacher(prisma, { teacherId: user.teacherId, clear: true });
        }
      } else if (photoPayload) {
        const saved = saveUserPhotoFile({
          userId: user.id,
          ...photoPayload,
          previousPhotoPath: user.photoPath,
        });
        await prisma.user.update({ where: { id: user.id }, data: saved });
        if (user.teacherId) {
          await syncPhotoToLinkedTeacher(prisma, { teacherId: user.teacherId, ...saved });
        }
      }
    }

    const response = await buildMeResponse(user.id);
    res.json(response);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.patch('/me/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const strength = validateStrongPassword(newPassword);
    if (!strength.ok) {
      return res.status(400).json({ error: strength.error });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Temporary / forced reset: skip current password check
    if (!user.mustChangePassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashed, mustChangePassword: false },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    ]);

    res.json({
      message: 'Password updated successfully',
      policy: PASSWORD_POLICY_HINT,
    });
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
