import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { assertTeacherCourseAccess, teacherCourseWhere, denyTeacherWrite } from '../lib/teacherAccess.js';
import { campusYearWhere, resolveClassIdFilter } from '../lib/scope.js';
import { applyCurriculumToClass, applyCurriculumToAllClasses } from '../lib/curriculum.js';
import { listCurricula, getCurriculumDomains } from '../config/curriculum/index.js';

const router = Router();

const courseInclude = {
  class: { select: { id: true, name: true, grade: true, section: true } },
  teacher: { select: { id: true, name: true, email: true } },
  _count: { select: { marks: true } },
};

router.get('/', async (req, res) => {
  try {
    const { classId } = req.query;
    const teacherFilter = await teacherCourseWhere(req);
    const safeClassId = classId ? await resolveClassIdFilter(req, classId) : undefined;
    const courses = await prisma.subject.findMany({
      where: {
        campusId: req.campusId,
        class: { academicYearId: req.academicYearId },
        ...(safeClassId ? { classId: safeClassId } : {}),
        ...teacherFilter,
      },
      orderBy: [{ categoryOrder: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: courseInclude,
    });
    res.json(courses);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/curricula/templates', authorizePermission(PERMISSIONS.COURSES), (_req, res) => {
  res.json(listCurricula());
});

router.get('/curricula/:grade', authorizePermission(PERMISSIONS.COURSES), (req, res) => {
  const domains = getCurriculumDomains(req.params.grade);
  if (!domains.length) return res.status(404).json({ error: 'No curriculum for this grade' });
  res.json({ grade: req.params.grade, domains });
});

router.post('/apply-curriculum', authorizePermission(PERMISSIONS.COURSES), async (req, res) => {
  try {
    if (denyTeacherWrite(req, res)) return;
    const { classId, grade } = req.body;
    if (!classId) {
      return res.status(400).json({ error: 'classId is required' });
    }

    const cls = await prisma.class.findFirst({
      where: { id: classId, ...campusYearWhere(req) },
    });
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const result = await applyCurriculumToClass(prisma, req.campusId, classId, grade || cls.grade);
    res.status(201).json({
      message: result.created
        ? `Added ${result.created} course(s) to ${result.className}`
        : `Bulletin courses already loaded for ${result.className}`,
      ...result,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/apply-curriculum-all', authorizePermission(PERMISSIONS.COURSES), async (req, res) => {
  try {
    if (denyTeacherWrite(req, res)) return;
    const result = await applyCurriculumToAllClasses(prisma, req.campusId, req.academicYearId);
    res.status(201).json({
      message: `Loaded bulletin courses for ${result.classes} class(es) — ${result.totalCreated} new course(s) added`,
      ...result,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const teacherFilter = await teacherCourseWhere(req);
    const course = await prisma.subject.findFirst({
      where: {
        id: req.params.id,
        campusId: req.campusId,
        class: { academicYearId: req.academicYearId },
        ...teacherFilter,
      },
      include: courseInclude,
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authorizePermission(PERMISSIONS.COURSES), async (req, res) => {
  try {
    if (denyTeacherWrite(req, res)) return;
    const { name, code, classId, teacherId, periodsPerWeek, category, categoryOrder, sortOrder, test1Max, test2Max } = req.body;
    if (!name || !code || !classId) {
      return res.status(400).json({ error: 'Name, code, and class are required' });
    }

    const cls = await prisma.class.findFirst({
      where: { id: classId, ...campusYearWhere(req) },
    });
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    if (teacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: teacherId, ...campusYearWhere(req) },
      });
      if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    }

    const examMax = test1Max != null && test2Max != null ? Number(test1Max) + Number(test2Max) : null;
    const totalMax = examMax != null && test1Max != null && test2Max != null
      ? Number(test1Max) + Number(test2Max) + examMax
      : null;

    let resolvedSortOrder = Number(sortOrder) || 0;
    if (!resolvedSortOrder && category) {
      const lastInDomain = await prisma.subject.findFirst({
        where: { classId, category },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      resolvedSortOrder = (lastInDomain?.sortOrder || 0) + 1;
    }

    let resolvedCategoryOrder = Number(categoryOrder) || 0;
    if (!resolvedCategoryOrder && category) {
      const domainMeta = await prisma.subject.findFirst({
        where: { classId, category },
        select: { categoryOrder: true },
      });
      if (domainMeta?.categoryOrder) {
        resolvedCategoryOrder = domainMeta.categoryOrder;
      } else {
        const lastDomain = await prisma.subject.findFirst({
          where: { classId },
          orderBy: { categoryOrder: 'desc' },
          select: { categoryOrder: true },
        });
        resolvedCategoryOrder = (lastDomain?.categoryOrder || 0) + 1;
      }
    }

    const course = await prisma.subject.create({
      data: {
        campusId: req.campusId,
        name,
        code: code.toUpperCase(),
        classId,
        teacherId: teacherId || null,
        periodsPerWeek: Math.max(1, Number(periodsPerWeek) || 1),
        category: category || null,
        categoryOrder: resolvedCategoryOrder,
        sortOrder: resolvedSortOrder,
        test1Max: test1Max != null ? Number(test1Max) : null,
        test2Max: test2Max != null ? Number(test2Max) : null,
        examMax,
        totalMax,
      },
      include: courseInclude,
    });
    res.status(201).json(course);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A course with this code already exists in this class' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authorizePermission(PERMISSIONS.COURSES), async (req, res) => {
  try {
    if (denyTeacherWrite(req, res)) return;
    const teacherFilter = await teacherCourseWhere(req);
    const existing = await prisma.subject.findFirst({
      where: { id: req.params.id, campusId: req.campusId, class: { academicYearId: req.academicYearId }, ...teacherFilter },
    });
    if (!existing) return res.status(404).json({ error: 'Course not found' });

    const { name, code, teacherId, periodsPerWeek, category, categoryOrder, sortOrder, test1Max, test2Max } = req.body;

    if (teacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: teacherId, ...campusYearWhere(req) },
      });
      if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    }

    const t1 = test1Max !== undefined && test1Max !== null && test1Max !== '' ? Number(test1Max) : null;
    const t2 = test2Max !== undefined && test2Max !== null && test2Max !== '' ? Number(test2Max) : null;
    const examMax = t1 != null && t2 != null ? t1 + t2 : undefined;
    const totalMax = examMax != null ? t1 + t2 + examMax : undefined;

    const course = await prisma.subject.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code.toUpperCase() }),
        ...(teacherId !== undefined && { teacherId: teacherId || null }),
        ...(periodsPerWeek !== undefined && { periodsPerWeek: Math.max(1, Number(periodsPerWeek) || 1) }),
        ...(category !== undefined && { category: category || null }),
        ...(categoryOrder !== undefined && { categoryOrder: Number(categoryOrder) || 0 }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
        ...(t1 !== undefined && { test1Max: t1 }),
        ...(t2 !== undefined && { test2Max: t2 }),
        ...(examMax !== undefined && { examMax }),
        ...(totalMax !== undefined && { totalMax }),
      },
      include: courseInclude,
    });
    res.json(course);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A course with this code already exists in this class' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authorizePermission(PERMISSIONS.COURSES), async (req, res) => {
  try {
    if (denyTeacherWrite(req, res)) return;
    const teacherFilter = await teacherCourseWhere(req);
    const existing = await prisma.subject.findFirst({
      where: { id: req.params.id, campusId: req.campusId, class: { academicYearId: req.academicYearId }, ...teacherFilter },
    });
    if (!existing) return res.status(404).json({ error: 'Course not found' });
    await prisma.subject.delete({ where: { id: req.params.id } });
    res.json({ message: 'Course deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
