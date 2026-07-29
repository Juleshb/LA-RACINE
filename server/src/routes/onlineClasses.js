import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { homeworkScopeWhere, resolveClassIdFilter } from '../lib/scope.js';
import { assertTeacherClassAccess } from '../lib/teacherAccess.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { getSessionStatus, validateMeetingUrl } from '../lib/meetingLinks.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.ONLINE_CLASSES));

const sessionInclude = {
  class: { select: { name: true, grade: true, section: true } },
  subject: { select: { name: true, code: true } },
};

function canManage(role) {
  return !['STUDENT', 'PARENT'].includes(role);
}

function enrichSession(session) {
  const status = getSessionStatus(session);
  return { ...session, status: status.key, statusLabel: status.label };
}

router.get('/', async (req, res) => {
  try {
    const scope = await homeworkScopeWhere(req);
    const classId = await resolveClassIdFilter(req, req.query.classId);
    const where = {
      ...scope,
      ...(classId ? { classId } : {}),
    };

    if (req.user.role === 'STUDENT' || req.user.role === 'PARENT') {
      where.isPublished = true;
    }

    const sessions = await prisma.onlineClassSession.findMany({
      where,
      include: sessionInclude,
      orderBy: { scheduledAt: 'asc' },
    });

    res.json(sessions.map(enrichSession));
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const scope = await homeworkScopeWhere(req);
    const session = await prisma.onlineClassSession.findFirst({
      where: {
        id: req.params.id,
        ...scope,
        ...((req.user.role === 'STUDENT' || req.user.role === 'PARENT') ? { isPublished: true } : {}),
      },
      include: sessionInclude,
    });
    if (!session) return res.status(404).json({ error: 'Online class not found' });
    res.json(enrichSession(session));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!canManage(req.user.role)) {
      return res.status(403).json({ error: 'You cannot schedule online classes' });
    }

    const {
      classId, subjectId, title, description, scheduledAt,
      durationMinutes, meetingUrl, meetingProvider, isPublished,
    } = req.body;

    if (!classId || !title?.trim() || !scheduledAt) {
      return res.status(400).json({ error: 'Class, title, and date/time are required' });
    }

    await assertTeacherClassAccess(req, classId);

    const provider = meetingProvider || 'GOOGLE_MEET';
    const linkCheck = validateMeetingUrl(meetingUrl, provider);
    if (!linkCheck.ok) return res.status(400).json({ error: linkCheck.error });

    const session = await prisma.onlineClassSession.create({
      data: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        classId,
        subjectId: subjectId || null,
        title: title.trim(),
        description: description?.trim() || null,
        scheduledAt: new Date(scheduledAt),
        durationMinutes: Number(durationMinutes) > 0 ? Number(durationMinutes) : 45,
        meetingUrl: linkCheck.url,
        meetingProvider: linkCheck.provider,
        isPublished: isPublished !== false,
        createdById: req.user.id,
      },
      include: sessionInclude,
    });

    res.status(201).json(enrichSession(session));
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!canManage(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit online classes' });
    }

    const scope = await homeworkScopeWhere(req);
    const existing = await prisma.onlineClassSession.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Online class not found' });

    const classId = req.body.classId || existing.classId;
    await assertTeacherClassAccess(req, classId);

    const provider = req.body.meetingProvider || existing.meetingProvider;
    const meetingUrl = req.body.meetingUrl ?? existing.meetingUrl;
    const linkCheck = validateMeetingUrl(meetingUrl, provider);
    if (!linkCheck.ok) return res.status(400).json({ error: linkCheck.error });

    const session = await prisma.onlineClassSession.update({
      where: { id: existing.id },
      data: {
        classId,
        subjectId: req.body.subjectId !== undefined ? (req.body.subjectId || null) : undefined,
        title: req.body.title?.trim() || undefined,
        description: req.body.description !== undefined ? (req.body.description?.trim() || null) : undefined,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
        durationMinutes: req.body.durationMinutes !== undefined
          ? (Number(req.body.durationMinutes) > 0 ? Number(req.body.durationMinutes) : 45)
          : undefined,
        meetingUrl: linkCheck.url,
        meetingProvider: linkCheck.provider,
        isPublished: req.body.isPublished !== undefined ? Boolean(req.body.isPublished) : undefined,
      },
      include: sessionInclude,
    });

    res.json(enrichSession(session));
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!canManage(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete online classes' });
    }

    const scope = await homeworkScopeWhere(req);
    const existing = await prisma.onlineClassSession.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Online class not found' });

    await prisma.onlineClassSession.delete({ where: { id: existing.id } });
    res.json({ message: 'Online class deleted' });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

export default router;
