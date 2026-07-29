import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { studentScopeWhere } from '../lib/scope.js';
import { parseYouTubeId } from '../lib/youtube.js';
import { gradeSubmission } from '../lib/homeworkGrading.js';

const router = Router();

function canManage(role) {
  return !['STUDENT', 'PARENT'].includes(role);
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

async function courseWhere(req) {
  const base = {
    campusId: req.campusId,
    academicYearId: req.academicYearId,
  };
  if (req.user.role === 'STUDENT' || req.user.role === 'PARENT') {
    base.isPublished = true;
    const studentId = req.user.role === 'STUDENT'
      ? req.user.studentId
      : await resolveStudentId(req);
    if (studentId) {
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { classId: true },
      });
      base.OR = [{ classId: null }, { classId: student?.classId || '__none__' }];
    } else if (req.user.role === 'PARENT') {
      base.id = '__none__';
    }
  }
  return base;
}

async function buildELearningGradesSummary(student, req) {
  if (!student?.classId) {
    return {
      student: student ? {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
      } : student,
      completed: 0,
      pending: 0,
      averagePercent: null,
      recentSubmissions: [],
    };
  }

  const courses = await prisma.eLearningCourse.findMany({
    where: {
      campusId: req.campusId,
      academicYearId: req.academicYearId,
      isPublished: true,
      OR: [{ classId: null }, { classId: student.classId }],
      exercises: { some: {} },
    },
    select: { id: true },
  });
  const courseIds = courses.map((c) => c.id);

  const submissions = courseIds.length
    ? await prisma.eLearningExerciseSubmission.findMany({
        where: { studentId: student.id, courseId: { in: courseIds } },
        include: {
          course: { select: { id: true, title: true, subject: true } },
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
    pending: Math.max(0, courseIds.length - submissions.length),
    averagePercent: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null,
    recentSubmissions: submissions.map((s) => ({
      id: s.id,
      courseId: s.courseId,
      title: s.course.title,
      subject: s.course.subject,
      score: s.score,
      maxScore: s.maxScore,
      percent: s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0,
      submittedAt: s.submittedAt,
    })),
  };
}

router.get('/grades/summary', authorizePermission(PERMISSIONS.E_LEARNING), async (req, res) => {
  try {
    if (req.user.role === 'PARENT') {
      const scope = await studentScopeWhere(req);
      const children = await prisma.student.findMany({
        where: scope,
        select: { id: true, firstName: true, lastName: true, classId: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      });
      const summaries = await Promise.all(
        children.map((child) => buildELearningGradesSummary(child, req)),
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

    const summary = await buildELearningGradesSummary(student, req);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function stripExerciseAnswers(exercises, hide) {
  if (!hide) return exercises;
  return exercises.map(({ correctAnswer, ...rest }) => rest);
}

function sanitizeLesson(lesson, role) {
  if (!['STUDENT', 'PARENT'].includes(role)) return lesson;
  const youtubeId = lesson.youtubeId || parseYouTubeId(lesson.videoUrl);
  const { videoUrl, resourceUrl, ...rest } = lesson;
  return youtubeId ? { ...rest, youtubeId } : rest;
}

const courseListInclude = {
  class: { select: { name: true } },
  _count: { select: { lessons: true, exercises: true } },
};

const courseDetailInclude = {
  class: { select: { name: true } },
  lessons: { orderBy: { sortOrder: 'asc' } },
  exercises: { orderBy: { sortOrder: 'asc' } },
};

router.get('/courses', authorizePermission(PERMISSIONS.E_LEARNING), async (req, res) => {
  try {
    const where = await courseWhere(req);
    const studentId = await resolveStudentId(req);
    const courses = await prisma.eLearningCourse.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: courseListInclude,
    });

    if (!studentId) {
      return res.json(courses.map((course) => ({ ...course, mySubmission: null })));
    }

    const submissions = await prisma.eLearningExerciseSubmission.findMany({
      where: { studentId, courseId: { in: courses.map((c) => c.id) } },
      select: { id: true, courseId: true, score: true, maxScore: true, submittedAt: true },
    });
    const byCourse = Object.fromEntries(submissions.map((s) => [s.courseId, s]));

    res.json(courses.map((course) => ({
      ...course,
      mySubmission: byCourse[course.id] || null,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/courses/:id', authorizePermission(PERMISSIONS.E_LEARNING), async (req, res) => {
  try {
    const where = await courseWhere(req);
    const course = await prisma.eLearningCourse.findFirst({
      where: { id: req.params.id, ...where },
      include: courseDetailInclude,
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    let mySubmission = null;
    const studentId = await resolveStudentId(req);
    if (studentId) {
      mySubmission = await prisma.eLearningExerciseSubmission.findUnique({
        where: {
          courseId_studentId: { courseId: course.id, studentId },
        },
      });
    }

    const hideAnswers = ['STUDENT', 'PARENT'].includes(req.user.role) && !mySubmission;
    res.json({
      ...course,
      lessons: course.lessons.map((l) => sanitizeLesson(l, req.user.role)),
      exercises: stripExerciseAnswers(course.exercises, hideAnswers),
      mySubmission,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/courses', authorizePermission(PERMISSIONS.E_LEARNING), async (req, res) => {
  try {
    if (!canManage(req.user.role)) {
      return res.status(403).json({ error: 'You cannot add courses' });
    }
    const {
      title, description, subject, coverEmoji, classId, isPublished, sortOrder,
      lessons = [], exercises = [],
    } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    for (const lesson of lessons) {
      const url = lesson?.videoUrl?.trim();
      if (url && !parseYouTubeId(url)) {
        return res.status(400).json({ error: `Invalid YouTube link in lesson "${lesson.title || 'untitled'}"` });
      }
    }

    const course = await prisma.eLearningCourse.create({
      data: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        classId: classId || null,
        title,
        description,
        subject,
        coverEmoji: coverEmoji || '🎓',
        isPublished: isPublished !== false,
        sortOrder: Number(sortOrder) || 0,
        lessons: {
          create: lessons.filter((l) => l.title?.trim()).map((l, i) => ({
            campusId: req.campusId,
            academicYearId: req.academicYearId,
            classId: classId || null,
            title: l.title,
            description: l.description,
            videoUrl: l.videoUrl?.trim() || null,
            youtubeId: parseYouTubeId(l.videoUrl) || null,
            resourceUrl: l.resourceUrl?.trim() || null,
            coverEmoji: l.coverEmoji || '📺',
            sortOrder: i,
            isPublished: true,
          })),
        },
        exercises: {
          create: exercises.filter((e) => e.prompt?.trim()).map((e, i) => ({
            sortOrder: i,
            type: e.type,
            prompt: e.prompt,
            options: e.options || null,
            correctAnswer: String(e.correctAnswer ?? ''),
            points: Number(e.points) || 1,
          })),
        },
      },
      include: courseDetailInclude,
    });
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/courses/:id', authorizePermission(PERMISSIONS.E_LEARNING), async (req, res) => {
  try {
    if (!canManage(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit courses' });
    }

    const existing = await prisma.eLearningCourse.findFirst({
      where: { id: req.params.id, campusId: req.campusId, academicYearId: req.academicYearId },
    });
    if (!existing) return res.status(404).json({ error: 'Course not found' });

    const {
      title, description, subject, coverEmoji, classId, isPublished, sortOrder,
      lessons = [], exercises = [],
    } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    for (const lesson of lessons) {
      const url = lesson?.videoUrl?.trim();
      if (url && !parseYouTubeId(url)) {
        return res.status(400).json({ error: `Invalid YouTube link in lesson "${lesson.title || 'untitled'}"` });
      }
    }

    const validLessons = lessons.filter((l) => l.title?.trim());
    const validExercises = exercises.filter((e) => e.prompt?.trim());

    await prisma.$transaction([
      prisma.eLearningLesson.deleteMany({ where: { courseId: existing.id } }),
      prisma.eLearningExercise.deleteMany({ where: { courseId: existing.id } }),
    ]);

    const course = await prisma.eLearningCourse.update({
      where: { id: existing.id },
      data: {
        title,
        description,
        subject,
        coverEmoji: coverEmoji || '🎓',
        classId: classId || null,
        isPublished: isPublished !== false,
        sortOrder: Number(sortOrder) || 0,
        lessons: {
          create: validLessons.map((l, i) => ({
            campusId: req.campusId,
            academicYearId: req.academicYearId,
            classId: classId || null,
            title: l.title,
            description: l.description,
            videoUrl: l.videoUrl?.trim() || null,
            youtubeId: parseYouTubeId(l.videoUrl) || null,
            resourceUrl: l.resourceUrl?.trim() || null,
            coverEmoji: l.coverEmoji || '📺',
            sortOrder: i,
            isPublished: true,
          })),
        },
        exercises: {
          create: validExercises.map((e, i) => ({
            sortOrder: i,
            type: e.type,
            prompt: e.prompt,
            options: e.options || null,
            correctAnswer: String(e.correctAnswer ?? ''),
            points: Number(e.points) || 1,
          })),
        },
      },
      include: courseDetailInclude,
    });

    res.json(course);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/courses/:id', authorizePermission(PERMISSIONS.E_LEARNING), async (req, res) => {
  try {
    if (!canManage(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete courses' });
    }
    const existing = await prisma.eLearningCourse.findFirst({
      where: { id: req.params.id, campusId: req.campusId, academicYearId: req.academicYearId },
    });
    if (!existing) return res.status(404).json({ error: 'Course not found' });
    await prisma.eLearningCourse.delete({ where: { id: req.params.id } });
    res.json({ message: 'Course deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/courses/:id/submit', authorizePermission(PERMISSIONS.E_LEARNING), async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT' || !req.user.studentId) {
      return res.status(403).json({ error: 'Only students can submit exercises' });
    }

    const where = await courseWhere(req);
    const course = await prisma.eLearningCourse.findFirst({
      where: { id: req.params.id, ...where },
      include: { exercises: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!course.exercises.length) {
      return res.status(400).json({ error: 'This course has no exercises yet' });
    }

    const existing = await prisma.eLearningExerciseSubmission.findUnique({
      where: {
        courseId_studentId: { courseId: course.id, studentId: req.user.studentId },
      },
    });

    const raw = req.body?.answers;
    const answers = Array.isArray(raw) ? raw : [];
    const answersByQuestionId = Object.fromEntries(
      answers.map((a) => [a.exerciseId || a.questionId, a.answer]),
    );

    const { score, maxScore, graded } = gradeSubmission(course.exercises, answersByQuestionId);

    const submission = existing
      ? await prisma.eLearningExerciseSubmission.update({
          where: { id: existing.id },
          data: {
            score,
            maxScore,
            answers: graded,
            submittedAt: new Date(),
          },
        })
      : await prisma.eLearningExerciseSubmission.create({
          data: {
            courseId: course.id,
            studentId: req.user.studentId,
            score,
            maxScore,
            answers: graded,
          },
        });

    res.status(existing ? 200 : 201).json({
      submission,
      exercises: course.exercises.map((ex) => {
        const g = graded.find((a) => a.questionId === ex.id);
        return {
          ...ex,
          yourAnswer: g?.answer,
          isCorrect: g?.isCorrect,
          pointsEarned: g?.pointsEarned,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Legacy flat lessons list — maps orphan lessons into virtual courses */
router.get('/', authorizePermission(PERMISSIONS.E_LEARNING), async (req, res) => {
  try {
    const courses = await prisma.eLearningCourse.findMany({
      where: await courseWhere(req),
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: courseListInclude,
    });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
