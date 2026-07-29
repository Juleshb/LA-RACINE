import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { campusYearWhere, studentScopeWhere } from '../lib/scope.js';
import { getTeacherClassIdsForReq, resolveTeacherId } from '../lib/teacherAccess.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.COMMUNICATION));

const SCHOOL_ROLES = ['SCHOOL_MANAGER', 'SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE', 'ACCOUNTANT', 'TEACHER'];

function isSchoolStaff(role) {
  return SCHOOL_ROLES.includes(role);
}

function senderLabel(user) {
  if (!user) return 'Unknown';
  if (user.role === 'PARENT') return `${user.firstName} ${user.lastName} (Parent)`;
  return `${user.firstName} ${user.lastName} (${user.role.replace(/_/g, ' ')})`;
}

async function getParentUserIdsForTarget(req, { targetType, targetClassId, targetStudentId }) {
  const base = campusYearWhere(req);
  let studentWhere = { ...base };

  if (targetType === 'CLASS' && targetClassId) {
    studentWhere = { ...base, classId: targetClassId };
  } else if (targetType === 'STUDENT' && targetStudentId) {
    studentWhere = { ...base, id: targetStudentId };
  }

  const students = await prisma.student.findMany({
    where: { ...studentWhere, parentId: { not: null } },
    select: { parentId: true },
  });

  const parentIds = [...new Set(students.map((s) => s.parentId).filter(Boolean))];
  if (!parentIds.length) return [];

  const users = await prisma.user.findMany({
    where: { parentId: { in: parentIds }, role: 'PARENT', isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function broadcastAppliesToUser(req, broadcast) {
  if (req.user.role === 'PARENT') {
    const parentUserIds = await getParentUserIdsForTarget(req, {
      targetType: broadcast.targetType,
      targetClassId: broadcast.targetClassId,
      targetStudentId: broadcast.targetStudentId,
    });
    return parentUserIds.includes(req.user.id);
  }

  if (req.user.role === 'STUDENT' && req.user.studentId) {
    if (broadcast.targetType === 'ALL_PARENTS') return true;
    if (broadcast.targetType === 'CLASS') {
      const student = await prisma.student.findUnique({
        where: { id: req.user.studentId },
        select: { classId: true },
      });
      return student?.classId === broadcast.targetClassId;
    }
    if (broadcast.targetType === 'STUDENT') {
      return broadcast.targetStudentId === req.user.studentId;
    }
    return false;
  }

  if (isSchoolStaff(req.user.role) || req.user.role === 'TEACHER') return true;
  return false;
}

async function getTransportAlertsForInbox(req) {
  const base = campusYearWhere(req);
  let routeFilter = {};

  if (req.user.role === 'PARENT' && req.user.parentId) {
    const enrollments = await prisma.studentTransport.findMany({
      where: { isActive: true, student: { parentId: req.user.parentId, ...base } },
      select: { routeId: true },
    });
    const routeIds = [...new Set(enrollments.map((e) => e.routeId))];
    routeFilter = { OR: [{ routeId: null }, { routeId: { in: routeIds } }] };
  } else if (req.user.role === 'STUDENT' && req.user.studentId) {
    const enrollment = await prisma.studentTransport.findFirst({
      where: { studentId: req.user.studentId, isActive: true },
      select: { routeId: true },
    });
    routeFilter = enrollment?.routeId
      ? { OR: [{ routeId: null }, { routeId: enrollment.routeId }] }
      : { routeId: null };
  }

  if (!['PARENT', 'STUDENT'].includes(req.user.role) && !isSchoolStaff(req.user.role)) {
    return [];
  }

  const alerts = await prisma.transportAlert.findMany({
    where: {
      ...base,
      ...routeFilter,
      notifyParents: true,
      effectiveDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { route: { select: { name: true } } },
  });

  return alerts.map((a) => ({
    id: `transport-${a.id}`,
    type: 'transport_alert',
    title: a.title,
    body: a.message,
    category: 'TRANSPORT',
    priority: a.type === 'DELAY' || a.type === 'CANCELLATION' ? 'URGENT' : 'NORMAL',
    createdAt: a.createdAt,
    meta: { routeName: a.route?.name, delayMinutes: a.delayMinutes, alertType: a.type },
    isRead: true,
  }));
}

// ─── Parent children (for composing messages) ─────────────────────────────────

router.get('/children', async (req, res) => {
  try {
    if (req.user.role !== 'PARENT' || !req.user.parentId) {
      return res.json([]);
    }
    const children = await prisma.student.findMany({
      where: { parentId: req.user.parentId, ...campusYearWhere(req) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        class: { select: { name: true, grade: true } },
      },
    });
    res.json(children.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      className: c.class?.name,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Unread count ─────────────────────────────────────────────────────────────

router.get('/unread-count', async (req, res) => {
  try {
    if (!['PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.json({ count: 0 });
    }

    const broadcasts = await prisma.communicationBroadcast.findMany({
      where: campusYearWhere(req),
      include: { reads: { where: { userId: req.user.id } } },
    });

    let unread = 0;
    for (const b of broadcasts) {
      const applies = await broadcastAppliesToUser(req, b);
      if (applies && !b.reads.length) unread += 1;
    }

    let threadWhere = { ...campusYearWhere(req), status: 'OPEN' };
    if (req.user.role === 'PARENT' && req.user.parentId) {
      threadWhere.parentId = req.user.parentId;
    } else if (req.user.role === 'STUDENT' && req.user.studentId) {
      threadWhere.studentId = req.user.studentId;
    } else {
      return res.json({ count: unread });
    }

    const threads = await prisma.communicationThread.findMany({
      where: threadWhere,
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    for (const t of threads) {
      const last = t.messages[0];
      if (last && last.senderId !== req.user.id) {
        unread += 1;
      }
    }

    res.json({ count: unread });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Inbox (unified feed) ─────────────────────────────────────────────────────

router.get('/inbox', async (req, res) => {
  try {
    const base = campusYearWhere(req);
    const items = [];

    const broadcasts = await prisma.communicationBroadcast.findMany({
      where: base,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        createdBy: { select: { firstName: true, lastName: true, role: true } },
        targetClass: { select: { name: true } },
        targetStudent: { select: { firstName: true, lastName: true } },
        reads: ['PARENT', 'STUDENT'].includes(req.user.role)
          ? { where: { userId: req.user.id } }
          : false,
      },
    });

    for (const b of broadcasts) {
      if (['PARENT', 'STUDENT'].includes(req.user.role)) {
        const applies = await broadcastAppliesToUser(req, b);
        if (!applies) continue;
      }

      items.push({
        id: b.id,
        type: 'announcement',
        title: b.title,
        body: b.body,
        category: b.category,
        priority: b.priority,
        targetType: b.targetType,
        targetLabel: b.targetClass?.name
          || (b.targetStudent ? `${b.targetStudent.firstName} ${b.targetStudent.lastName}` : 'All parents'),
        createdAt: b.createdAt,
        createdBy: senderLabel(b.createdBy),
        isRead: ['PARENT', 'STUDENT'].includes(req.user.role) ? b.reads?.length > 0 : true,
      });
    }

    const transportAlerts = await getTransportAlertsForInbox(req);
    items.push(...transportAlerts);

    let threadWhere = { ...base };
    if (req.user.role === 'PARENT' && req.user.parentId) {
      threadWhere.parentId = req.user.parentId;
    } else if (req.user.role === 'STUDENT' && req.user.studentId) {
      threadWhere.studentId = req.user.studentId;
    } else if (req.user.role === 'TEACHER') {
      const teacherId = await resolveTeacherId(req);
      const ids = teacherId
        ? await getTeacherClassIdsForReq(req)
        : [];
      threadWhere = ids.length
        ? {
            ...base,
            OR: [
              { student: { classId: { in: ids } } },
              { initiatedBy: 'SCHOOL' },
            ],
          }
        : { ...base, id: { in: [] } };
    }

    const threads = await prisma.communicationThread.findMany({
      where: threadWhere,
      orderBy: { lastMessageAt: 'desc' },
      take: 30,
      include: {
        student: { select: { firstName: true, lastName: true, class: { select: { name: true } } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
      },
    });

    for (const t of threads) {
      const lastMsg = t.messages[0];
      items.push({
        id: t.id,
        type: 'thread',
        title: t.subject,
        body: lastMsg?.body || '',
        category: t.category,
        status: t.status,
        studentName: t.student ? `${t.student.firstName} ${t.student.lastName}` : null,
        className: t.student?.class?.name,
        createdAt: t.lastMessageAt,
        lastSender: lastMsg ? senderLabel(lastMsg.sender) : null,
        isRead: lastMsg ? lastMsg.senderId === req.user.id : true,
        needsReply: req.user.role === 'PARENT'
          ? lastMsg?.senderId !== req.user.id && t.status === 'OPEN'
          : lastMsg?.sender?.role === 'PARENT' && t.status === 'OPEN',
      });
    }

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Broadcasts ───────────────────────────────────────────────────────────────

router.get('/broadcasts', async (req, res) => {
  try {
    const broadcasts = await prisma.communicationBroadcast.findMany({
      where: campusYearWhere(req),
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { firstName: true, lastName: true, role: true } },
        targetClass: { select: { name: true } },
        _count: { select: { reads: true } },
      },
    });
    res.json(broadcasts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/broadcasts', async (req, res) => {
  try {
    if (!isSchoolStaff(req.user.role)) {
      return res.status(403).json({ error: 'Only school staff can send announcements' });
    }

    const {
      title, body, category, priority, targetType, targetClassId, targetStudentId,
    } = req.body;

    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const broadcast = await prisma.communicationBroadcast.create({
      data: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        title: title.trim(),
        body: body.trim(),
        category: category || 'GENERAL',
        priority: priority || 'NORMAL',
        targetType: targetType || 'ALL_PARENTS',
        targetClassId: targetClassId || null,
        targetStudentId: targetStudentId || null,
        createdById: req.user.id,
      },
      include: {
        createdBy: { select: { firstName: true, lastName: true, role: true } },
        targetClass: { select: { name: true } },
      },
    });

    const recipientIds = await getParentUserIdsForTarget(req, {
      targetType: broadcast.targetType,
      targetClassId: broadcast.targetClassId,
      targetStudentId: broadcast.targetStudentId,
    });

    res.status(201).json({ broadcast, recipientsCount: recipientIds.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/broadcasts/:id/read', async (req, res) => {
  try {
    const broadcast = await prisma.communicationBroadcast.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!broadcast) return res.status(404).json({ error: 'Not found' });

    await prisma.communicationBroadcastRead.upsert({
      where: {
        broadcastId_userId: { broadcastId: broadcast.id, userId: req.user.id },
      },
      create: { broadcastId: broadcast.id, userId: req.user.id },
      update: { readAt: new Date() },
    });

    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Threads (two-way messages) ───────────────────────────────────────────────

router.get('/threads', async (req, res) => {
  try {
    const base = campusYearWhere(req);
    let where = { ...base };

    if (req.user.role === 'PARENT' && req.user.parentId) {
      where.parentId = req.user.parentId;
    }

    const threads = await prisma.communicationThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        student: { include: { class: { select: { name: true } } } },
        createdBy: { select: { firstName: true, lastName: true, role: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
      },
    });

    res.json(threads.map((t) => ({
      ...t,
      messages: t.messages.map((m) => ({
        ...m,
        senderLabel: senderLabel(m.sender),
        isMine: m.senderId === req.user.id,
      })),
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/threads/:id', async (req, res) => {
  try {
    const thread = await prisma.communicationThread.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
      include: {
        student: { include: { class: { select: { name: true } } } },
        parent: true,
        createdBy: { select: { firstName: true, lastName: true, role: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
      },
    });
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    if (req.user.role === 'PARENT' && thread.parentId !== req.user.parentId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'STUDENT' && thread.studentId !== req.user.studentId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      ...thread,
      messages: thread.messages.map((m) => ({
        ...m,
        senderLabel: senderLabel(m.sender),
        isMine: m.senderId === req.user.id,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/threads', async (req, res) => {
  try {
    const { subject, body, category, studentId } = req.body;
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    let parentId = null;
    let initiatedBy = 'SCHOOL';

    if (req.user.role === 'PARENT') {
      if (!req.user.parentId) return res.status(400).json({ error: 'Parent account not linked' });
      if (!studentId) return res.status(400).json({ error: 'Select which child this is about' });

      const child = await prisma.student.findFirst({
        where: { id: studentId, parentId: req.user.parentId, ...campusYearWhere(req) },
      });
      if (!child) return res.status(403).json({ error: 'Child not found' });

      parentId = req.user.parentId;
      initiatedBy = 'PARENT';
    } else if (req.user.role === 'STUDENT') {
      if (!req.user.studentId) return res.status(400).json({ error: 'Student account not linked' });

      const student = await prisma.student.findFirst({
        where: { id: req.user.studentId, ...campusYearWhere(req) },
        select: { id: true, parentId: true },
      });
      if (!student) return res.status(403).json({ error: 'Student record not found' });

      parentId = student.parentId || null;
      initiatedBy = 'PARENT';
    } else if (!isSchoolStaff(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    } else if (studentId) {
      const student = await prisma.student.findFirst({
        where: { id: studentId, ...campusYearWhere(req) },
        select: { parentId: true },
      });
      parentId = student?.parentId || null;
    }

    const thread = await prisma.communicationThread.create({
      data: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        subject: subject.trim(),
        category: category || 'GENERAL',
        studentId: req.user.role === 'STUDENT' ? req.user.studentId : (studentId || null),
        parentId,
        initiatedBy,
        createdById: req.user.id,
        messages: {
          create: {
            senderId: req.user.id,
            body: body.trim(),
          },
        },
      },
      include: {
        student: { include: { class: { select: { name: true } } } },
        messages: {
          include: { sender: { select: { firstName: true, lastName: true, role: true } } },
        },
      },
    });

    res.status(201).json(thread);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/threads/:id/messages', async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message is required' });

    const thread = await prisma.communicationThread.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    if (req.user.role === 'PARENT' && thread.parentId !== req.user.parentId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'STUDENT' && thread.studentId !== req.user.studentId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (thread.status === 'ARCHIVED') {
      return res.status(400).json({ error: 'This conversation is archived' });
    }

    const message = await prisma.communicationMessage.create({
      data: {
        threadId: thread.id,
        senderId: req.user.id,
        body: body.trim(),
      },
      include: { sender: { select: { firstName: true, lastName: true, role: true } } },
    });

    await prisma.communicationThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date(), status: 'OPEN' },
    });

    res.status(201).json({
      ...message,
      senderLabel: senderLabel(message.sender),
      isMine: true,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/threads/:id/status', async (req, res) => {
  try {
    if (!isSchoolStaff(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status } = req.body;
    const thread = await prisma.communicationThread.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(thread);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
