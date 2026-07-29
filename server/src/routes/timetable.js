import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { timetableScopeWhere, resolveClassIdFilter } from '../lib/scope.js';
import { getTeacherClassIds, resolveTeacherId } from '../lib/teacherAccess.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import {
  resolveTimetableTemplate,
  saveTimetableTemplate,
  deleteClassTemplate,
} from '../lib/timetableTemplateService.js';

const router = Router();

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

router.use(authorizePermission(PERMISSIONS.TIMETABLE));

router.get('/template', async (req, res) => {
  try {
    const { classId } = req.query;
    if (classId) await resolveClassIdFilter(req, classId);
    const template = await resolveTimetableTemplate(req.campusId, req.academicYearId, classId || null);
    res.json(template);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.put('/template', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT', 'TEACHER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit the day structure' });
    }
    const { classId, dayStartTime, periods } = req.body;
    const template = await saveTimetableTemplate(req.campusId, req.academicYearId, {
      classId: classId || null,
      dayStartTime,
      periods,
    });
    res.json(template);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/template', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT', 'TEACHER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit the day structure' });
    }
    const { classId } = req.query;
    if (!classId) {
      return res.status(400).json({ error: 'classId is required to reset a class template' });
    }
    await deleteClassTemplate(req.campusId, req.academicYearId, classId);
    const template = await resolveTimetableTemplate(req.campusId, req.academicYearId, classId);
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Teacher personal schedule — only periods where they are assigned to teach. */
router.get('/mine', async (req, res) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json({ error: 'This endpoint is for teachers only' });
    }

    const teacherId = await resolveTeacherId(req);
    if (!teacherId) {
      return res.json({
        dayNames: DAY_NAMES,
        slots: [],
        template: null,
        periods: [],
      });
    }

    const classIds = await getTeacherClassIds(teacherId, req.campusId, req.academicYearId);
    if (!classIds.length) {
      return res.json({
        dayNames: DAY_NAMES,
        slots: [],
        template: null,
        periods: [],
      });
    }

    const [slots, template] = await Promise.all([
      prisma.timetableSlot.findMany({
        where: {
          campusId: req.campusId,
          academicYearId: req.academicYearId,
          classId: { in: classIds },
          subject: { teacherId },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: {
          class: {
            select: {
              name: true,
              grade: true,
              section: true,
              teacher: { select: { id: true, name: true } },
            },
          },
          subject: {
            select: {
              name: true,
              code: true,
              teacher: { select: { id: true, name: true } },
            },
          },
        },
      }),
      resolveTimetableTemplate(req.campusId, req.academicYearId, null),
    ]);

    res.json({
      dayNames: DAY_NAMES,
      slots,
      template,
      periods: template?.gridPeriods || [],
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { classId } = req.query;
    const scope = await timetableScopeWhere(req);
    const allowedClassIds = scope.classId?.in
      ? scope.classId.in
      : (scope.classId ? [scope.classId] : null);

    if (allowedClassIds) {
      if (allowedClassIds.length === 0) {
        return res.json({
          dayNames: DAY_NAMES,
          slots: [],
          template: null,
          periods: [],
        });
      }
      if (classId && !allowedClassIds.includes(classId)) {
        return res.status(403).json({ error: 'You do not have access to this class timetable' });
      }
    }

    const where = {
      campusId: req.campusId,
      academicYearId: req.academicYearId,
      ...(allowedClassIds
        ? (classId ? { classId } : { classId: { in: allowedClassIds } })
        : (classId ? { classId } : {})),
    };

    const [slots, template] = await Promise.all([
      prisma.timetableSlot.findMany({
        where,
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: {
          class: {
            select: {
              name: true,
              grade: true,
              section: true,
              teacher: { select: { id: true, name: true } },
            },
          },
          subject: {
            select: {
              name: true,
              code: true,
              teacher: { select: { id: true, name: true } },
            },
          },
        },
      }),
      classId
        ? resolveTimetableTemplate(req.campusId, req.academicYearId, classId)
        : Promise.resolve(null),
    ]);
    res.json({
      dayNames: DAY_NAMES,
      slots,
      template,
      periods: template?.gridPeriods || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT', 'TEACHER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit the timetable' });
    }
    const { classId, subjectId, dayOfWeek, startTime, endTime, room } = req.body;
    const slot = await prisma.timetableSlot.create({
      data: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        classId,
        subjectId: subjectId || null,
        dayOfWeek,
        startTime,
        endTime,
        room,
      },
      include: {
        class: {
          select: {
            name: true,
            grade: true,
            section: true,
            teacher: { select: { id: true, name: true } },
          },
        },
        subject: {
          select: {
            name: true,
            code: true,
            teacher: { select: { id: true, name: true } },
          },
        },
      },
    });
    res.status(201).json(slot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT', 'TEACHER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit the timetable' });
    }
    const scope = await timetableScopeWhere(req);
    const existing = await prisma.timetableSlot.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Slot not found' });

    const { classId, subjectId, dayOfWeek, startTime, endTime, room } = req.body;
    const slot = await prisma.timetableSlot.update({
      where: { id: req.params.id },
      data: { classId, subjectId: subjectId || null, dayOfWeek, startTime, endTime, room },
      include: {
        class: {
          select: {
            name: true,
            grade: true,
            section: true,
            teacher: { select: { id: true, name: true } },
          },
        },
        subject: {
          select: {
            name: true,
            code: true,
            teacher: { select: { id: true, name: true } },
          },
        },
      },
    });
    res.json(slot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT', 'TEACHER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete timetable slots' });
    }
    const scope = await timetableScopeWhere(req);
    const existing = await prisma.timetableSlot.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Slot not found' });
    await prisma.timetableSlot.delete({ where: { id: req.params.id } });
    res.json({ message: 'Slot deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
