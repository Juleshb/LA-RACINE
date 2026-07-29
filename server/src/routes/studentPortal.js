import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';
import { getSessionStatus } from '../lib/meetingLinks.js';
import { campusYearWhere } from '../lib/scope.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';

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

export default router;
