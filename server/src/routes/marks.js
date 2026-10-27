import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import {
  assertTeacherCourseAccess,
  assertTeacherMarksClassAccess,
  assertTeacherCompetenceAccess,
  resolveTeacherId,
  marksCourseWhere,
  getTeacherMarksClassIdsForReq,
} from '../lib/teacherAccess.js';
import { studentScopeWhere, classScopeWhere, resolveClassIdFilter } from '../lib/scope.js';
import { buildClassBulletinReport, buildClassProclamation } from '../lib/bulletinReport.js';
import { buildNurseryBulletinReport } from '../lib/nurseryBulletinReport.js';
import { usesCompetenceBulletin, usesNurseryCompetence } from '../config/grades.js';
import {
  ensureSubjectAssessments,
  resolveTotalMax,
  resolveTestsMarkMax,
  resolveExamMax,
  assessmentsToSteps,
  formatPeriodTestLabel,
} from '../lib/subjectAssessments.js';
import {
  letterToScore,
  scoreToLetter,
  normalizeNurseryLetter,
  NURSERY_ASSESSMENT,
  NURSERY_MAX_SCORE,
  NURSERY_TERMS,
  NURSERY_LETTER_GRADES,
  NURSERY_GRADE_LABELS,
} from '../lib/nurseryGrade.js';
import { groupCompetenceSubjects, ensureNurseryCurriculum } from '../lib/curriculum.js';

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

router.get('/proclamation', async (req, res) => {
  try {
    const { classId, term } = req.query;
    if (!classId) return res.status(400).json({ error: 'classId is required' });

    await resolveClassIdFilter(req, classId);
    const scope = await classScopeWhere(req);
    const cls = await prisma.class.findFirst({ where: { ...scope, id: classId } });
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (usesCompetenceBulletin(cls.grade)) {
      return res.status(400).json({ error: 'Fiche de proclamation is for classes with mark bulletins' });
    }

    const studentWhere = await studentScopeWhere(req);
    const report = await buildClassProclamation(prisma, {
      classId,
      term: term || 'Trimestre 1',
      campusId: req.campusId,
      academicYearId: req.academicYearId,
      studentWhere,
    });
    res.json(report);
  } catch (error) {
    if (error.message === 'Class not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/report', async (req, res) => {
  try {
    if (req.user.role === 'TEACHER') {
      return res.status(403).json({ error: 'Teachers cannot access bulletin reports' });
    }
    const { classId, studentId, term, periodScope } = req.query;
    if (!classId || !studentId) {
      return res.status(400).json({ error: 'classId and studentId are required' });
    }

    await resolveClassIdFilter(req, classId);

    const scope = await classScopeWhere(req);
    const cls = await prisma.class.findFirst({ where: { ...scope, id: classId } });
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

    if (usesCompetenceBulletin(cls.grade)) {
      const report = await buildNurseryBulletinReport(prisma, {
        classId,
        studentId,
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        term: term || 'Trimestre 1',
      });
      return res.json(report);
    }

    const termValue = term || 'Trimestre 1';
    const report = await buildClassBulletinReport(prisma, {
      classId,
      studentId,
      term: termValue,
      campusId: req.campusId,
      academicYearId: req.academicYearId,
      periodScope: periodScope === 'period1' ? 'period1' : 'full',
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
  if (assessment === 'CAT' && catNumber > 0) return `Quiz ${catNumber}`;
  if (assessment === 'TEST' && catNumber > 0) return formatPeriodTestLabel(catNumber);
  if (assessment === 'TEST1') return catNumber > 1 ? `Period 1 · Test ${catNumber}` : 'Period 1';
  if (assessment === 'TEST2') return catNumber > 1 ? `Period 2 · Test ${catNumber}` : 'Period 2';
  if (assessment === 'EX') return 'Exam';
  return assessment;
}

function resolveCatNumber(assessmentValue, catNumber) {
  if (assessmentValue === 'CAT') return Math.max(1, parseCatNumber(catNumber));
  if (assessmentValue === 'TEST') return Math.max(1, parseCatNumber(catNumber));
  if (assessmentValue === 'TEST1' || assessmentValue === 'TEST2') return parseCatNumber(catNumber);
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

/** Classes + assigned subjects the current user can record marks for. */
router.get('/classes', async (req, res) => {
  try {
    const [classScope, courseWhere] = await Promise.all([
      classScopeWhere(req),
      marksCourseWhere(req),
    ]);
    let allowedClassIds = null;
    if (req.user.role === 'TEACHER') {
      allowedClassIds = await getTeacherMarksClassIdsForReq(req);
      if (!allowedClassIds.length) return res.json([]);
    }

    const classes = await prisma.class.findMany({
      where: {
        ...classScope,
        ...(allowedClassIds ? { id: { in: allowedClassIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        grade: true,
        section: true,
        teacherId: true,
        subjects: {
          where: courseWhere,
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
          },
          orderBy: [{ categoryOrder: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }, { name: 'asc' }],
    });

    // Never list a class on Marks when it has no assigned subjects
    const visible = classes.filter((cls) => cls.subjects.length > 0);

    res.json(visible.map((cls) => {
      const isNursery = usesCompetenceBulletin(cls.grade);
      return {
        id: cls.id,
        name: cls.name,
        grade: cls.grade,
        section: cls.section,
        subjects: cls.subjects,
        subjectCount: cls.subjects.length,
        competence: isNursery,
        // Competence create only when teacher has assigned subjects in that nursery class
        competenceAccess: isNursery && cls.subjects.length > 0,
      };
    }));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/recorded', async (req, res) => {
  try {
    const { classId, term, subjectId } = req.query;

    if (classId) {
      await resolveClassIdFilter(req, classId);
      const classAccessError = await assertTeacherMarksClassAccess(req, classId);
      if (classAccessError) return res.status(403).json({ error: classAccessError });
    }

    const [scope, classScope, courseWhere] = await Promise.all([
      studentScopeWhere(req),
      classScopeWhere(req),
      marksCourseWhere(req),
    ]);

    let allowedClassIds = null;
    if (req.user.role === 'TEACHER') {
      allowedClassIds = await getTeacherMarksClassIdsForReq(req);
      if (!allowedClassIds.length) {
        return res.json({
          studentCount: 0,
          summary: {
            sessions: 0,
            enteredMarks: 0,
            incompleteSessions: 0,
            avgCompletionPct: 0,
            avgScorePct: null,
          },
          sessions: [],
        });
      }
    }

    const classWhere = {
      ...classScope,
      ...(classId ? { id: classId } : {}),
      ...(allowedClassIds ? { id: { in: allowedClassIds } } : {}),
    };
    // When both classId and teacher filter apply, prefer explicit classId if allowed
    if (classId && allowedClassIds) {
      if (!allowedClassIds.includes(classId)) {
        return res.status(403).json({ error: 'You do not have access to this class' });
      }
      classWhere.id = classId;
    }

    const classes = await prisma.class.findMany({
      where: classWhere,
      select: { id: true, name: true },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }],
    });
    const classIds = classes.map((c) => c.id);
    const classMap = new Map(classes.map((c) => [c.id, c]));

    if (!classIds.length) {
      return res.json({
        studentCount: 0,
        summary: {
          sessions: 0,
          enteredMarks: 0,
          incompleteSessions: 0,
          avgCompletionPct: 0,
          avgScorePct: null,
        },
        sessions: [],
      });
    }

    const [students, subjects] = await Promise.all([
      prisma.student.findMany({
        where: { ...scope, classId: { in: classIds } },
        select: { id: true, classId: true },
      }),
      prisma.subject.findMany({
        where: {
          classId: { in: classIds },
          campusId: req.campusId,
          class: { academicYearId: req.academicYearId },
          ...courseWhere,
          ...(subjectId ? { id: subjectId } : {}),
        },
        select: {
          id: true,
          name: true,
          code: true,
          category: true,
          classId: true,
        },
        orderBy: [{ categoryOrder: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const studentCountByClass = new Map();
    for (const student of students) {
      studentCountByClass.set(
        student.classId,
        (studentCountByClass.get(student.classId) || 0) + 1,
      );
    }

    const subjectIds = subjects.map((s) => s.id);
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const studentCount = students.length;

    if (!subjectIds.length) {
      return res.json({
        studentCount,
        summary: {
          sessions: 0,
          enteredMarks: 0,
          incompleteSessions: 0,
          avgCompletionPct: 0,
          avgScorePct: null,
        },
        sessions: [],
      });
    }

    const marks = await prisma.mark.findMany({
      where: {
        subjectId: { in: subjectIds },
        studentId: { in: students.map((s) => s.id) },
        ...(term ? { term } : {}),
        NOT: { assessment: NURSERY_ASSESSMENT },
      },
      select: {
        subjectId: true,
        term: true,
        assessment: true,
        catNumber: true,
        score: true,
        maxScore: true,
        assessedOn: true,
        updatedAt: true,
        studentId: true,
      },
    });

    const groups = new Map();
    for (const mark of marks) {
      const key = `${mark.subjectId}|${mark.term}|${mark.assessment}|${mark.catNumber}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          subjectId: mark.subjectId,
          term: mark.term,
          assessment: mark.assessment,
          catNumber: mark.catNumber,
          scores: [],
          maxScores: [],
          assessedOn: null,
          updatedAt: null,
        };
        groups.set(key, group);
      }
      group.scores.push(Number(mark.score));
      if (mark.maxScore != null && Number(mark.maxScore) > 0) {
        group.maxScores.push(Number(mark.maxScore));
      }
      if (mark.assessedOn && (!group.assessedOn || mark.assessedOn > group.assessedOn)) {
        group.assessedOn = mark.assessedOn;
      }
      if (!group.updatedAt || mark.updatedAt > group.updatedAt) {
        group.updatedAt = mark.updatedAt;
      }
    }

    const sessions = [...groups.values()].map((group) => {
        const subject = subjectMap.get(group.subjectId);
        const classInfo = classMap.get(subject?.classId);
        const classStudentCount = studentCountByClass.get(subject?.classId) || 0;
        const entered = group.scores.length;
        const missing = Math.max(0, classStudentCount - entered);
        const maxScore = group.maxScores.length
          ? group.maxScores[group.maxScores.length - 1]
          : null;
        const pctValues = group.scores.map((score, i) => {
          const max = group.maxScores[i] || maxScore || 100;
          return max > 0 ? (score / max) * 100 : null;
        }).filter((v) => v != null);
        const avgScore = entered
          ? group.scores.reduce((sum, n) => sum + n, 0) / entered
          : null;
        const avgPct = pctValues.length
          ? pctValues.reduce((sum, n) => sum + n, 0) / pctValues.length
          : null;
        const completionPct = classStudentCount
          ? Math.round((entered / classStudentCount) * 100)
          : 0;
        const complete = missing === 0 && classStudentCount > 0;

        return {
          id: `${group.subjectId}|${group.term}|${group.assessment}|${group.catNumber}`,
          kind: 'score',
          classId: subject?.classId || null,
          className: classInfo?.name || '—',
          subjectId: group.subjectId,
          subjectName: subject?.name || '—',
          subjectCode: subject?.code || '',
          category: subject?.category || '',
          term: group.term,
          assessment: group.assessment,
          catNumber: group.catNumber,
          label: formatAssessmentLabel(group.assessment, group.catNumber),
          maxScore,
          assessedOn: group.assessedOn ? group.assessedOn.toISOString().slice(0, 10) : null,
          updatedAt: group.updatedAt ? group.updatedAt.toISOString() : null,
          studentCount: classStudentCount,
          entered,
          missing,
          completionPct,
          complete,
          avgScore: avgScore == null ? null : Math.round(avgScore * 10) / 10,
          avgPct: avgPct == null ? null : Math.round(avgPct),
        };
      });

    // Nursery competence sessions — only subjects assigned to this teacher (courseWhere)
    const competenceClasses = await prisma.class.findMany({
      where: { id: { in: classIds } },
      select: { id: true, name: true, grade: true },
    });
    const nurseryClassRows = competenceClasses.filter((c) => usesCompetenceBulletin(c.grade));
    if (nurseryClassRows.length) {
      const nurseryClassIds = nurseryClassRows.map((c) => c.id);
      const nurserySubjects = await prisma.subject.findMany({
        where: {
          classId: { in: nurseryClassIds },
          campusId: req.campusId,
          class: { academicYearId: req.academicYearId },
          ...courseWhere,
        },
        select: { id: true, classId: true, name: true, code: true },
      });
      const nurserySubjectIds = nurserySubjects.map((s) => s.id);
      const nurserySubjectMap = new Map(nurserySubjects.map((s) => [s.id, s]));

      if (nurserySubjectIds.length) {
        const competenceMarks = await prisma.mark.findMany({
          where: {
            subjectId: { in: nurserySubjectIds },
            assessment: NURSERY_ASSESSMENT,
            studentId: { in: students.map((s) => s.id) },
            ...(term ? { term } : {}),
          },
          select: {
            subjectId: true,
            term: true,
            studentId: true,
            updatedAt: true,
          },
        });

        // One recorded session per assigned competence subject + term (not whole class)
        const bySubjectTerm = new Map();
        for (const mark of competenceMarks) {
          const subject = nurserySubjectMap.get(mark.subjectId);
          if (!subject) continue;
          const key = `${mark.subjectId}|${mark.term}`;
          let group = bySubjectTerm.get(key);
          if (!group) {
            group = {
              subjectId: mark.subjectId,
              classId: subject.classId,
              term: mark.term,
              entered: 0,
              updatedAt: null,
            };
            bySubjectTerm.set(key, group);
          }
          group.entered += 1;
          if (!group.updatedAt || mark.updatedAt > group.updatedAt) {
            group.updatedAt = mark.updatedAt;
          }
        }

        for (const group of bySubjectTerm.values()) {
          const subject = nurserySubjectMap.get(group.subjectId);
          const cls = nurseryClassRows.find((c) => c.id === group.classId);
          const classStudentCount = studentCountByClass.get(group.classId) || 0;
          const missing = Math.max(0, classStudentCount - group.entered);
          const completionPct = classStudentCount
            ? Math.round((group.entered / classStudentCount) * 100)
            : 0;
          sessions.push({
            id: `competence|${group.subjectId}|${group.term}`,
            kind: 'competence',
            classId: group.classId,
            className: cls?.name || '—',
            subjectId: group.subjectId,
            subjectName: subject?.name || 'Competence',
            subjectCode: subject?.code || 'COMP',
            category: 'Nursery',
            term: group.term,
            assessment: NURSERY_ASSESSMENT,
            catNumber: 0,
            label: 'Competence A–D',
            maxScore: null,
            assessedOn: null,
            updatedAt: group.updatedAt ? group.updatedAt.toISOString() : null,
            studentCount: classStudentCount,
            skillCount: 1,
            entered: group.entered,
            missing,
            completionPct,
            complete: missing === 0 && classStudentCount > 0,
            avgScore: null,
            avgPct: null,
          });
        }
      }
    }

    sessions.sort((a, b) => {
      const byUpdated = String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      if (byUpdated) return byUpdated;
      return `${a.className}${a.subjectName}${a.label}`.localeCompare(`${b.className}${b.subjectName}${b.label}`);
    });

    const enteredMarks = sessions.reduce((sum, s) => sum + s.entered, 0);
    const incompleteSessions = sessions.filter((s) => !s.complete).length;
    const avgCompletionPct = sessions.length
      ? Math.round(sessions.reduce((sum, s) => sum + s.completionPct, 0) / sessions.length)
      : 0;
    const pctSessions = sessions.filter((s) => s.avgPct != null);
    const avgScorePct = pctSessions.length
      ? Math.round(pctSessions.reduce((sum, s) => sum + s.avgPct, 0) / pctSessions.length)
      : null;

    res.json({
      classId: classId || null,
      term: term || null,
      studentCount,
      summary: {
        sessions: sessions.length,
        enteredMarks,
        incompleteSessions,
        avgCompletionPct,
        avgScorePct,
      },
      sessions,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
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

router.get('/competence', async (req, res) => {
  try {
    const { classId, term } = req.query;
    if (!classId) {
      return res.status(400).json({ error: 'classId is required' });
    }

    await resolveClassIdFilter(req, classId);
    const competenceAccessError = await assertTeacherCompetenceAccess(req, classId);
    if (competenceAccessError) {
      return res.status(403).json({ error: competenceAccessError });
    }

    const scope = await classScopeWhere(req);
    const cls = await prisma.class.findFirst({
      where: { ...scope, id: classId },
      select: { id: true, name: true, grade: true },
    });
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!usesCompetenceBulletin(cls.grade)) {
      return res.status(400).json({ error: 'This class does not use competence grading' });
    }

    if (usesNurseryCompetence(cls.grade)) {
      await ensureNurseryCurriculum(prisma, req.campusId, classId, cls.grade);
    }

    const courseWhere = await marksCourseWhere(req);
    // Only competence items that have a teacher (teachers: only their own)
    const competenceSubjects = await prisma.subject.findMany({
      where: {
        classId,
        campusId: req.campusId,
        class: { academicYearId: req.academicYearId },
        ...courseWhere,
        ...(req.query.subjectId ? { id: String(req.query.subjectId) } : {}),
      },
      orderBy: [{ categoryOrder: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    if (req.user.role === 'TEACHER' && !competenceSubjects.length) {
      return res.status(403).json({
        error: 'You are not assigned to any subjects in this nursery class',
      });
    }
    if (!competenceSubjects.length) {
      return res.status(400).json({
        error: 'No assigned competence subjects in this class. Assign teachers on the Courses page first.',
      });
    }

    const termValue = NURSERY_TERMS.includes(term) ? term : 'Trimestre 1';
    const studentScope = await studentScopeWhere(req);
    const students = await prisma.student.findMany({
      where: { ...studentScope, classId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, studentId: true, firstName: true, lastName: true, postName: true },
    });

    const subjectIds = competenceSubjects.map((s) => s.id);
    const marks = subjectIds.length
      ? await prisma.mark.findMany({
        where: {
          subjectId: { in: subjectIds },
          term: termValue,
          assessment: NURSERY_ASSESSMENT,
          studentId: { in: students.map((s) => s.id) },
        },
      })
      : [];

    const letterByKey = new Map();
    for (const m of marks) {
      letterByKey.set(`${m.subjectId}:${m.studentId}`, scoreToLetter(m.score));
    }

    const domains = groupCompetenceSubjects(competenceSubjects)
      .map((domain) => ({
        category: domain.category,
        categoryOrder: domain.categoryOrder,
        subdomains: domain.subdomains.map((sub) => ({
          name: sub.name,
          items: sub.items.map((subject) => ({
            id: subject.id,
            code: subject.code,
            name: subject.name,
            subcategory: subject.subcategory || sub.name || '',
            grades: Object.fromEntries(
              students.map((st) => [st.id, letterByKey.get(`${subject.id}:${st.id}`) || null]),
            ),
          })),
        })),
      }))
      .filter((domain) => domain.subdomains.some((sub) => sub.items.length > 0));

    res.json({
      mode: 'COMPETENCE',
      classId,
      grade: cls.grade,
      className: cls.name,
      term: termValue,
      terms: NURSERY_TERMS,
      letters: NURSERY_LETTER_GRADES,
      gradeLabels: NURSERY_GRADE_LABELS,
      students,
      domains,
      skillCount: competenceSubjects.length,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.put('/competence/bulk', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit marks' });
    }
    const { classId, term, records } = req.body;
    if (!classId || !Array.isArray(records)) {
      return res.status(400).json({ error: 'classId and records are required' });
    }
    if (!NURSERY_TERMS.includes(term)) {
      return res.status(400).json({ error: 'Invalid nursery term' });
    }

    await resolveClassIdFilter(req, classId);
    const competenceAccessError = await assertTeacherCompetenceAccess(req, classId);
    if (competenceAccessError) return res.status(403).json({ error: competenceAccessError });

    const scope = await classScopeWhere(req);
    const cls = await prisma.class.findFirst({
      where: { ...scope, id: classId },
      select: { id: true, grade: true },
    });
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!usesCompetenceBulletin(cls.grade)) {
      return res.status(400).json({ error: 'This class does not use competence grading' });
    }

    const courseWhere = await marksCourseWhere(req);
    const competenceSubjects = await prisma.subject.findMany({
      where: {
        classId,
        campusId: req.campusId,
        class: { academicYearId: req.academicYearId },
        ...courseWhere,
      },
      select: { id: true },
    });
    if (req.user.role === 'TEACHER' && !competenceSubjects.length) {
      return res.status(403).json({
        error: 'You are not assigned to any subjects in this nursery class',
      });
    }
    if (!competenceSubjects.length) {
      return res.status(400).json({
        error: 'No assigned competence subjects in this class. Assign teachers on the Courses page first.',
      });
    }
    const subjectIds = new Set(competenceSubjects.map((s) => s.id));
    const studentIds = [...new Set(records.map((r) => r.studentId).filter(Boolean))];
    const validStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        classId,
      },
      select: { id: true },
    });
    const validStudentIds = new Set(validStudents.map((s) => s.id));

    let saved = 0;
    let cleared = 0;

    for (const row of records) {
      if (!subjectIds.has(row.subjectId) || !validStudentIds.has(row.studentId)) continue;
      const letter = normalizeNurseryLetter(row.letter);
      const where = {
        studentId_subjectId_term_assessment_catNumber: {
          studentId: row.studentId,
          subjectId: row.subjectId,
          term,
          assessment: NURSERY_ASSESSMENT,
          catNumber: 0,
        },
      };

      if (!letter) {
        await prisma.mark.deleteMany({
          where: {
            studentId: row.studentId,
            subjectId: row.subjectId,
            term,
            assessment: NURSERY_ASSESSMENT,
            catNumber: 0,
          },
        });
        cleared += 1;
        continue;
      }

      await prisma.mark.upsert({
        where,
        create: {
          studentId: row.studentId,
          subjectId: row.subjectId,
          term,
          assessment: NURSERY_ASSESSMENT,
          catNumber: 0,
          score: letterToScore(letter),
          maxScore: NURSERY_MAX_SCORE,
        },
        update: {
          score: letterToScore(letter),
          maxScore: NURSERY_MAX_SCORE,
        },
      });
      saved += 1;
    }

    res.json({ message: 'Competence grades saved', saved, cleared, term });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
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
        postName: s.postName,
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
    const { subjectId, term, assessment, catNumber, records, assessedOn } = req.body;
    if (!subjectId || !Array.isArray(records)) {
      return res.status(400).json({ error: 'subjectId and records are required' });
    }

    const termValue = term || 'Term 1';
    const assessmentValue = assessment || 'Final';
    const catNumberValue = resolveCatNumber(assessmentValue, catNumber);
    let assessedOnDate = null;
    if (assessedOn) {
      const parsed = new Date(assessedOn);
      if (!Number.isNaN(parsed.getTime())) assessedOnDate = parsed;
    }
    if (!assessedOnDate) assessedOnDate = new Date();

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

      const rowAssessedOn = record.assessedOn
        ? (() => {
          const d = new Date(record.assessedOn);
          return Number.isNaN(d.getTime()) ? assessedOnDate : d;
        })()
        : assessedOnDate;

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
          assessedOn: rowAssessedOn,
        },
        update: {
          score,
          maxScore,
          notes: record.notes || null,
          assessedOn: rowAssessedOn,
        },
      });
      saved += 1;
    }

    res.json({
      saved,
      term: termValue,
      assessment: assessmentValue,
      catNumber: catNumberValue,
      assessedOn: assessedOnDate,
      label: formatAssessmentLabel(assessmentValue, catNumberValue),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function sessionIdentity(body = {}) {
  const termValue = body.term || 'Term 1';
  const assessmentValue = body.assessment || 'Final';
  return {
    term: termValue,
    assessment: assessmentValue,
    catNumber: resolveCatNumber(assessmentValue, body.catNumber),
  };
}

async function loadEditableCourse(req, subjectId) {
  const course = await loadCourse(req, subjectId);
  if (!course) {
    const error = new Error('Course not found');
    error.status = 404;
    throw error;
  }
  const accessError = await assertTeacherCourseAccess(req, course);
  if (accessError) {
    const error = new Error(accessError);
    error.status = 403;
    throw error;
  }
  return course;
}

router.put('/sessions', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit assessments' });
    }
    const { subjectId, next } = req.body || {};
    if (!subjectId || !next?.subjectId) {
      return res.status(400).json({ error: 'subjectId and the updated assessment are required' });
    }

    const source = sessionIdentity(req.body);
    const target = sessionIdentity(next);
    const maxScore = Number(next.maxScore);
    if (!maxScore || maxScore <= 0) {
      return res.status(400).json({ error: 'Enter a maximum score greater than 0' });
    }
    let assessedOn = null;
    if (next.assessedOn) {
      const parsed = new Date(next.assessedOn);
      if (!Number.isNaN(parsed.getTime())) assessedOn = parsed;
    }

    const fromCourse = await loadEditableCourse(req, subjectId);
    const toCourse = next.subjectId === subjectId
      ? fromCourse
      : await loadEditableCourse(req, next.subjectId);
    if (fromCourse.classId !== toCourse.classId) {
      return res.status(400).json({ error: 'Keep the assessment in the same class' });
    }

    const marks = await prisma.mark.findMany({
      where: {
        subjectId,
        term: source.term,
        assessment: source.assessment,
        catNumber: source.catNumber,
      },
    });
    if (!marks.length) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    if (marks.some((mark) => Number(mark.score) > maxScore)) {
      return res.status(400).json({ error: 'Maximum score is lower than a mark already recorded' });
    }

    const sameSlot = subjectId === next.subjectId
      && source.term === target.term
      && source.assessment === target.assessment
      && source.catNumber === target.catNumber;

    if (!sameSlot) {
      const clash = await prisma.mark.count({
        where: {
          subjectId: next.subjectId,
          term: target.term,
          assessment: target.assessment,
          catNumber: target.catNumber,
          studentId: { in: marks.map((mark) => mark.studentId) },
          id: { notIn: marks.map((mark) => mark.id) },
        },
      });
      if (clash) {
        return res.status(409).json({ error: 'That assessment already has marks. Choose another test number or edit that assessment.' });
      }
    }

    await prisma.$transaction(marks.map((mark) => prisma.mark.update({
      where: { id: mark.id },
      data: {
        subjectId: next.subjectId,
        term: target.term,
        assessment: target.assessment,
        catNumber: target.catNumber,
        maxScore,
        assessedOn: assessedOn || mark.assessedOn,
      },
    })));

    res.json({
      updated: marks.length,
      label: formatAssessmentLabel(target.assessment, target.catNumber),
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete('/sessions', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete assessments' });
    }
    const subjectId = req.query.subjectId;
    if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });
    const source = sessionIdentity(req.query);
    await loadEditableCourse(req, subjectId);

    const result = await prisma.mark.deleteMany({
      where: {
        subjectId: String(subjectId),
        term: source.term,
        assessment: source.assessment,
        catNumber: source.catNumber,
      },
    });
    if (!result.count) return res.status(404).json({ error: 'Assessment not found' });
    res.json({ deleted: result.count });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
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
