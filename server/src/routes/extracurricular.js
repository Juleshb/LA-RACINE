import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { campusYearWhere, studentScopeWhere } from '../lib/scope.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { PRIMARY_GRADES, isPrimaryGrade } from '../config/grades.js';

const router = Router();

const studentInclude = {
  select: {
    id: true,
    studentId: true,
    firstName: true,
    lastName: true,
    classId: true,
    class: { select: { id: true, name: true, grade: true, section: true } },
  },
};

function canManageActivities(role) {
  return [
    'SCHOOL_MANAGER',
    'SCHOOL_ADMIN',
    'SECRETARY',
    'HEAD_OF_STUDIES',
    'HEAD_OF_DISCIPLINE',
    'ACTIVITIES_MANAGER',
  ].includes(role);
}

function parseAllowedGrades(value) {
  if (Array.isArray(value)) return value.filter((g) => PRIMARY_GRADES.includes(g));
  return [...PRIMARY_GRADES];
}

function groupEnrollmentsByClass(enrollments) {
  const map = new Map();
  for (const row of enrollments) {
    const cls = row.student?.class;
    const key = cls?.id || 'unknown';
    if (!map.has(key)) {
      map.set(key, {
        classId: cls?.id || null,
        className: cls?.name || 'No class',
        grade: cls?.grade || null,
        section: cls?.section || null,
        students: [],
      });
    }
    map.get(key).students.push({
      enrollmentId: row.id,
      id: row.student.id,
      studentId: row.student.studentId,
      name: `${row.student.firstName} ${row.student.lastName}`.trim(),
      enrolledAt: row.enrolledAt,
    });
  }
  return [...map.values()].sort((a, b) => {
    const ga = PRIMARY_GRADES.indexOf(a.grade) ?? 99;
    const gb = PRIMARY_GRADES.indexOf(b.grade) ?? 99;
    if (ga !== gb) return ga - gb;
    return (a.section || '').localeCompare(b.section || '');
  });
}

async function getPrimaryClasses(req) {
  return prisma.class.findMany({
    where: {
      ...campusYearWhere(req),
      grade: { in: PRIMARY_GRADES },
    },
    orderBy: [{ grade: 'asc' }, { section: 'asc' }],
    select: { id: true, name: true, grade: true, section: true },
  });
}

async function validatePrimaryStudent(req, studentId) {
  const scope = await studentScopeWhere(req);
  const student = await prisma.student.findFirst({
    where: { id: studentId, ...scope },
    include: { class: { select: { grade: true, name: true } } },
  });
  if (!student) return { error: 'Student not found or access denied' };
  if (!student.class || !isPrimaryGrade(student.class.grade)) {
    return { error: 'Only Primary section students (P1–P6) can join extracurricular activities' };
  }
  return { student };
}

async function resolveTargetStudentId(req, bodyStudentId) {
  const { role, studentId, parentId } = req.user;

  if (role === 'STUDENT') {
    if (bodyStudentId && bodyStudentId !== studentId) {
      return { error: 'You can only enroll yourself' };
    }
    return { studentId };
  }

  if (role === 'PARENT') {
    if (!bodyStudentId) return { error: 'Select which child to enroll' };
    const child = await prisma.student.findFirst({
      where: { id: bodyStudentId, parentId, ...campusYearWhere(req) },
      select: { id: true },
    });
    if (!child) return { error: 'Child not found' };
    return { studentId: bodyStudentId };
  }

  if (!bodyStudentId) return { error: 'Student is required' };
  return { studentId: bodyStudentId };
}

const instructorInclude = {
  instructorTeacher: { select: { id: true, name: true, subject: true, phone: true, email: true } },
  externalInstructor: { select: { id: true, name: true, phone: true, email: true, specialty: true } },
};

function instructorDisplayName(activity) {
  return activity.instructorTeacher?.name
    || activity.externalInstructor?.name
    || activity.instructor
    || null;
}

function serializeActivity(activity, { myEnrollments = [], includeDetails = false } = {}) {
  const allowedGrades = parseAllowedGrades(activity.allowedGrades);
  const enrollmentCount = activity._count?.enrollments ?? activity.enrollments?.length ?? 0;
  const enrolledStudentIds = new Set((activity.enrollments || []).map((e) => e.studentId));
  const isEnrolled = myEnrollments.includes(activity.id);
  const kind = activity.instructorKind
    || (activity.instructorTeacherId ? 'TEACHER' : activity.externalInstructorId ? 'EXTERNAL' : null);

  const base = {
    id: activity.id,
    name: activity.name,
    description: activity.description,
    category: activity.category,
    schedule: activity.schedule,
    location: activity.location,
    instructor: instructorDisplayName(activity),
    instructorKind: kind,
    instructorTeacherId: activity.instructorTeacherId || null,
    externalInstructorId: activity.externalInstructorId || null,
    instructorTeacher: activity.instructorTeacher || null,
    externalInstructor: activity.externalInstructor || null,
    maxStudents: activity.maxStudents,
    allowedGrades,
    isActive: activity.isActive,
    enrollmentCount,
    isFull: activity.maxStudents != null && enrollmentCount >= activity.maxStudents,
    isEnrolled,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
  };

  if (!includeDetails) return base;

  const enrollmentsByClass = groupEnrollmentsByClass(activity.enrollments || []);
  return {
    ...base,
    enrollmentsByClass,
    enrolledStudentIds: [...enrolledStudentIds],
  };
}

router.use(authorizePermission(PERMISSIONS.EXTRACURRICULAR));

router.get('/primary-classes', async (req, res) => {
  try {
    const classes = await getPrimaryClasses(req);
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/eligible-students', async (req, res) => {
  try {
    const { classId, activityId } = req.query;
    const scope = await studentScopeWhere(req);

    const activity = activityId
      ? await prisma.extracurricularActivity.findFirst({
        where: { id: activityId, ...campusYearWhere(req) },
      })
      : null;

    const allowedGrades = activity ? parseAllowedGrades(activity.allowedGrades) : PRIMARY_GRADES;

    const students = await prisma.student.findMany({
      where: {
        ...scope,
        class: {
          grade: { in: allowedGrades },
          ...(classId ? { id: classId } : {}),
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: { class: { select: { name: true, grade: true, section: true } } },
    });

    res.json(students.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      name: `${s.firstName} ${s.lastName}`.trim(),
      className: s.class?.name,
      grade: s.class?.grade,
      section: s.class?.section,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function listTeachers(req) {
  return prisma.teacher.findMany({
    where: campusYearWhere(req),
    orderBy: { name: 'asc' },
    select: { id: true, name: true, subject: true, phone: true, email: true },
  });
}

async function listExternalInstructors(req) {
  return prisma.externalInstructor.findMany({
    where: { campusId: req.campusId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, phone: true, email: true, specialty: true },
  });
}

async function resolveInstructor(req, body = {}, existing = {}) {
  const kind = String(body.instructorKind || '').toUpperCase();
  const teacherId = body.instructorTeacherId || null;
  let externalId = body.externalInstructorId || null;
  const incoming = body.externalInstructor || null;

  if (kind === 'TEACHER') {
    if (!teacherId) {
      return {
        instructorKind: null,
        instructorTeacherId: null,
        externalInstructorId: null,
        instructor: null,
      };
    }
    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, ...campusYearWhere(req) },
      select: { id: true, name: true },
    });
    if (!teacher) return { error: 'Teacher not found' };
    return {
      instructorKind: 'TEACHER',
      instructorTeacherId: teacher.id,
      externalInstructorId: null,
      instructor: teacher.name,
    };
  }

  if (kind === 'EXTERNAL' || externalId || incoming?.name) {
    if (incoming?.name?.trim() && !externalId) {
      const created = await prisma.externalInstructor.create({
        data: {
          campusId: req.campusId,
          name: incoming.name.trim(),
          phone: incoming.phone?.trim() || null,
          email: incoming.email?.trim() || null,
          specialty: incoming.specialty?.trim() || null,
          notes: incoming.notes?.trim() || null,
        },
      });
      externalId = created.id;
    }
    if (!externalId) {
      return { error: 'Select or register an external instructor' };
    }
    const ext = await prisma.externalInstructor.findFirst({
      where: { id: externalId, campusId: req.campusId },
    });
    if (!ext) return { error: 'External instructor not found' };
    return {
      instructorKind: 'EXTERNAL',
      instructorTeacherId: null,
      externalInstructorId: ext.id,
      instructor: ext.name,
    };
  }

  return {
    instructorKind: existing.instructorKind || null,
    instructorTeacherId: existing.instructorTeacherId ?? null,
    externalInstructorId: existing.externalInstructorId ?? null,
    instructor: body.instructor !== undefined ? (body.instructor || null) : (existing.instructor ?? null),
  };
}

router.get('/external-instructors', async (req, res) => {
  try {
    if (!canManageActivities(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const instructors = await listExternalInstructors(req);
    res.json(instructors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/external-instructors', async (req, res) => {
  try {
    if (!canManageActivities(req.user.role)) {
      return res.status(403).json({ error: 'You cannot register instructors' });
    }
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Instructor name is required' });
    const created = await prisma.externalInstructor.create({
      data: {
        campusId: req.campusId,
        name,
        phone: req.body?.phone?.trim() || null,
        email: req.body?.email?.trim() || null,
        specialty: req.body?.specialty?.trim() || null,
        notes: req.body?.notes?.trim() || null,
      },
    });
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { role, studentId, parentId } = req.user;
    const { forStudentId } = req.query;
    const baseWhere = campusYearWhere(req);

    let targetStudentId = null;
    if (role === 'STUDENT' && studentId) {
      targetStudentId = studentId;
    } else if (forStudentId) {
      const scope = await studentScopeWhere(req);
      const allowed = await prisma.student.findFirst({
        where: { id: forStudentId, ...scope },
        select: { id: true },
      });
      if (allowed) targetStudentId = forStudentId;
    }

    let myEnrollments = [];
    if (targetStudentId) {
      const rows = await prisma.extracurricularEnrollment.findMany({
        where: { studentId: targetStudentId },
        select: { activityId: true },
      });
      myEnrollments = rows.map((r) => r.activityId);
    }

    let studentGrade = null;
    if (targetStudentId) {
      const student = await prisma.student.findUnique({
        where: { id: targetStudentId },
        include: { class: { select: { grade: true } } },
      });
      studentGrade = student?.class?.grade || null;
    }

    const activities = await prisma.extracurricularActivity.findMany({
      where: {
        ...baseWhere,
        ...(role === 'STUDENT' || role === 'PARENT' ? { isActive: true } : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { enrollments: true } },
        ...instructorInclude,
      },
    });

    const filtered = (studentGrade && (role === 'STUDENT' || role === 'PARENT'))
      ? activities.filter((a) => parseAllowedGrades(a.allowedGrades).includes(studentGrade))
      : activities;

    const primaryClasses = await getPrimaryClasses(req);
    const payload = {
      activities: filtered.map((a) => serializeActivity(a, { myEnrollments })),
      primaryClasses,
    };
    if (canManageActivities(role)) {
      payload.teachers = await listTeachers(req);
      payload.externalInstructors = await listExternalInstructors(req);
    }
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const activity = await prisma.extracurricularActivity.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
      include: {
        enrollments: {
          include: { student: studentInclude },
          orderBy: { enrolledAt: 'asc' },
        },
        ...instructorInclude,
      },
    });
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    res.json(serializeActivity(activity, { includeDetails: true }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!canManageActivities(req.user.role)) {
      return res.status(403).json({ error: 'You cannot create activities' });
    }

    const {
      name, description, category, schedule, location, maxStudents, allowedGrades, isActive,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Activity name is required' });

    const grades = parseAllowedGrades(allowedGrades);
    if (!grades.length) {
      return res.status(400).json({ error: 'Select at least one Primary grade (P1–P6)' });
    }

    const instructorFields = await resolveInstructor(req, req.body);
    if (instructorFields.error) return res.status(400).json({ error: instructorFields.error });

    const activity = await prisma.extracurricularActivity.create({
      data: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        name: name.trim(),
        description: description || null,
        category: category || null,
        schedule: schedule || null,
        location: location || null,
        ...instructorFields,
        maxStudents: maxStudents ? Number(maxStudents) : null,
        allowedGrades: grades,
        isActive: isActive !== false,
      },
      include: {
        _count: { select: { enrollments: true } },
        ...instructorInclude,
      },
    });

    res.status(201).json(serializeActivity(activity));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!canManageActivities(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit activities' });
    }

    const existing = await prisma.extracurricularActivity.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Activity not found' });

    const {
      name, description, category, schedule, location, maxStudents, allowedGrades, isActive,
    } = req.body;

    const grades = allowedGrades != null ? parseAllowedGrades(allowedGrades) : parseAllowedGrades(existing.allowedGrades);
    if (!grades.length) {
      return res.status(400).json({ error: 'Select at least one Primary grade (P1–P6)' });
    }

    const instructorFields = await resolveInstructor(req, req.body, existing);
    if (instructorFields.error) return res.status(400).json({ error: instructorFields.error });

    const activity = await prisma.extracurricularActivity.update({
      where: { id: req.params.id },
      data: {
        name: name?.trim() ?? existing.name,
        description: description ?? existing.description,
        category: category ?? existing.category,
        schedule: schedule ?? existing.schedule,
        location: location ?? existing.location,
        ...instructorFields,
        maxStudents: maxStudents !== undefined ? (maxStudents ? Number(maxStudents) : null) : existing.maxStudents,
        allowedGrades: grades,
        isActive: isActive ?? existing.isActive,
      },
      include: {
        _count: { select: { enrollments: true } },
        ...instructorInclude,
      },
    });

    res.json(serializeActivity(activity));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!canManageActivities(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete activities' });
    }

    const existing = await prisma.extracurricularActivity.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Activity not found' });

    await prisma.extracurricularActivity.delete({ where: { id: req.params.id } });
    res.json({ message: 'Activity deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/enroll', async (req, res) => {
  try {
    const { studentId: bodyStudentId } = req.body;
    const resolved = await resolveTargetStudentId(req, bodyStudentId);
    if (resolved.error) return res.status(400).json({ error: resolved.error });

    const validated = await validatePrimaryStudent(req, resolved.studentId);
    if (validated.error) return res.status(400).json({ error: validated.error });

    const activity = await prisma.extracurricularActivity.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req), isActive: true },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const allowedGrades = parseAllowedGrades(activity.allowedGrades);
    if (!allowedGrades.includes(validated.student.class.grade)) {
      return res.status(400).json({
        error: `This activity is only open to: ${allowedGrades.join(', ')}`,
      });
    }

    if (activity.maxStudents != null && activity._count.enrollments >= activity.maxStudents) {
      return res.status(400).json({ error: 'This activity is full' });
    }

    const existing = await prisma.extracurricularEnrollment.findUnique({
      where: {
        activityId_studentId: { activityId: activity.id, studentId: resolved.studentId },
      },
    });
    if (existing) return res.status(400).json({ error: 'Already enrolled in this activity' });

    await prisma.extracurricularEnrollment.create({
      data: { activityId: activity.id, studentId: resolved.studentId },
    });

    res.status(201).json({ message: 'Enrolled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/enroll/:studentId', async (req, res) => {
  try {
    const resolved = await resolveTargetStudentId(req, req.params.studentId);
    if (resolved.error) return res.status(400).json({ error: resolved.error });

    const activity = await prisma.extracurricularActivity.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const enrollment = await prisma.extracurricularEnrollment.findUnique({
      where: {
        activityId_studentId: { activityId: activity.id, studentId: resolved.studentId },
      },
    });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    if (['PARENT', 'STUDENT'].includes(req.user.role)) {
      const validated = await validatePrimaryStudent(req, resolved.studentId);
      if (validated.error) return res.status(403).json({ error: validated.error });
    }

    await prisma.extracurricularEnrollment.delete({ where: { id: enrollment.id } });
    res.json({ message: 'Removed from activity' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
