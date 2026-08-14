import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizeRoles } from '../config/permissions.js';
import { copyAcademicYearRecords, getCopyPreview } from '../lib/copyAcademicYear.js';
import { ensureDefaultClasses } from '../lib/defaultClasses.js';
import {
  DELIBERATION_DECISIONS,
  buildSuggestion,
  enrollReturningStudents,
  normalizeDecision,
} from '../lib/deliberation.js';

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

router.get('/deliberation', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY'), async (req, res) => {
  try {
    const active = await prisma.academicYear.findFirst({
      where: { campusId: req.campusId, isActive: true },
    });
    if (!active) {
      return res.status(400).json({ error: 'Set an academic year before deliberation.' });
    }

    const students = await prisma.student.findMany({
      where: {
        campusId: req.campusId,
        academicYearId: active.id,
        registrationStatus: 'APPROVED',
      },
      include: {
        class: { select: { id: true, name: true, grade: true, section: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    res.json({
      sourceYear: { id: active.id, name: active.name },
      phase: 'council',
      students: students.map((s) => {
        const suggestion = buildSuggestion(s, []);
        return {
          id: s.id,
          studentId: s.studentId,
          firstName: s.firstName,
          lastName: s.lastName,
          postName: s.postName,
          class: s.class,
          suggestedDecision: suggestion.decision,
          targetGrade: suggestion.targetGrade,
          savedDecision: s.deliberationDecision || null,
          deliberatedAt: s.deliberatedAt,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/deliberation', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY'), async (req, res) => {
  try {
    const { decisions } = req.body || {};
    if (!Array.isArray(decisions) || !decisions.length) {
      return res.status(400).json({ error: 'At least one decision is required' });
    }

    const active = await prisma.academicYear.findFirst({
      where: { campusId: req.campusId, isActive: true },
    });
    if (!active) {
      return res.status(400).json({ error: 'No active academic year' });
    }

    const stats = { promoted: 0, repeated: 0, graduated: 0, rejected: 0, skipped: 0 };
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      for (const row of decisions) {
        const decision = normalizeDecision(row.decision);
        if (!DELIBERATION_DECISIONS.includes(decision) && decision !== 'REJECTED') {
          const err = new Error(`Invalid decision for student ${row.studentRecordId || ''}`);
          err.status = 400;
          throw err;
        }
        if (!['PROMOTE', 'REPEAT', 'GRADUATE', 'REJECTED'].includes(decision)) {
          const err = new Error(`Invalid decision for student ${row.studentRecordId || ''}`);
          err.status = 400;
          throw err;
        }

        const updated = await tx.student.updateMany({
          where: {
            id: row.studentRecordId,
            campusId: req.campusId,
            academicYearId: active.id,
            registrationStatus: 'APPROVED',
          },
          data: {
            deliberationDecision: decision,
            deliberatedAt: now,
          },
        });
        if (!updated.count) {
          stats.skipped += 1;
          continue;
        }
        if (decision === 'PROMOTE') stats.promoted += 1;
        else if (decision === 'REPEAT') stats.repeated += 1;
        else if (decision === 'GRADUATE') stats.graduated += 1;
        else stats.rejected += 1;
      }
    });

    res.json({
      message: [
        stats.promoted && `${stats.promoted} promoted`,
        stats.repeated && `${stats.repeated} to repeat`,
        stats.graduated && `${stats.graduated} graduated`,
        stats.rejected && `${stats.rejected} rejected / not continuing`,
        stats.skipped && `${stats.skipped} skipped`,
      ].filter(Boolean).join('. ') || 'No decisions saved.',
      stats,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/:id/copy-preview', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN'), async (req, res) => {
  try {
    const year = await prisma.academicYear.findFirst({
      where: { id: req.params.id, campusId: req.campusId },
    });
    if (!year) return res.status(404).json({ error: 'Academic year not found' });

    const preview = await getCopyPreview(prisma, req.campusId, year.id);
    const [approved, decided] = await Promise.all([
      prisma.student.count({
        where: { campusId: req.campusId, academicYearId: year.id, registrationStatus: 'APPROVED' },
      }),
      prisma.student.groupBy({
        by: ['deliberationDecision'],
        where: { campusId: req.campusId, academicYearId: year.id, registrationStatus: 'APPROVED' },
        _count: { _all: true },
      }),
    ]);
    const deliberation = { approved, undecided: 0, promote: 0, repeat: 0, graduate: 0, rejected: 0 };
    for (const row of decided) {
      const n = row._count._all;
      if (!row.deliberationDecision) deliberation.undecided += n;
      else if (row.deliberationDecision === 'PROMOTE') deliberation.promote += n;
      else if (row.deliberationDecision === 'REPEAT') deliberation.repeat += n;
      else if (row.deliberationDecision === 'GRADUATE') deliberation.graduate += n;
      else deliberation.rejected += n;
    }
    res.json({ year: { id: year.id, name: year.name }, ...preview, deliberation });
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
      confirmationFeeAmount = null,
      confirmationFeeDueDate = null,
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

      const feeAmount = confirmationFeeAmount === null || confirmationFeeAmount === ''
        ? null
        : Number(confirmationFeeAmount);
      const newYear = await tx.academicYear.create({
        data: {
          campusId: req.campusId,
          name,
          startDate: new Date(startDate),
          isActive: true,
          status: 'ACTIVE',
          confirmationFeeAmount: Number.isFinite(feeAmount) ? feeAmount : null,
          confirmationFeeDueDate: confirmationFeeDueDate ? new Date(confirmationFeeDueDate) : null,
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

      let enrolled = null;
      if (sourceYearId) {
        enrolled = await enrollReturningStudents(tx, {
          campusId: req.campusId,
          sourceYearId,
          targetYearId: newYear.id,
          feeAmount: Number.isFinite(feeAmount) ? feeAmount : 0,
          feeDue: confirmationFeeDueDate || newYear.startDate,
        });
      }

      return { closed, year: newYear, copied, enrolled, sourceYearName: closed?.name };
    }, { timeout: 120000, maxWait: 20000 });

    res.status(201).json({
      message: buildStartMessage(result),
      closedYear: result.closed,
      year: result.year,
      copied: result.copied,
      enrolled: result.enrolled,
      copiedFrom: result.sourceYearName || null,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'This academic year name already exists for this campus' });
    }
    res.status(500).json({ error: error.message });
  }
});

function buildStartMessage({ closed, year, copied, enrolled }) {
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
  if (enrolled) {
    const parts = [];
    if (enrolled.promoted) parts.push(`${enrolled.promoted} promoted`);
    if (enrolled.repeated) parts.push(`${enrolled.repeated} repeating`);
    if (enrolled.confirmationFees) parts.push(`${enrolled.confirmationFees} confirmation fee(s)`);
    if (enrolled.awaitingConfirmation) parts.push(`${enrolled.awaitingConfirmation} awaiting confirmation payment`);
    if (parts.length) msg += `. Enrolled ${parts.join(', ')}`;
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

router.post('/:id/revert', authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN'), async (req, res) => {
  try {
    const year = await prisma.academicYear.findFirst({
      where: { id: req.params.id, campusId: req.campusId },
      include: {
        _count: { select: { students: true, teachers: true, classes: true } },
      },
    });
    if (!year) return res.status(404).json({ error: 'Academic year not found' });
    if (!year.isActive) {
      return res.status(400).json({
        error: 'Activate this year first, then revert it. Revert only works on the current active year.',
      });
    }

    const previous = await prisma.academicYear.findFirst({
      where: {
        campusId: req.campusId,
        id: { not: year.id },
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });

    const result = await prisma.$transaction(async (tx) => {
      const teachers = await tx.teacher.findMany({
        where: { campusId: req.campusId, academicYearId: year.id },
        select: { id: true },
      });
      const students = await tx.student.findMany({
        where: { campusId: req.campusId, academicYearId: year.id },
        select: { id: true },
      });
      const teacherIds = teachers.map((t) => t.id);
      const studentIds = students.map((s) => s.id);

      if (teacherIds.length) {
        await tx.user.updateMany({
          where: { teacherId: { in: teacherIds } },
          data: { teacherId: null },
        });
      }
      if (studentIds.length) {
        await tx.user.updateMany({
          where: { studentId: { in: studentIds } },
          data: { studentId: null },
        });
        await tx.feePayment.deleteMany({
          where: { studentId: { in: studentIds } },
        });
      }

      await tx.academicYear.delete({ where: { id: year.id } });

      let restored = null;
      let teachersRelinked = 0;
      let studentsRelinked = 0;
      if (previous) {
        restored = await tx.academicYear.update({
          where: { id: previous.id },
          data: {
            isActive: true,
            status: 'ACTIVE',
            endDate: null,
          },
        });
        teachersRelinked = await relinkTeacherUsers(tx, req.campusId, restored.id);
        studentsRelinked = await relinkStudentUsers(tx, req.campusId, restored.id);
      }

      return { restored, teachersRelinked, studentsRelinked };
    });

    let message = `Removed ${year.name}`;
    if (result.restored) {
      message += `. ${result.restored.name} is active again — you can start the new year when you are ready.`;
    } else {
      message += '. No other year left. Set an academic year when you are ready.';
    }
    const relinkParts = [];
    if (result.teachersRelinked) relinkParts.push(`${result.teachersRelinked} teacher account(s)`);
    if (result.studentsRelinked) relinkParts.push(`${result.studentsRelinked} student account(s)`);
    if (relinkParts.length) message += ` Re-linked ${relinkParts.join(' and ')}.`;

    res.json({
      message,
      restoredYear: result.restored,
      removedYear: { id: year.id, name: year.name },
      relinked: {
        teachers: result.teachersRelinked,
        students: result.studentsRelinked,
      },
    });
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'This year still has linked records that cannot be removed automatically. Contact support or remove them first.',
      });
    }
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
