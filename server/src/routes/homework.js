import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { homeworkScopeWhere, resolveClassIdFilter, studentScopeWhere } from '../lib/scope.js';
import { assertTeacherClassAccess } from '../lib/teacherAccess.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { saveHomeworkAttachment, loadHomeworkAttachment, deleteHomeworkDir } from '../lib/homeworkFiles.js';
import { gradeSubmission } from '../lib/homeworkGrading.js';
import { normalizeHomeworkVideos } from '../lib/youtube.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.HOMEWORK));

const homeworkInclude = {
  class: { select: { name: true, grade: true, section: true } },
  subject: { select: { name: true, code: true } },
  attachments: { orderBy: { sortOrder: 'asc' } },
  videos: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, youtubeId: true, sortOrder: true } },
  questions: { orderBy: { sortOrder: 'asc' } },
  _count: { select: { questions: true, submissions: true } },
};

function stripCorrectAnswers(questions, hideAnswers) {
  if (!hideAnswers) return questions;
  return questions.map((q) => {
    const { correctAnswer, ...rest } = q;
    return rest;
  });
}

async function resolveStudentId(req) {
  if (req.user.role === 'STUDENT') return req.user.studentId || null;
  if (req.user.role === 'PARENT' && req.query.studentId) {
    const scope = await studentScopeWhere(req);
    const child = await prisma.student.findFirst({
      where: { id: req.query.studentId, ...scope },
      select: { id: true },
    });
    return child?.id || null;
  }
  return null;
}

router.get('/grades/summary', async (req, res) => {
  try {
    if (req.user.role === 'PARENT') {
      const scope = await studentScopeWhere(req);
      const children = await prisma.student.findMany({
        where: scope,
        select: { id: true, firstName: true, lastName: true, classId: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      });
      const summaries = await Promise.all(
        children.map((child) => buildHomeworkGradesSummary(child, req)),
      );
      return res.json({ children: summaries });
    }

    const studentId = req.user.role === 'STUDENT' ? req.user.studentId : null;
    if (!studentId) {
      return res.status(400).json({ error: 'Student account not linked' });
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, ...await studentScopeWhere(req) },
      select: { id: true, firstName: true, lastName: true, classId: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const summary = await buildHomeworkGradesSummary(student, req);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function buildHomeworkGradesSummary(student, req) {
  if (!student?.classId) {
    return {
      student,
      completed: 0,
      pending: 0,
      averagePercent: null,
      recentSubmissions: [],
    };
  }

  const homeworks = await prisma.homework.findMany({
    where: {
      campusId: req.campusId,
      academicYearId: req.academicYearId,
      classId: student.classId,
    },
    select: { id: true },
  });
  const homeworkIds = homeworks.map((h) => h.id);

  const submissions = homeworkIds.length
    ? await prisma.homeworkSubmission.findMany({
        where: { studentId: student.id, homeworkId: { in: homeworkIds } },
        include: {
          homework: {
            select: { id: true, title: true, dueDate: true, subject: { select: { name: true } } },
          },
        },
        orderBy: { submittedAt: 'desc' },
      })
    : [];

  const totalScore = submissions.reduce((sum, s) => sum + s.score, 0);
  const totalMax = submissions.reduce((sum, s) => sum + s.maxScore, 0);

  return {
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
    },
    completed: submissions.length,
    pending: Math.max(0, homeworkIds.length - submissions.length),
    averagePercent: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null,
    recentSubmissions: submissions.map((s) => ({
      id: s.id,
      homeworkId: s.homeworkId,
      title: s.homework.title,
      subject: s.homework.subject?.name,
      dueDate: s.homework.dueDate,
      score: s.score,
      maxScore: s.maxScore,
      percent: s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0,
      submittedAt: s.submittedAt,
    })),
  };
}

router.get('/', async (req, res) => {
  try {
    const { classId } = req.query;
    const scope = await homeworkScopeWhere(req);
    const safeClassId = classId ? await resolveClassIdFilter(req, classId) : undefined;
    const studentId = await resolveStudentId(req);

    const items = await prisma.homework.findMany({
      where: {
        ...scope,
        ...(safeClassId ? { classId: safeClassId } : {}),
      },
      orderBy: { dueDate: 'asc' },
      include: {
        class: { select: { name: true, grade: true, section: true } },
        subject: { select: { name: true, code: true } },
        _count: { select: { questions: true, attachments: true } },
        ...(studentId ? {
          submissions: {
            where: { studentId },
            select: { id: true, score: true, maxScore: true, submittedAt: true },
            take: 1,
          },
        } : {}),
      },
    });

    res.json(items.map((item) => ({
      ...item,
      mySubmission: item.submissions?.[0] || null,
      submissions: undefined,
    })));
  } catch (error) {
    if (error.status === 403) return res.status(403).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const scope = await homeworkScopeWhere(req);
    const item = await prisma.homework.findFirst({
      where: { id: req.params.id, ...scope },
      include: homeworkInclude,
    });
    if (!item) return res.status(404).json({ error: 'Homework not found' });

    const isStudentOrParent = ['STUDENT', 'PARENT'].includes(req.user.role);
    const studentId = await resolveStudentId(req);

    let mySubmission = null;
    if (studentId) {
      mySubmission = await prisma.homeworkSubmission.findUnique({
        where: { homeworkId_studentId: { homeworkId: item.id, studentId } },
        include: {
          answers: {
            include: {
              question: {
                select: {
                  id: true, prompt: true, type: true, points: true, options: true, correctAnswer: true,
                },
              },
            },
          },
        },
      });
    }

    res.json({
      ...item,
      questions: stripCorrectAnswers(item.questions, isStudentOrParent && !mySubmission),
      mySubmission,
    });
  } catch (error) {
    if (error.status === 403) return res.status(403).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/attachments/:attachmentId/file', async (req, res) => {
  try {
    const scope = await homeworkScopeWhere(req);
    const item = await prisma.homework.findFirst({
      where: { id: req.params.id, ...scope },
      select: { id: true },
    });
    if (!item) return res.status(404).json({ error: 'Homework not found' });

    const attachment = await prisma.homeworkAttachment.findFirst({
      where: { id: req.params.attachmentId, homeworkId: item.id },
    });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    const buffer = loadHomeworkAttachment(attachment.storagePath);
    if (!buffer) return res.status(404).json({ error: 'File not found' });

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName.replace(/"/g, '')}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot create homework' });
    }

    const {
      classId, subjectId, title, description, dueDate, questions = [], attachments = [], videos = [],
    } = req.body;
    if (!classId || !title || !dueDate) {
      return res.status(400).json({ error: 'Class, title, and due date are required' });
    }

    const normalizedVideos = normalizeHomeworkVideos(videos);
    const invalidVideoCount = (videos || []).filter((v) => (v?.videoUrl || v?.youtubeId)?.trim()).length
      - normalizedVideos.length;
    if (invalidVideoCount > 0) {
      return res.status(400).json({ error: 'One or more video links are not valid YouTube URLs' });
    }

    const teacherErr = await assertTeacherClassAccess(req, classId);
    if (teacherErr) return res.status(403).json({ error: teacherErr });

    const totalPoints = (questions || []).reduce((sum, q) => sum + (Number(q.points) || 1), 0);

    const item = await prisma.homework.create({
      data: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        classId,
        subjectId: subjectId || null,
        title,
        description,
        dueDate: new Date(dueDate),
        totalPoints,
        createdById: req.user.id,
        questions: {
          create: (questions || []).map((q, index) => ({
            sortOrder: index,
            type: q.type,
            prompt: q.prompt,
            options: q.options || null,
            correctAnswer: String(q.correctAnswer ?? ''),
            points: Number(q.points) || 1,
          })),
        },
        videos: normalizedVideos.length
          ? { create: normalizedVideos }
          : undefined,
      },
      include: homeworkInclude,
    });

    if (attachments?.length) {
      for (let i = 0; i < attachments.length; i += 1) {
        const file = attachments[i];
        const storagePath = saveHomeworkAttachment(item.id, file);
        await prisma.homeworkAttachment.create({
          data: {
            homeworkId: item.id,
            fileName: file.fileName,
            mimeType: file.mimeType,
            storagePath,
            sortOrder: i,
          },
        });
      }
    }

    const full = await prisma.homework.findUnique({
      where: { id: item.id },
      include: homeworkInclude,
    });
    res.status(201).json(full);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const studentId = await resolveStudentId(req);
    if (!studentId) {
      return res.status(403).json({ error: 'Student account not linked' });
    }

    const scope = await homeworkScopeWhere(req);
    const homework = await prisma.homework.findFirst({
      where: { id: req.params.id, ...scope },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!homework) return res.status(404).json({ error: 'Homework not found' });

    const existing = await prisma.homeworkSubmission.findUnique({
      where: { homeworkId_studentId: { homeworkId: homework.id, studentId } },
    });

    const raw = req.body?.answers;
    const answers = Array.isArray(raw) ? raw : [];
    const answersMap = Object.fromEntries(answers.map((a) => [a.questionId, a.answer]));
    const { score, maxScore, graded } = gradeSubmission(homework.questions, answersMap);

    const answerCreate = graded.map((g) => ({
      questionId: g.questionId,
      answer: g.answer,
      isCorrect: g.isCorrect,
      pointsEarned: g.pointsEarned,
    }));

    const submissionInclude = {
      answers: {
        include: {
          question: {
            select: {
              id: true, prompt: true, type: true, points: true, options: true, correctAnswer: true,
            },
          },
        },
      },
    };

    const submission = existing
      ? await prisma.$transaction(async (tx) => {
          await tx.homeworkAnswer.deleteMany({ where: { submissionId: existing.id } });
          return tx.homeworkSubmission.update({
            where: { id: existing.id },
            data: {
              score,
              maxScore,
              gradedAt: new Date(),
              submittedAt: new Date(),
              answers: { create: answerCreate },
            },
            include: submissionInclude,
          });
        })
      : await prisma.homeworkSubmission.create({
          data: {
            homeworkId: homework.id,
            studentId,
            score,
            maxScore,
            gradedAt: new Date(),
            answers: { create: answerCreate },
          },
          include: submissionInclude,
        });

    res.status(existing ? 200 : 201).json(submission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit homework' });
    }
    const scope = await homeworkScopeWhere(req);
    const existing = await prisma.homework.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Homework not found' });

    const { classId, subjectId, title, description, dueDate } = req.body;
    const targetClassId = classId || existing.classId;
    const teacherErr = await assertTeacherClassAccess(req, targetClassId);
    if (teacherErr) return res.status(403).json({ error: teacherErr });

    const item = await prisma.homework.update({
      where: { id: req.params.id },
      data: {
        classId: targetClassId,
        subjectId: subjectId || null,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      },
      include: homeworkInclude,
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete homework' });
    }
    const scope = await homeworkScopeWhere(req);
    const existing = await prisma.homework.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Homework not found' });
    await prisma.homework.delete({ where: { id: req.params.id } });
    deleteHomeworkDir(existing.id);
    res.json({ message: 'Homework deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
