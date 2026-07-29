import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { assertTeacherCourseAccess, resolveTeacherId } from '../lib/teacherAccess.js';
import { studentScopeWhere, classScopeWhere, resolveClassIdFilter } from '../lib/scope.js';
import { buildClassBulletinReport } from '../lib/bulletinReport.js';
import {
  ensureSubjectAssessments,
  resolveTotalMax,
  resolveTestsMarkMax,
  resolveExamMax,
  assessmentsToSteps,
} from '../lib/subjectAssessments.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.MARKS));

router.get('/stats', async (req, res) => {
  try {
    const scope = await studentScopeWhere(req);
    const students = await prisma.student.findMany({
      where: scope,
      select: { id: true },
    });
    const studentIds = students.map((s) => s.id);
    const markWhere = studentIds.length ? { studentId: { in: studentIds } } : { studentId: '__none__' };

    const [totalMarks, assessmentGroups, termGroups, classScope] = await Promise.all([
      prisma.mark.count({ where: markWhere }),
      prisma.mark.groupBy({
        by: ['assessment', 'catNumber'],
        where: markWhere,
        _count: { _all: true },
      }),
      prisma.mark.groupBy({
        by: ['term'],
        where: markWhere,
        _count: { _all: true },
      }),
      classScopeWhere(req),
    ]);

    const byAssessment = assessmentGroups
      .map((group) => ({
        name: group.assessment === 'CAT' && group.catNumber > 0
          ? `CAT ${group.catNumber}`
          : group.assessment,
        count: group._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    const termOrder = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3', 'Term 1', 'Term 2', 'Term 3'];
    const byTerm = termGroups
      .map((group) => ({ name: group.term, count: group._count._all }))
      .sort((a, b) => {
        const ai = termOrder.indexOf(a.name);
        const bi = termOrder.indexOf(b.name);
        if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

    const classes = await prisma.class.findMany({
      where: classScope,
      select: { id: true, name: true },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }],
    });

    const byClass = (
      await Promise.all(
        classes.map(async (cls) => {
          const count = await prisma.mark.count({
            where: {
              student: { classId: cls.id, ...scope },
            },
          });
          return { name: cls.name, count };
        }),
      )
    )
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weeklyRecording = await Promise.all(
      Array.from({ length: 7 }, (_, index) => {
        const dayStart = new Date(today);
        dayStart.setDate(today.getDate() - (6 - index));
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        return prisma.mark.count({
          where: {
            ...markWhere,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }).then((count) => ({
          date: dayStart.toISOString().split('T')[0],
          label: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
          count,
        }));
      }),
    );

    res.json({
      totalMarks,
      byAssessment,
      byTerm,
      byClass,
      weeklyRecording,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/report', async (req, res) => {
  try {
    const { classId, studentId, term } = req.query;
    if (!classId || !studentId) {
      return res.status(400).json({ error: 'classId and studentId are required' });
    }

    await resolveClassIdFilter(req, classId);

    const scope = await classScopeWhere(req);
    const cls = await prisma.class.findFirst({ where: { id: classId, ...scope } });
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    if (req.user.role === 'TEACHER') {
      const teacherId = await resolveTeacherId(req);
      const teacherCourses = await prisma.subject.findMany({
        where: { classId, campusId: req.campusId, teacherId },
        take: 1,
      });
      if (!teacherCourses.length) {
        return res.status(403).json({ error: 'You are not assigned to this class' });
      }
    }

    const studentScope = await studentScopeWhere(req);
    const allowedStudent = await prisma.student.findFirst({
      where: { id: studentId, classId, ...studentScope },
      select: { id: true },
    });
    if (!allowedStudent) {
      return res.status(403).json({ error: 'You cannot view this student bulletin' });
    }

    const termValue = term || 'Trimestre 1';
    const report = await buildClassBulletinReport(prisma, {
      classId,
      studentId,
      term: termValue,
      campusId: req.campusId,
      academicYearId: req.academicYearId,
    });
    res.json(report);
  } catch (error) {
    if (error.message === 'Class not found' || error.message === 'Student not found in this class') {
      return res.status(404).json({ error: error.message });
    }
    res.status(error.status || 500).json({ error: error.message });
  }
});

function parseCatNumber(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function formatAssessmentLabel(assessment, catNumber) {
  if (assessment === 'CAT' && catNumber > 0) return `CAT ${catNumber}`;
  if (assessment === 'TEST' && catNumber > 0) return `Test ${catNumber}`;
  return assessment;
}

function resolveCatNumber(assessmentValue, catNumber) {
  if (assessmentValue === 'CAT') return Math.max(1, parseCatNumber(catNumber));
  if (assessmentValue === 'TEST') return Math.max(1, parseCatNumber(catNumber));
  return 0;
}

async function loadCourse(req, subjectId, classId) {
  const where = {
    id: subjectId,
    campusId: req.campusId,
    class: { academicYearId: req.academicYearId },
  };
  if (classId) where.classId = classId;
  return prisma.subject.findFirst({ where, include: { class: true } });
}

async function assertMarksReadAccess(req, course) {
  if (req.user.role === 'PARENT' || req.user.role === 'STUDENT') return null;
  return assertTeacherCourseAccess(req, course);
}

router.get('/subject-tests', async (req, res) => {
  try {
    const { subjectId } = req.query;
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }

    const course = await loadCourse(req, subjectId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const accessError = await assertMarksReadAccess(req, course);
    if (accessError) return res.status(403).json({ error: accessError });

    const tests = await ensureSubjectAssessments(prisma, course);

    res.json({
      subjectId,
      testsMarkMax: resolveTestsMarkMax(course),
      examMax: resolveExamMax(course),
      totalMax: resolveTotalMax(course),
      tests,
      steps: assessmentsToSteps(tests, course),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/subject-tests', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit course tests' });
    }

    const { subjectId, testsMarkMax, examMax, courseMarkMax, tests } = req.body;
    if (!subjectId || !Array.isArray(tests)) {
      return res.status(400).json({ error: 'subjectId and tests are required' });
    }

    const course = await loadCourse(req, subjectId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const accessError = await assertTeacherCourseAccess(req, course);
    if (accessError) return res.status(403).json({ error: accessError });

    const normalized = tests
      .map((t, index) => ({
        label: String(t.label || `Test ${index + 1}`).trim(),
        maxScore: Number(t.maxScore),
        sortOrder: Number(t.sortOrder) || index + 1,
        date: t.date ? new Date(t.date) : null,
      }))
      .filter((t) => t.label && !Number.isNaN(t.maxScore) && t.maxScore > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t, index) => ({ ...t, sortOrder: index + 1 }));

    if (!normalized.length) {
      return res.status(400).json({ error: 'At least one test with a valid max score is required' });
    }

    const nextTestsMarkMax = testsMarkMax != null && testsMarkMax !== ''
      ? Number(testsMarkMax)
      : courseMarkMax != null && courseMarkMax !== ''
        ? Number(courseMarkMax)
        : resolveTestsMarkMax(course);

    const nextExamMax = examMax != null && examMax !== ''
      ? Number(examMax)
      : resolveExamMax(course);

    const nextTotalMax = (nextTestsMarkMax > 0 ? nextTestsMarkMax : 0) + (nextExamMax > 0 ? nextExamMax : 0);

    await prisma.$transaction(async (tx) => {
      await tx.subjectAssessment.deleteMany({ where: { subjectId } });
      await tx.subjectAssessment.createMany({
        data: normalized.map((t) => ({
          subjectId,
          label: t.label,
          maxScore: t.maxScore,
          sortOrder: t.sortOrder,
          date: t.date,
        })),
      });
      await tx.subject.update({
        where: { id: subjectId },
        data: {
          testsMarkMax: nextTestsMarkMax > 0 ? nextTestsMarkMax : null,
          examMax: nextExamMax > 0 ? nextExamMax : null,
          totalMax: nextTotalMax > 0 ? nextTotalMax : null,
        },
      });
    });

    const saved = await prisma.subjectAssessment.findMany({
      where: { subjectId },
      orderBy: { sortOrder: 'asc' },
    });

    const updatedCourse = await prisma.subject.findUnique({ where: { id: subjectId } });

    res.json({
      subjectId,
      testsMarkMax: resolveTestsMarkMax(updatedCourse),
      examMax: resolveExamMax(updatedCourse),
      totalMax: resolveTotalMax(updatedCourse),
      tests: saved,
      steps: assessmentsToSteps(saved, updatedCourse),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/assessments', async (req, res) => {
  try {
    const { subjectId, term } = req.query;
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }

    const course = await loadCourse(req, subjectId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const accessError = await assertMarksReadAccess(req, course);
    if (accessError) return res.status(403).json({ error: accessError });

    const termValue = term || 'Term 1';
    const subjectTests = await ensureSubjectAssessments(prisma, course);

    const groups = await prisma.mark.groupBy({
      by: ['assessment', 'catNumber'],
      where: { subjectId, term: termValue },
    });

    const cats = groups
      .filter((g) => g.assessment === 'CAT' && g.catNumber > 0)
      .map((g) => g.catNumber)
      .sort((a, b) => a - b);

    const others = groups
      .filter((g) => g.assessment !== 'CAT' || g.catNumber === 0)
      .map((g) => ({
        assessment: g.assessment,
        catNumber: g.catNumber,
        label: formatAssessmentLabel(g.assessment, g.catNumber),
      }));

    const nextCatNumber = cats.length ? Math.max(...cats) + 1 : 1;

    res.json({
      term: termValue,
      subjectId,
      testsMarkMax: resolveTestsMarkMax(course),
      examMax: resolveExamMax(course),
      totalMax: resolveTotalMax(course),
      tests: subjectTests,
      cats: cats.map((n) => ({ assessment: 'CAT', catNumber: n, label: `CAT ${n}` })),
      nextCatNumber,
      others,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { classId, subjectId, term, assessment, catNumber } = req.query;
    if (!classId || !subjectId) {
      return res.status(400).json({ error: 'classId and subjectId are required' });
    }

    const course = await loadCourse(req, subjectId, classId);
    if (!course) return res.status(404).json({ error: 'Course not found for this class' });

    await resolveClassIdFilter(req, classId);

    const accessError = await assertMarksReadAccess(req, course);
    if (accessError) return res.status(403).json({ error: accessError });

    const termValue = term || 'Term 1';
    const assessmentValue = assessment || 'Final';
    const catNumberValue = resolveCatNumber(assessmentValue, catNumber);

    const scope = await studentScopeWhere(req);
    const students = await prisma.student.findMany({
      where: { ...scope, classId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        marks: {
          where: {
            subjectId,
            term: termValue,
            assessment: assessmentValue,
            catNumber: catNumberValue,
          },
        },
      },
    });

    res.json({
      term: termValue,
      assessment: assessmentValue,
      catNumber: catNumberValue,
      label: formatAssessmentLabel(assessmentValue, catNumberValue),
      subjectId,
      classId,
      students: students.map((s) => ({
        id: s.id,
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        mark: s.marks[0] || null,
      })),
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit marks' });
    }
    const { subjectId, term, assessment, catNumber, records } = req.body;
    if (!subjectId || !Array.isArray(records)) {
      return res.status(400).json({ error: 'subjectId and records are required' });
    }

    const termValue = term || 'Term 1';
    const assessmentValue = assessment || 'Final';
    const catNumberValue = resolveCatNumber(assessmentValue, catNumber);

    const course = await prisma.subject.findFirst({
      where: { id: subjectId, campusId: req.campusId, class: { academicYearId: req.academicYearId } },
      include: { class: true },
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const accessError = await assertTeacherCourseAccess(req, course);
    if (accessError) return res.status(403).json({ error: accessError });

    const studentIds = records.map((r) => r.studentId);
    const validStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        classId: course.classId,
      },
      select: { id: true },
    });
    const validIds = new Set(validStudents.map((s) => s.id));

    let saved = 0;
    for (const record of records) {
      if (!validIds.has(record.studentId)) continue;
      if (record.score === '' || record.score === null || record.score === undefined) continue;

      const score = Number(record.score);
      const maxScore = Number(record.maxScore) || 100;
      if (Number.isNaN(score) || score < 0 || score > maxScore) continue;

      await prisma.mark.upsert({
        where: {
          studentId_subjectId_term_assessment_catNumber: {
            studentId: record.studentId,
            subjectId,
            term: termValue,
            assessment: assessmentValue,
            catNumber: catNumberValue,
          },
        },
        create: {
          studentId: record.studentId,
          subjectId,
          term: termValue,
          assessment: assessmentValue,
          catNumber: catNumberValue,
          score,
          maxScore,
          notes: record.notes || null,
        },
        update: {
          score,
          maxScore,
          notes: record.notes || null,
        },
      });
      saved += 1;
    }

    res.json({
      saved,
      term: termValue,
      assessment: assessmentValue,
      catNumber: catNumberValue,
      label: formatAssessmentLabel(assessmentValue, catNumberValue),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const mark = await prisma.mark.findFirst({
      where: { id: req.params.id, subject: { campusId: req.campusId, class: { academicYearId: req.academicYearId } } },
      include: { subject: true },
    });
    if (!mark) return res.status(404).json({ error: 'Mark not found' });

    const accessError = await assertTeacherCourseAccess(req, mark.subject);
    if (accessError) return res.status(403).json({ error: accessError });

    await prisma.mark.delete({ where: { id: req.params.id } });
    res.json({ message: 'Mark deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
