import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { userSelect } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, isManagerRole, MANAGER_ROLES } from '../config/permissions.js';
import { issuePasswordReset, buildResetPreview } from '../lib/passwordReset.js';
import { validateStrongPassword } from '../lib/passwordPolicy.js';
import {
  backfillStaffIdentityNumbers,
  resolveStaffIdentityNumber,
} from '../lib/staffIdentity.js';
import {
  extractPhotoPayload,
  removeUserPhotoDir,
  removeUserPhotoFile,
  resolveUserPhotoAbsPath,
  saveUserPhotoFile,
  serializeUserPhoto,
  syncPhotoToLinkedTeacher,
} from '../lib/userPhotos.js';

const router = Router();

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

function roleRequiresPhone(role) {
  return role === 'PARENT' || STAFF_ROLES.has(role);
}

function normalizePhone(value) {
  return String(value || '').trim();
}

function validatePhone(phone) {
  const value = normalizePhone(phone);
  if (!value) return { ok: false, error: 'Phone number is required for staff and parent accounts' };
  if (value.length < 8) return { ok: false, error: 'Phone number must be at least 8 characters' };
  return { ok: true, value };
}

router.use(authenticate);
router.use(authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY'));

router.get('/', async (req, res) => {
  try {
    const { campusId } = req.query;
    // Managers are org-wide (campusId null) — include them when a manager views a campus list
    let where;
    if (campusId) {
      where = isManagerRole(req.user.role)
        ? { OR: [{ campusId }, { role: { in: MANAGER_ROLES } }] }
        : { campusId };
    }

    await backfillStaffIdentityNumbers(prisma);

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        ...userSelect,
        photoPath: true,
        photoMimeType: true,
        teacher: { select: { id: true, name: true } },
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            class: { select: { id: true, name: true } },
          },
        },
        parent: {
          select: {
            id: true,
            phone: true,
            students: {
              select: { id: true, studentId: true, firstName: true, lastName: true },
            },
          },
        },
        passwordResetTokens: {
          where: {
            expiresAt: { gt: new Date() },
            temporaryPassword: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            expiresAt: true,
            emailSent: true,
            createdAt: true,
          },
        },
      },
    });

    res.json(users.map((u) => {
      const pending = u.passwordResetTokens?.[0] || null;
      const { passwordResetTokens, ...rest } = u;
      return {
        ...serializeUserPhoto(rest),
        pendingReset: pending
          ? {
              expiresAt: pending.expiresAt,
              emailSent: pending.emailSent,
              createdAt: pending.createdAt,
            }
          : null,
      };
    }));
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
          select: { id: true, email: true, isActive: true, firstName: true, lastName: true, phone: true },
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

router.get('/:id/photo', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { photoPath: true, photoMimeType: true, role: true },
    });
    if (!user?.photoPath) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    const absPath = resolveUserPhotoAbsPath(user.photoPath);
    if (!absPath) {
      return res.status(404).json({ error: 'Photo file missing' });
    }
    if (user.photoMimeType) res.setHeader('Content-Type', user.photoMimeType);
    res.sendFile(absPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/photo', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { photoPath: true, photoMimeType: true },
    });
    if (!user?.photoPath) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    const absPath = resolveUserPhotoAbsPath(user.photoPath);
    if (!absPath) {
      return res.status(404).json({ error: 'Photo file missing' });
    }
    if (user.photoMimeType) res.setHeader('Content-Type', user.photoMimeType);
    res.sendFile(absPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      email, password, firstName, lastName, role, campusId,
      teacherId, studentId, parentId, phone,
    } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    if (!isManagerRole(role) && !campusId) {
      return res.status(400).json({ error: 'Campus is required for this role' });
    }

    let phoneValue = null;
    if (roleRequiresPhone(role)) {
      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.ok) return res.status(400).json({ error: phoneCheck.error });
      phoneValue = phoneCheck.value;
    } else if (phone !== undefined && phone !== null && String(phone).trim()) {
      phoneValue = normalizePhone(phone);
    }

    if (role === 'PARENT' && !parentId) {
      return res.status(400).json({ error: 'Parent record is required for parent accounts' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const strength = validateStrongPassword(password);
    if (!strength.ok) {
      return res.status(400).json({ error: strength.error });
    }

    const hashed = await bcrypt.hash(password, 10);
    let identityNumber = null;
    if (STAFF_ROLES.has(role)) {
      identityNumber = await resolveStaffIdentityNumber(prisma, req.body.identityNumber, {
        teacherId: teacherId || null,
      });
    }

    let user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashed,
        firstName,
        lastName,
        role,
        phone: phoneValue,
        identityNumber,
        campusId: isManagerRole(role) ? null : campusId,
        teacherId: teacherId || null,
        studentId: studentId || null,
        parentId: parentId || null,
        mustChangePassword: false,
      },
      select: { ...userSelect, photoPath: true, photoMimeType: true },
    });

    const photoPayload = STAFF_ROLES.has(role) ? extractPhotoPayload(req.body) : null;
    if (photoPayload) {
      try {
        const saved = saveUserPhotoFile({ userId: user.id, ...photoPayload });
        user = await prisma.user.update({
          where: { id: user.id },
          data: saved,
          select: { ...userSelect, photoPath: true, photoMimeType: true },
        });
        if (role === 'TEACHER' && (teacherId || user.teacherId)) {
          await syncPhotoToLinkedTeacher(prisma, {
            teacherId: teacherId || user.teacherId,
            ...saved,
          });
        }
      } catch (photoErr) {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
        throw photoErr;
      }
    }

    if (role === 'PARENT' && parentId && phoneValue) {
      await prisma.parent.update({
        where: { id: parentId },
        data: { phone: phoneValue },
      });
    }

    if (role === 'TEACHER' && teacherId) {
      await prisma.teacher.update({
        where: { id: teacherId },
        data: {
          ...(phoneValue ? { phone: phoneValue } : {}),
          ...(identityNumber ? { identityNumber } : {}),
        },
      }).catch(() => {});
    }

    if (role === 'STUDENT' && studentId) {
      await prisma.student.update({
        where: { id: studentId },
        data: { studentAccountCreatedBy: 'STAFF' },
      });
    }

    res.status(201).json(serializeUserPhoto(user));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (isManagerRole(target.role) && !isManagerRole(req.user.role)) {
      return res.status(403).json({ error: 'Only a school manager or school admin can modify manager accounts' });
    }

    const {
      email,
      firstName,
      lastName,
      role,
      campusId,
      teacherId,
      studentId,
      parentId,
      isActive,
      password,
      phone,
    } = req.body;

    if (firstName !== undefined && !String(firstName).trim()) {
      return res.status(400).json({ error: 'First name is required' });
    }
    if (lastName !== undefined && !String(lastName).trim()) {
      return res.status(400).json({ error: 'Last name is required' });
    }
    if (email !== undefined && !String(email).trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const nextRole = role || target.role;
    if (!isManagerRole(nextRole)) {
      const nextCampusId = campusId !== undefined ? campusId : target.campusId;
      if (!nextCampusId) {
        return res.status(400).json({ error: 'Campus is required for this role' });
      }
    }

    if (email) {
      const emailNorm = String(email).trim().toLowerCase();
      const taken = await prisma.user.findFirst({
        where: { email: emailNorm, NOT: { id: target.id } },
      });
      if (taken) return res.status(400).json({ error: 'Email already in use' });
    }

    if (password !== undefined && password !== null && String(password).length > 0 && String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (nextRole === 'PARENT') {
      const nextParentId = parentId !== undefined ? (parentId || null) : target.parentId;
      if (!nextParentId) {
        return res.status(400).json({ error: 'Parent record is required for parent accounts' });
      }
    }

    let phoneValue;
    if (roleRequiresPhone(nextRole)) {
      const incoming = phone !== undefined ? phone : target.phone;
      const phoneCheck = validatePhone(incoming);
      if (!phoneCheck.ok) return res.status(400).json({ error: phoneCheck.error });
      phoneValue = phoneCheck.value;
    } else if (phone !== undefined) {
      phoneValue = normalizePhone(phone) || null;
    }

    const data = {};
    if (firstName !== undefined) data.firstName = String(firstName).trim();
    if (lastName !== undefined) data.lastName = String(lastName).trim();
    if (email !== undefined) data.email = String(email).trim().toLowerCase();
    if (role !== undefined) data.role = role;
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (phoneValue !== undefined) data.phone = phoneValue;

    if (STAFF_ROLES.has(nextRole)) {
      data.identityNumber = await resolveStaffIdentityNumber(prisma, req.body.identityNumber ?? target.identityNumber, {
        userId: target.id,
        teacherId: nextRole === 'TEACHER'
          ? (teacherId !== undefined ? (teacherId || null) : target.teacherId)
          : target.teacherId,
      });
    } else {
      data.identityNumber = null;
    }

    if (isManagerRole(nextRole)) {
      data.campusId = null;
      data.teacherId = null;
      data.studentId = null;
      data.parentId = null;
    } else {
      if (campusId !== undefined) data.campusId = campusId || null;
      data.teacherId = nextRole === 'TEACHER'
        ? (teacherId !== undefined ? (teacherId || null) : target.teacherId)
        : null;
      data.studentId = nextRole === 'STUDENT'
        ? (studentId !== undefined ? (studentId || null) : target.studentId)
        : null;
      data.parentId = nextRole === 'PARENT'
        ? (parentId !== undefined ? (parentId || null) : target.parentId)
        : null;
    }

    if (password !== undefined && password !== null && String(password).length > 0) {
      const strength = validateStrongPassword(password);
      if (!strength.ok) return res.status(400).json({ error: strength.error });
      data.password = await bcrypt.hash(String(password), 10);
      data.mustChangePassword = false;
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data,
      select: {
        ...userSelect,
        photoPath: true,
        photoMimeType: true,
        teacher: { select: { id: true, name: true } },
        student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
        parent: { select: { id: true, phone: true } },
      },
    });

    const photoPayload = extractPhotoPayload(req.body);
    const clearPhoto = req.body.clearPhoto === true;
    let result = user;
    if (STAFF_ROLES.has(user.role) && (photoPayload || clearPhoto)) {
      if (clearPhoto && !photoPayload) {
        removeUserPhotoFile(target.photoPath);
        result = await prisma.user.update({
          where: { id: target.id },
          data: { photoPath: null, photoMimeType: null },
          select: {
            ...userSelect,
            photoPath: true,
            photoMimeType: true,
            teacher: { select: { id: true, name: true } },
            student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
            parent: { select: { id: true, phone: true } },
          },
        });
        if (result.teacherId) {
          await syncPhotoToLinkedTeacher(prisma, { teacherId: result.teacherId, clear: true });
        }
      } else if (photoPayload) {
        const saved = saveUserPhotoFile({
          userId: target.id,
          ...photoPayload,
          previousPhotoPath: target.photoPath,
        });
        result = await prisma.user.update({
          where: { id: target.id },
          data: saved,
          select: {
            ...userSelect,
            photoPath: true,
            photoMimeType: true,
            teacher: { select: { id: true, name: true } },
            student: { select: { id: true, studentId: true, firstName: true, lastName: true } },
            parent: { select: { id: true, phone: true } },
          },
        });
        if (result.teacherId) {
          await syncPhotoToLinkedTeacher(prisma, { teacherId: result.teacherId, ...saved });
        }
      }
    }

    if (user.role === 'PARENT' && user.parentId && phoneValue) {
      await prisma.parent.update({
        where: { id: user.parentId },
        data: { phone: phoneValue },
      });
    }

    if (user.role === 'TEACHER' && user.teacherId) {
      await prisma.teacher.update({
        where: { id: user.teacherId },
        data: {
          ...(phoneValue ? { phone: phoneValue } : {}),
          ...(result.identityNumber ? { identityNumber: result.identityNumber } : {}),
        },
      }).catch(() => {});
    }

    if (user.role === 'STUDENT' && user.studentId) {
      await prisma.student.update({
        where: { id: user.studentId },
        data: { studentAccountCreatedBy: 'STAFF' },
      }).catch(() => {});
    }

    res.json(serializeUserPhoto(result));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email, linked profile, or identity number is already in use' });
    }
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (isManagerRole(target.role) && !isManagerRole(req.user.role)) {
      return res.status(403).json({ error: 'Only a school manager or school admin can modify manager accounts' });
    }
    if (req.params.id === req.user.id && req.body.isActive === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

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

router.post('/:id/send-password-reset', async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (!target.isActive) {
      return res.status(400).json({ error: 'Cannot reset password for an inactive account' });
    }
    if (isManagerRole(target.role) && !isManagerRole(req.user.role)) {
      return res.status(403).json({ error: 'Only a school manager or school admin can reset manager accounts' });
    }

    const result = await issuePasswordReset(target, { initiatedBy: req.user.role });

    res.json({
      message: result.emailSent
        ? `Password reset email sent to ${target.email}. Share the message below with the user if they need help.`
        : `Temporary password was generated, but email failed: ${result.emailError}. Share the message below with the user.`,
      emailSent: result.emailSent,
      emailError: result.emailError,
      emailPreview: result.emailPreview,
      expiresAt: result.expiresAt,
      temporaryPassword: result.temporaryPassword,
      resetUrl: result.resetUrl,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/password-reset', async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (isManagerRole(target.role) && !isManagerRole(req.user.role)) {
      return res.status(403).json({ error: 'Only a school manager or school admin can view manager reset details' });
    }

    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        userId: target.id,
        expiresAt: { gt: new Date() },
        temporaryPassword: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetRecord?.temporaryPassword) {
      return res.status(404).json({
        error: 'No temporary password available. Send a new reset email first.',
      });
    }

    const preview = buildResetPreview(target, resetRecord);
    res.json({
      message: preview.emailSent
        ? `Temporary password for ${target.email} (still valid until it expires or the user changes it).`
        : `Temporary password for ${target.email}. Email may not have been delivered — share this with the user.`,
      emailSent: preview.emailSent,
      emailPreview: preview.emailPreview,
      expiresAt: preview.expiresAt,
      temporaryPassword: preview.temporaryPassword,
      resetUrl: preview.resetUrl,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/password', async (req, res) => {
  // Kept for compatibility — prefer send-password-reset (email flow)
  return res.status(400).json({
    error: 'Direct password set is disabled. Use “Send reset email” so the user receives a temporary password.',
  });
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (isManagerRole(target.role) && !isManagerRole(req.user.role)) {
      return res.status(403).json({ error: 'Only a school manager or school admin can delete manager accounts' });
    }

    const id = target.id;
    removeUserPhotoFile(target.photoPath);
    removeUserPhotoDir(id);

    await prisma.$transaction(async (tx) => {
      await tx.contactInquiryReply.updateMany({
        where: { repliedById: id },
        data: { repliedById: null },
      });

      await tx.communicationMessage.deleteMany({ where: { senderId: id } });

      const threads = await tx.communicationThread.findMany({
        where: { createdById: id },
        select: { id: true },
      });
      const threadIds = threads.map((row) => row.id);
      if (threadIds.length) {
        await tx.communicationMessage.deleteMany({ where: { threadId: { in: threadIds } } });
        await tx.communicationThread.deleteMany({ where: { id: { in: threadIds } } });
      }

      const broadcasts = await tx.communicationBroadcast.findMany({
        where: { createdById: id },
        select: { id: true },
      });
      const broadcastIds = broadcasts.map((row) => row.id);
      if (broadcastIds.length) {
        await tx.communicationBroadcastRead.deleteMany({ where: { broadcastId: { in: broadcastIds } } });
        await tx.communicationBroadcast.deleteMany({ where: { id: { in: broadcastIds } } });
      }

      await tx.user.delete({ where: { id } });
    });

    res.json({ message: 'User deleted' });
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'Cannot delete this user because related records still reference the account. Deactivate the account instead.',
      });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
