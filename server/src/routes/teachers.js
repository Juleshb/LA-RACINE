import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma.js';
import { campusYearWhere } from '../lib/scope.js';
import {
  backfillStaffIdentityNumbers,
  resolveStaffIdentityNumber,
} from '../lib/staffIdentity.js';
import {
  removeTeacherPhotoFile,
  resolveTeacherPhotoAbsPath,
  saveTeacherPhotoFile,
  serializeTeacher,
  TEACHER_UPLOADS_DIR,
} from '../lib/teacherPhotos.js';

const router = Router();

function pickTeacherFields(body = {}) {
  const { name, email, phone, subject } = body;
  return {
    ...(name !== undefined ? { name: String(name).trim() } : {}),
    ...(email !== undefined ? { email: email ? String(email).trim() : null } : {}),
    ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
    ...(subject !== undefined ? { subject: subject ? String(subject).trim() : null } : {}),
  };
}

function extractPhotoPayload(body = {}) {
  const photo = body.photo;
  if (!photo || typeof photo !== 'object') return null;
  if (!photo.contentBase64 || !photo.fileName) return null;
  return {
    fileName: photo.fileName,
    contentBase64: photo.contentBase64,
    mimeType: photo.mimeType || null,
  };
}

async function syncLinkedUserPhoto(teacherId, photoPayload, { clear = false } = {}) {
  const { saveUserPhotoFile, removeUserPhotoFile } = await import('../lib/userPhotos.js');
  const linkedUser = await prisma.user.findFirst({
    where: { teacherId },
    select: { id: true, photoPath: true },
  });
  if (!linkedUser) return;
  if (clear && !photoPayload) {
    removeUserPhotoFile(linkedUser.photoPath);
    await prisma.user.update({
      where: { id: linkedUser.id },
      data: { photoPath: null, photoMimeType: null },
    }).catch(() => {});
    return;
  }
  if (photoPayload) {
    const savedUser = saveUserPhotoFile({
      userId: linkedUser.id,
      ...photoPayload,
      previousPhotoPath: linkedUser.photoPath,
    });
    await prisma.user.update({ where: { id: linkedUser.id }, data: savedUser }).catch(() => {});
  }
}

router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'TEACHER') {
      return res.status(403).json({ error: 'Teachers cannot list all staff' });
    }
    await backfillStaffIdentityNumbers(prisma);
    const teachers = await prisma.teacher.findMany({
      where: campusYearWhere(req),
      orderBy: { name: 'asc' },
      include: { _count: { select: { classes: true, subjects: true } } },
    });
    res.json(teachers.map((t) => serializeTeacher(t)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
      include: { _count: { select: { classes: true, subjects: true } } },
    });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    res.json(serializeTeacher(teacher, { includePhotoUrl: true }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/photo', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
      select: { photoPath: true, photoMimeType: true },
    });
    if (!teacher?.photoPath) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const absPath = resolveTeacherPhotoAbsPath(teacher.photoPath);
    if (!absPath) {
      return res.status(404).json({ error: 'Photo file missing' });
    }

    if (teacher.photoMimeType) res.setHeader('Content-Type', teacher.photoMimeType);
    res.sendFile(absPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = pickTeacherFields(req.body);
    if (!fields.name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const photoPayload = extractPhotoPayload(req.body);
    const identityNumber = await resolveStaffIdentityNumber(prisma, req.body.identityNumber);
    let teacher = await prisma.teacher.create({
      data: {
        ...fields,
        identityNumber,
        campusId: req.campusId,
        academicYearId: req.academicYearId,
      },
    });

    if (photoPayload) {
      try {
        const saved = saveTeacherPhotoFile({
          teacherId: teacher.id,
          ...photoPayload,
        });
        teacher = await prisma.teacher.update({
          where: { id: teacher.id },
          data: saved,
        });
      } catch (photoErr) {
        await prisma.teacher.delete({ where: { id: teacher.id } }).catch(() => {});
        throw photoErr;
      }
    }

    res.status(201).json(serializeTeacher(teacher, { includePhotoUrl: true }));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.teacher.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Teacher not found' });

    const fields = pickTeacherFields(req.body);
    const photoPayload = extractPhotoPayload(req.body);
    const clearPhoto = req.body.clearPhoto === true;

    let data = { ...fields };
    data.identityNumber = await resolveStaffIdentityNumber(
      prisma,
      req.body.identityNumber ?? existing.identityNumber,
      { teacherId: existing.id },
    );

    if (clearPhoto && !photoPayload) {
      removeTeacherPhotoFile(existing.photoPath);
      data = { ...data, photoPath: null, photoMimeType: null };
    } else if (photoPayload) {
      const saved = saveTeacherPhotoFile({
        teacherId: existing.id,
        ...photoPayload,
        previousPhotoPath: existing.photoPath,
      });
      data = { ...data, ...saved };
    }

    const teacher = await prisma.teacher.update({
      where: { id: req.params.id },
      data,
    });

    if (photoPayload || clearPhoto) {
      await syncLinkedUserPhoto(existing.id, photoPayload, { clear: clearPhoto && !photoPayload });
    }
    if (teacher.identityNumber) {
      await prisma.user.updateMany({
        where: { teacherId: teacher.id },
        data: { identityNumber: teacher.identityNumber },
      }).catch(() => {});
    }

    res.json(serializeTeacher(teacher, { includePhotoUrl: true }));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/:id/photo', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot update staff photos' });
    }
    const existing = await prisma.teacher.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Teacher not found' });

    const { fileName, contentBase64, mimeType } = req.body || {};
    const saved = saveTeacherPhotoFile({
      teacherId: existing.id,
      fileName,
      contentBase64,
      mimeType,
      previousPhotoPath: existing.photoPath,
    });

    const teacher = await prisma.teacher.update({
      where: { id: existing.id },
      data: saved,
    });
    await syncLinkedUserPhoto(existing.id, { fileName, contentBase64, mimeType });
    res.json(serializeTeacher(teacher, { includePhotoUrl: true }));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete('/:id/photo', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete staff photos' });
    }
    const existing = await prisma.teacher.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Teacher not found' });

    removeTeacherPhotoFile(existing.photoPath);
    const teacherDir = path.join(TEACHER_UPLOADS_DIR, existing.id);
    try {
      if (fs.existsSync(teacherDir)) fs.rmSync(teacherDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    const teacher = await prisma.teacher.update({
      where: { id: existing.id },
      data: { photoPath: null, photoMimeType: null },
    });
    await syncLinkedUserPhoto(existing.id, null, { clear: true });
    res.json(serializeTeacher(teacher, { includePhotoUrl: true }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.teacher.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Teacher not found' });

    removeTeacherPhotoFile(existing.photoPath);
    const teacherDir = path.join(TEACHER_UPLOADS_DIR, existing.id);
    try {
      if (fs.existsSync(teacherDir)) fs.rmSync(teacherDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    await prisma.teacher.delete({ where: { id: req.params.id } });
    res.json({ message: 'Teacher deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
