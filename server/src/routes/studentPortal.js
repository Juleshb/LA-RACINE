import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';
import { getSessionStatus } from '../lib/meetingLinks.js';
import { campusYearWhere } from '../lib/scope.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import {
  checkAiRateLimit,
  isAiConfigured,
  normalizeChatMessages,
  streamStudentAiReply,
} from '../lib/studentAi.js';

const router = Router();
const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function requireStudent(req, res) {
  if (req.user.role !== 'STUDENT') {
    res.status(403).json({ error: 'This endpoint is for student accounts only' });
    return false;
  }
  return true;
}

router.get('/photo', authorizePermission(PERMISSIONS.DASHBOARD), async (req, res) => {
  try {
    if (!requireStudent(req, res)) return;
    if (!req.user.studentId) {
      return res.status(404).json({ error: 'No student linked to this account' });
    }

    const student = await prisma.student.findFirst({
      where: { id: req.user.studentId, campusId: req.campusId },
      include: {
        documents: {
          where: { docType: 'PHOTO' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!student?.documents?.[0]) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const doc = student.documents[0];
    const absPath = path.resolve(serverRoot, doc.filePath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Photo file missing' });
    }

    if (doc.mimeType) res.setHeader('Content-Type', doc.mimeType);
    res.sendFile(absPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Aggregated student dashboard — homework, e-library, e-learning. */
router.get('/dashboard', authorizePermission(PERMISSIONS.DASHBOARD), async (req, res) => {
  try {
    if (!requireStudent(req, res)) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const base = campusYearWhere(req);

    if (!req.user.studentId) {
      return res.json({
        student: null,
        upcomingHomework: [],
        homeworkGrades: { completed: 0, averagePercent: null, recentSubmissions: [] },
        eLibraryItems: [],
        eLearningCourses: [],
        onlineClasses: [],
      });
    }

    const student = await prisma.student.findFirst({
      where: { id: req.user.studentId, ...base, registrationStatus: 'APPROVED' },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        classId: true,
        class: { select: { id: true, name: true, grade: true, section: true } },
      },
    });

    if (!student) {
      return res.json({
        student: null,
        upcomingHomework: [],
        homeworkGrades: { completed: 0, averagePercent: null, recentSubmissions: [] },
        eLibraryItems: [],
        eLearningCourses: [],
        onlineClasses: [],
      });
    }

    const [homeworkItems, eLibraryItems, eLearningCourses, homeworkSubmissions, onlineClassRows] = await Promise.all([
      student.classId
        ? prisma.homework.findMany({
            where: {
              campusId: req.campusId,
              academicYearId: req.academicYearId,
              classId: student.classId,
              dueDate: { gte: today },
            },
            orderBy: { dueDate: 'asc' },
            take: 5,
            include: {
              class: { select: { name: true } },
              subject: { select: { name: true } },
              submissions: {
                where: { studentId: student.id },
                select: { score: true, maxScore: true, submittedAt: true },
                take: 1,
              },
            },
          })
        : [],
      prisma.eLibraryItem.findMany({
        where: { campusId: req.campusId, isPublished: true },
        orderBy: { title: 'asc' },
        take: 6,
      }),
      prisma.eLearningCourse.findMany({
        where: {
          campusId: req.campusId,
          academicYearId: req.academicYearId,
          isPublished: true,
          OR: [{ classId: null }, { classId: student.classId }],
        },
        orderBy: { sortOrder: 'asc' },
        take: 6,
        include: {
          class: { select: { name: true } },
          _count: { select: { lessons: true, exercises: true } },
        },
      }),
      prisma.homeworkSubmission.findMany({
        where: { studentId: student.id },
        include: {
          homework: {
            select: { title: true, subject: { select: { name: true } } },
          },
        },
        orderBy: { submittedAt: 'desc' },
        take: 5,
      }),
      student.classId
        ? prisma.onlineClassSession.findMany({
            where: {
              campusId: req.campusId,
              academicYearId: req.academicYearId,
              classId: student.classId,
              isPublished: true,
            },
            include: {
              class: { select: { name: true } },
              subject: { select: { name: true } },
            },
            orderBy: { scheduledAt: 'asc' },
            take: 8,
          })
        : [],
    ]);

    const upcomingHomework = homeworkItems.map((item) => ({
      ...item,
      mySubmission: item.submissions?.[0] || null,
      submissions: undefined,
    }));

    const totalScore = homeworkSubmissions.reduce((sum, s) => sum + s.score, 0);
    const totalMax = homeworkSubmissions.reduce((sum, s) => sum + s.maxScore, 0);

    res.json({
      student,
      upcomingHomework,
      homeworkGrades: {
        completed: homeworkSubmissions.length,
        averagePercent: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null,
        recentSubmissions: homeworkSubmissions.map((s) => ({
          homeworkId: s.homeworkId,
          title: s.homework.title,
          subject: s.homework.subject?.name,
          score: s.score,
          maxScore: s.maxScore,
          percent: s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0,
          submittedAt: s.submittedAt,
        })),
      },
      eLibraryItems,
      eLearningCourses,
      onlineClasses: onlineClassRows.map((session) => {
        const status = getSessionStatus(session);
        return { ...session, status: status.key, statusLabel: status.label };
      }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai-status', authorizePermission(PERMISSIONS.AI_TUTOR), async (req, res) => {
  try {
    if (!requireStudent(req, res)) return;
    res.json({ configured: isAiConfigured() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function conversationTitleFromMessages(messages) {
  const firstUser = messages.find((m) => m.role === 'user');
  const text = String(firstUser?.content || 'Chat').replace(/\s+/g, ' ').trim();
  return text.length > 60 ? `${text.slice(0, 57)}…` : text || 'Chat';
}

router.get('/ai-chats', authorizePermission(PERMISSIONS.AI_TUTOR), async (req, res) => {
  try {
    if (!requireStudent(req, res)) return;
    if (!req.user.studentId) return res.json([]);

    const chats = await prisma.aiConversation.findMany({
      where: {
        studentId: req.user.studentId,
        campusId: req.campusId,
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, role: true },
        },
        _count: { select: { messages: true } },
      },
    });

    res.json(chats.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
      preview: c.messages[0]?.content || '',
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai-chats/:id', authorizePermission(PERMISSIONS.AI_TUTOR), async (req, res) => {
  try {
    if (!requireStudent(req, res)) return;
    if (!req.user.studentId) return res.status(404).json({ error: 'Chat not found' });

    const chat = await prisma.aiConversation.findFirst({
      where: {
        id: req.params.id,
        studentId: req.user.studentId,
        campusId: req.campusId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai-chats', authorizePermission(PERMISSIONS.AI_TUTOR), async (req, res) => {
  try {
    if (!requireStudent(req, res)) return;
    if (!req.user.studentId) {
      return res.status(400).json({ error: 'No student linked to this account' });
    }

    const messages = normalizeChatMessages(req.body?.messages);
    if (!messages.length) {
      return res.status(400).json({ error: 'Nothing to save' });
    }

    const conversationId = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
    const title = conversationTitleFromMessages(messages);

    let conversation = null;
    if (conversationId) {
      conversation = await prisma.aiConversation.findFirst({
        where: {
          id: conversationId,
          studentId: req.user.studentId,
          campusId: req.campusId,
        },
      });
    }

    if (conversation) {
      await prisma.$transaction([
        prisma.aiMessage.deleteMany({ where: { conversationId: conversation.id } }),
        prisma.aiConversation.update({
          where: { id: conversation.id },
          data: {
            title,
            academicYearId: req.academicYearId || null,
            messages: {
              create: messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            },
          },
        }),
      ]);
      conversation = await prisma.aiConversation.findUnique({
        where: { id: conversation.id },
        select: { id: true, title: true, updatedAt: true },
      });
    } else {
      // Cap stored chats per student
      const count = await prisma.aiConversation.count({
        where: { studentId: req.user.studentId, campusId: req.campusId },
      });
      if (count >= 40) {
        const oldest = await prisma.aiConversation.findMany({
          where: { studentId: req.user.studentId, campusId: req.campusId },
          orderBy: { updatedAt: 'asc' },
          take: count - 39,
          select: { id: true },
        });
        if (oldest.length) {
          await prisma.aiConversation.deleteMany({
            where: { id: { in: oldest.map((o) => o.id) } },
          });
        }
      }

      conversation = await prisma.aiConversation.create({
        data: {
          campusId: req.campusId,
          studentId: req.user.studentId,
          academicYearId: req.academicYearId || null,
          title,
          messages: {
            create: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          },
        },
        select: { id: true, title: true, updatedAt: true },
      });
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/ai-chats/:id', authorizePermission(PERMISSIONS.AI_TUTOR), async (req, res) => {
  try {
    if (!requireStudent(req, res)) return;
    if (!req.user.studentId) return res.status(404).json({ error: 'Chat not found' });

    const existing = await prisma.aiConversation.findFirst({
      where: {
        id: req.params.id,
        studentId: req.user.studentId,
        campusId: req.campusId,
      },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Chat not found' });

    await prisma.aiConversation.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai-chat', authorizePermission(PERMISSIONS.AI_TUTOR), async (req, res) => {
  try {
    if (!requireStudent(req, res)) return;
    if (!req.user.studentId) {
      return res.status(400).json({ error: 'No student linked to this account' });
    }
    if (!isAiConfigured()) {
      return res.status(503).json({
        error: 'AI tutor is not available yet. Ask your school to enable it.',
      });
    }
    if (!checkAiRateLimit(req.user.id)) {
      return res.status(429).json({
        error: 'You have asked many questions today. Take a short break and try again later.',
      });
    }

    const messages = normalizeChatMessages(req.body?.messages);
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Please send a question to ask Racine AI.' });
    }

    const student = await prisma.student.findFirst({
      where: { id: req.user.studentId, campusId: req.campusId },
      select: {
        firstName: true,
        lastName: true,
        registrationClass: true,
        class: { select: { name: true, grade: true } },
      },
    });

    await streamStudentAiReply({
      messages,
      student,
      res,
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(error.status || 500).json({ error: error.message || 'AI tutor failed' });
    }
  }
});

export default router;
