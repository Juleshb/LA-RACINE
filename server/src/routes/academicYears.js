import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizeRoles } from '../config/permissions.js';
import { copyAcademicYearRecords, getCopyPreview } from '../lib/copyAcademicYear.js';
import { ensureDefaultClasses } from '../lib/defaultClasses.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const years = await prisma.academicYear.findMany({
      where: { campusId: req.campusId },
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { students: true, teachers: true, classes: true } },
      },
    });
    res.json(years);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/active', async (req, res) => {
  try {
    const year = await prisma.academicYear.findFirst({
      where: { campusId: req.campusId, isActive: true },
    });
    res.json(year);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/copy-preview', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN'), async (req, res) => {
  try {
    const year = await prisma.academicYear.findFirst({
      where: { id: req.params.id, campusId: req.campusId },
    });
    if (!year) return res.status(404).json({ error: 'Academic year not found' });

    const preview = await getCopyPreview(prisma, req.campusId, year.id);
    res.json({ year: { id: year.id, name: year.name }, ...preview });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN'), async (req, res) => {
  try {
    const { name, startDate } = req.body;
    if (!name || !startDate) {
      return res.status(400).json({ error: 'Name and start date are required' });
    }

    const existing = await prisma.academicYear.findFirst({
      where: { campusId: req.campusId, isActive: true },
    });
    if (existing) {
      return res.status(400).json({
        error: 'An active academic year already exists. Close it before creating a new one.',
      });
    }

    const year = await prisma.academicYear.create({
      data: {
        campusId: req.campusId,
        name,
        startDate: new Date(startDate),
        isActive: true,
        status: 'ACTIVE',
      },
    });
    const classesCreated = await ensureDefaultClasses(prisma, req.campusId, year.id);
    res.status(201).json({ ...year, defaultClassesCreated: classesCreated });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'This academic year name already exists for this campus' });
    }
    res.status(500).json({ error: error.message });
  }
});

async function relinkTeacherUsers(tx, campusId, yearId) {
  const teachers = await tx.teacher.findMany({
    where: { campusId, academicYearId: yearId, email: { not: null } },
  });
  let count = 0;
  for (const teacher of teachers) {
    const updated = await tx.user.updateMany({
      where: {
        campusId,
        role: 'TEACHER',
        email: teacher.email.toLowerCase(),
      },
      data: { teacherId: teacher.id },
    });
    count += updated.count;
  }
  return count;
}

async function relinkStudentUsers(tx, campusId, yearId) {
  const students = await tx.student.findMany({
    where: { campusId, academicYearId: yearId, email: { not: null } },
  });
  let count = 0;
  for (const student of students) {
    const updated = await tx.user.updateMany({
      where: {
        campusId,
        role: 'STUDENT',
        email: student.email.toLowerCase(),
      },
      data: { studentId: student.id },
    });
    count += updated.count;
  }
  return count;
}

router.post('/start-new', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN'), async (req, res) => {
  try {
    const {
      name,
      startDate,
      copyTeachers = false,
      copyClasses = false,
      copySubjects = false,
    } = req.body;

    if (!name || !startDate) {
      return res.status(400).json({ error: 'Name and start date are required' });
    }

    if (copySubjects && !copyClasses) {
      return res.status(400).json({ error: 'Courses require classes to be copied as well' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const active = await tx.academicYear.findFirst({
        where: { campusId: req.campusId, isActive: true },
      });

      const sourceYearId = active?.id;
      let closed = null;

      if (active) {
        closed = await tx.academicYear.update({
          where: { id: active.id },
          data: {
            isActive: false,
            status: 'CLOSED',
            endDate: new Date(),
          },
        });
      }

      const newYear = await tx.academicYear.create({
        data: {
          campusId: req.campusId,
          name,
          startDate: new Date(startDate),
          isActive: true,
          status: 'ACTIVE',
        },
      });

      let copied = null;
      const shouldCopy = sourceYearId && (copyTeachers || copyClasses || copySubjects);
      if (shouldCopy) {
        const copyResult = await copyAcademicYearRecords(tx, {
          campusId: req.campusId,
          sourceYearId,
          targetYearId: newYear.id,
          copyTeachers: !!copyTeachers,
          copyClasses: !!copyClasses,
          copySubjects: !!copySubjects,
        });
        copied = copyResult;
      }

      if (!copyClasses) {
        copied = copied || {};
        copied.defaultClasses = await ensureDefaultClasses(tx, req.campusId, newYear.id);
      }

      await tx.user.updateMany({
        where: {
          campusId: req.campusId,
          role: { in: ['TEACHER', 'STUDENT'] },
        },
        data: { teacherId: null, studentId: null },
      });

      if (copyTeachers && copied) {
        copied.usersRelinked = await relinkTeacherUsers(tx, req.campusId, newYear.id);
      }

      return { closed, year: newYear, copied, sourceYearName: closed?.name };
    });

    res.status(201).json({
      message: buildStartMessage(result),
      closedYear: result.closed,
      year: result.year,
      copied: result.copied,
      copiedFrom: result.sourceYearName || null,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'This academic year name already exists for this campus' });
    }
    res.status(500).json({ error: error.message });
  }
});

function buildStartMessage({ closed, year, copied }) {
  let msg = closed
    ? `Closed ${closed.name} and started ${year.name}`
    : `Started ${year.name}`;
  if (copied) {
    const parts = [];
    if (copied.teachers) parts.push(`${copied.teachers} teachers`);
    if (copied.classes) parts.push(`${copied.classes} classes`);
    if (copied.subjects) parts.push(`${copied.subjects} courses`);
    if (parts.length) msg += `. Copied ${parts.join(', ')}`;
    if (copied.usersRelinked) msg += `. Re-linked ${copied.usersRelinked} teacher account(s)`;
  }
  return msg;
}

router.patch('/:id/activate', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN'), async (req, res) => {
  try {
    const target = await prisma.academicYear.findFirst({
      where: { id: req.params.id, campusId: req.campusId },
    });
    if (!target) return res.status(404).json({ error: 'Academic year not found' });
    if (target.isActive) {
      return res.status(400).json({ error: 'This academic year is already active' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const previousActive = await tx.academicYear.findFirst({
        where: { campusId: req.campusId, isActive: true },
      });

      if (previousActive) {
        await tx.academicYear.update({
          where: { id: previousActive.id },
          data: {
            isActive: false,
            status: 'CLOSED',
            endDate: previousActive.endDate ?? new Date(),
          },
        });
      }

      const activated = await tx.academicYear.update({
        where: { id: target.id },
        data: {
          isActive: true,
          status: 'ACTIVE',
          endDate: null,
        },
      });

      await tx.user.updateMany({
        where: {
          campusId: req.campusId,
          role: { in: ['TEACHER', 'STUDENT'] },
        },
        data: { teacherId: null, studentId: null },
      });

      const teachersRelinked = await relinkTeacherUsers(tx, req.campusId, target.id);
      const studentsRelinked = await relinkStudentUsers(tx, req.campusId, target.id);

      return { activated, previousActive, teachersRelinked, studentsRelinked };
    });

    let message = `${result.activated.name} is now the active academic year`;
    if (result.previousActive) {
      message = `Deactivated ${result.previousActive.name}. ${message}`;
    }
    const relinkParts = [];
    if (result.teachersRelinked) relinkParts.push(`${result.teachersRelinked} teacher account(s)`);
    if (result.studentsRelinked) relinkParts.push(`${result.studentsRelinked} student account(s)`);
    if (relinkParts.length) message += `. Re-linked ${relinkParts.join(' and ')}`;

    res.json({
      message,
      year: result.activated,
      previousActive: result.previousActive,
      relinked: {
        teachers: result.teachersRelinked,
        students: result.studentsRelinked,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/close', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN'), async (req, res) => {
  try {
    const year = await prisma.academicYear.findFirst({
      where: { id: req.params.id, campusId: req.campusId },
    });
    if (!year) return res.status(404).json({ error: 'Academic year not found' });
    if (!year.isActive) return res.status(400).json({ error: 'This academic year is already closed' });

    const updated = await prisma.academicYear.update({
      where: { id: year.id },
      data: { isActive: false, status: 'CLOSED', endDate: new Date() },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
