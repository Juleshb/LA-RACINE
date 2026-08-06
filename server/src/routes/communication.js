import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { campusYearWhere, studentScopeWhere } from '../lib/scope.js';
import { getTeacherClassIdsForReq, resolveTeacherId } from '../lib/teacherAccess.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import {
  buildBroadcastSmsBody,
  dedupePhones,
  getSmsSkipReason,
  isSmsConfigured,
  sendBulkSms,
} from '../lib/sms.js';
import { getMailSkipReason, isMailConfigured, sendMail } from '../lib/mailer.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.COMMUNICATION));

const SCHOOL_ROLES = ['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE', 'ACCOUNTANT', 'TEACHER'];

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

/**
 * Resolve unique parent phone numbers for a broadcast target.
 * Includes students without a portal parent account when contact phones exist.
 */
async function getParentPhonesForTarget(req, { targetType, targetClassId, targetStudentId }) {
  const base = campusYearWhere(req);
  let studentWhere = { ...base };

  if (targetType === 'CLASS' && targetClassId) {
    studentWhere = { ...base, classId: targetClassId };
  } else if (targetType === 'STUDENT' && targetStudentId) {
    studentWhere = { ...base, id: targetStudentId };
  }

  const students = await prisma.student.findMany({
    where: studentWhere,
    select: {
      parentPhone: true,
      fatherPhone: true,
      motherPhone: true,
      parentId: true,
      parent: { select: { phone: true } },
    },
  });

  const parentIds = [...new Set(students.map((s) => s.parentId).filter(Boolean))];
  let userPhones = [];
  if (parentIds.length) {
    const users = await prisma.user.findMany({
      where: { parentId: { in: parentIds }, role: 'PARENT', isActive: true },
      select: { phone: true },
    });
    userPhones = users.map((u) => u.phone);
  }

  const raw = [];
  for (const s of students) {
    if (s.parent?.phone) raw.push(s.parent.phone);
    if (s.parentPhone) raw.push(s.parentPhone);
    if (s.fatherPhone) raw.push(s.fatherPhone);
    if (s.motherPhone) raw.push(s.motherPhone);
  }
  raw.push(...userPhones);

  return dedupePhones(raw);
}

function normalizeEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function dedupeEmails(emails = []) {
  const seen = new Set();
  const out = [];
  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/**
 * Resolve unique parent portal emails for a broadcast target.
 */
async function getParentEmailsForTarget(req, { targetType, targetClassId, targetStudentId }) {
  const base = campusYearWhere(req);
  let studentWhere = { ...base };

  if (targetType === 'CLASS' && targetClassId) {
    studentWhere = { ...base, classId: targetClassId };
  } else if (targetType === 'STUDENT' && targetStudentId) {
    studentWhere = { ...base, id: targetStudentId };
  }

  const students = await prisma.student.findMany({
    where: studentWhere,
    select: {
      parentId: true,
      fatherEmail: true,
      motherEmail: true,
      parent: {
        select: {
          user: { select: { email: true, isActive: true, role: true } },
        },
      },
    },
  });

  const parentIds = [...new Set(students.map((s) => s.parentId).filter(Boolean))];
  const fromUsers = [];
  if (parentIds.length) {
    const users = await prisma.user.findMany({
      where: { parentId: { in: parentIds }, role: 'PARENT', isActive: true },
      select: { email: true },
    });
    fromUsers.push(...users.map((u) => u.email));
  }

  const fromStudentParents = students.flatMap((s) => [
    s.parent?.user?.role === 'PARENT' && s.parent?.user?.isActive ? s.parent.user.email : null,
    s.fatherEmail,
    s.motherEmail,
  ]);

  return dedupeEmails([...fromUsers, ...fromStudentParents]);
}

async function getEmailsForParentId(parentId) {
  if (!parentId) return [];
  const [users, students] = await Promise.all([
    prisma.user.findMany({
      where: { parentId, role: 'PARENT', isActive: true },
      select: { email: true },
    }),
    prisma.student.findMany({
      where: { parentId },
      select: { fatherEmail: true, motherEmail: true },
    }),
  ]);
  return dedupeEmails([
    ...users.map((u) => u.email),
    ...students.flatMap((s) => [s.fatherEmail, s.motherEmail]),
  ]);
}

function buildBroadcastEmailHtml(title, body) {
  const safeTitle = String(title || '').replace(/</g, '&lt;');
  const safeBody = String(body || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0284c7;">École La RACINE</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${safeTitle}</h1>
      <div style="font-size:15px;line-height:1.6;color:#334155;">${safeBody}</div>
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">Open your parent portal to read and reply in Messages.</p>
    </div>
  `;
}

async function sendBroadcastEmails({ emails, title, body }) {
  const requested = emails.length;
  if (!requested) {
    return { requested: 0, sent: 0, failed: 0, skipped: 0, error: 'No parent emails found for this target' };
  }
  if (!isMailConfigured()) {
    return {
      requested,
      sent: 0,
      failed: 0,
      skipped: requested,
      error: getMailSkipReason() || 'Email not configured',
    };
  }

  let sent = 0;
  let failed = 0;
  const errors = [];
  const html = buildBroadcastEmailHtml(title, body);
  const text = `${title}\n\n${body}\n\n— École La RACINE`;

  for (const to of emails) {
    try {
      await sendMail({ to, subject: `La RACINE: ${title}`, text, html });
      sent += 1;
    } catch (err) {
      failed += 1;
      if (errors.length < 3) errors.push(err.message || 'Send failed');
    }
  }

  return {
    requested,
    sent,
    failed,
    skipped: 0,
    error: failed ? (errors[0] || `${failed} email(s) failed`) : undefined,
  };
}

/** Notify parent(s) by email when school staff messages them (best-effort). */
async function notifyParentEmails({ parentId, title, body }) {
  if (!isMailConfigured() || !parentId) {
    return { requested: 0, sent: 0, failed: 0, skipped: 0 };
  }
  const emails = await getEmailsForParentId(parentId);
  return sendBroadcastEmails({ emails, title, body });
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
        _count: { select: { reads: true } },
      },
    });

    for (const b of broadcasts) {
      if (['PARENT', 'STUDENT'].includes(req.user.role)) {
        const applies = await broadcastAppliesToUser(req, b);
        if (!applies) continue;
      }

      const deliveryMeta = b.deliveryMeta && typeof b.deliveryMeta === 'object' ? b.deliveryMeta : {};
      const recipientsCount = Number(deliveryMeta.recipientsCount) || 0;
      const readCount = b._count?.reads ?? (Array.isArray(b.reads) ? b.reads.length : 0);

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
        delivery: isSchoolStaff(req.user.role) || req.user.role === 'TEACHER'
          ? {
              recipientsCount,
              readCount,
              sms: deliveryMeta.sms || null,
              email: deliveryMeta.email || null,
            }
          : undefined,
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

router.get('/channels', async (req, res) => {
  try {
    if (!isSchoolStaff(req.user.role)) {
      return res.json({ inApp: true, sms: { configured: false }, email: { configured: false } });
    }
    res.json({
      inApp: true,
      sms: {
        configured: isSmsConfigured(),
        reason: getSmsSkipReason(),
      },
      email: {
        configured: isMailConfigured(),
        reason: getMailSkipReason(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
      title, body, category, priority, targetType, targetClassId, targetStudentId, sendSms, sendEmail,
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

    let sms = null;
    if (sendSms) {
      const phones = await getParentPhonesForTarget(req, {
        targetType: broadcast.targetType,
        targetClassId: broadcast.targetClassId,
        targetStudentId: broadcast.targetStudentId,
      });

      if (!phones.length) {
        sms = {
          requested: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          error: 'No parent phone numbers found for this target',
        };
      } else if (!isSmsConfigured()) {
        sms = {
          requested: phones.length,
          sent: 0,
          failed: 0,
          skipped: phones.length,
          error: getSmsSkipReason() || 'SMS not configured',
        };
      } else {
        const smsBody = buildBroadcastSmsBody(broadcast.title, broadcast.body);
        const result = await sendBulkSms({ recipients: phones, body: smsBody });
        sms = {
          requested: result.requested,
          sent: result.sent,
          failed: result.failed,
          skipped: result.skipped,
          error: result.error || undefined,
        };
      }
    }

    let email = null;
    // Default ON when Gmail SMTP is configured (unless staff explicitly unchecks sendEmail)
    const wantEmail = sendEmail === true || (sendEmail !== false && isMailConfigured());
    if (wantEmail) {
      const emails = await getParentEmailsForTarget(req, {
        targetType: broadcast.targetType,
        targetClassId: broadcast.targetClassId,
        targetStudentId: broadcast.targetStudentId,
      });
      email = await sendBroadcastEmails({
        emails,
        title: broadcast.title,
        body: broadcast.body,
      });
    }

    const deliveryMeta = {
      recipientsCount: recipientIds.length,
      sms,
      email,
      sentAt: new Date().toISOString(),
    };

    await prisma.communicationBroadcast.update({
      where: { id: broadcast.id },
      data: { deliveryMeta },
    });

    res.status(201).json({
      broadcast: { ...broadcast, deliveryMeta },
      recipientsCount: recipientIds.length,
      sms,
      email,
      delivery: {
        inApp: {
          recipientsCount: recipientIds.length,
          readable: true,
          note: 'Parents/students see this in Messages when they open the portal',
        },
        sms,
        email,
      },
    });
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

    let email = null;
    if (isSchoolStaff(req.user.role) && parentId && isMailConfigured()) {
      email = await notifyParentEmails({
        parentId,
        title: subject.trim(),
        body: body.trim(),
      });
    }

    res.status(201).json({ ...thread, email });
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

    let email = null;
    if (isSchoolStaff(req.user.role) && thread.parentId && isMailConfigured()) {
      email = await notifyParentEmails({
        parentId: thread.parentId,
        title: thread.subject,
        body: body.trim(),
      });
    }

    res.status(201).json({
      ...message,
      senderLabel: senderLabel(message.sender),
      isMine: true,
      email,
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
