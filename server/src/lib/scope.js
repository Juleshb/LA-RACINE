import prisma from './prisma.js';
import { getTeacherClassIds, resolveTeacherId } from './teacherAccess.js';

export function campusYearWhere(req) {
  return {
    campusId: req.campusId,
    academicYearId: req.academicYearId,
  };
}

export function classYearWhere(req) {
  return {
    campusId: req.campusId,
    class: { academicYearId: req.academicYearId },
  };
}

export function studentYearWhere(req) {
  return {
    campusId: req.campusId,
    academicYearId: req.academicYearId,
  };
}

async function teacherClassIdsForReq(req) {
  if (req.user.role !== 'TEACHER') return null;
  const teacherId = await resolveTeacherId(req);
  if (!teacherId) return [];
  return getTeacherClassIds(teacherId, req.campusId, req.academicYearId);
}

/** Validate optional classId filter for scoped roles (teacher/parent/student). */
export async function resolveClassIdFilter(req, classId) {
  if (!classId) return undefined;

  if (req.user.role === 'TEACHER') {
    const allowed = await teacherClassIdsForReq(req);
    if (!allowed.includes(classId)) {
      const err = new Error('You do not have access to this class');
      err.status = 403;
      throw err;
    }
    return classId;
  }

  if (req.user.role === 'PARENT' && req.user.parentId) {
    const children = await prisma.student.findMany({
      where: { parentId: req.user.parentId, ...studentYearWhere(req), registrationStatus: 'APPROVED' },
      select: { classId: true },
    });
    const allowed = [...new Set(children.map((c) => c.classId).filter(Boolean))];
    if (!allowed.includes(classId)) {
      const err = new Error('You do not have access to this class');
      err.status = 403;
      throw err;
    }
    return classId;
  }

  if (req.user.role === 'STUDENT' && req.user.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: req.user.studentId },
      select: { classId: true },
    });
    if (student?.classId !== classId) {
      const err = new Error('You do not have access to this class');
      err.status = 403;
      throw err;
    }
    return classId;
  }

  return classId;
}

export async function studentScopeWhere(req) {
  const base = studentYearWhere(req);
  const { role, studentId, parentId } = req.user;

  if (role === 'STUDENT' && studentId) {
    return { ...base, id: studentId };
  }

  if (role === 'PARENT' && parentId) {
    return { ...base, parentId, registrationStatus: 'APPROVED' };
  }

  if (role === 'TEACHER') {
    const classIds = await teacherClassIdsForReq(req);
    if (!classIds.length) return { ...base, classId: { in: [] } };
    return {
      ...base,
      registrationStatus: 'APPROVED',
      classId: { in: classIds },
    };
  }

  return base;
}

export async function classScopeWhere(req) {
  const base = campusYearWhere(req);
  const { role, studentId, parentId } = req.user;

  if (role === 'TEACHER') {
    const classIds = await teacherClassIdsForReq(req);
    if (!classIds.length) return { ...base, id: { in: [] } };
    return { ...base, id: { in: classIds } };
  }

  if (role === 'STUDENT' && studentId) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true },
    });
    if (!student?.classId) return { ...base, id: { in: [] } };
    return { ...base, id: student.classId };
  }

  if (role === 'PARENT' && parentId) {
    const children = await prisma.student.findMany({
      where: { parentId, ...studentYearWhere(req), registrationStatus: 'APPROVED' },
      select: { classId: true },
    });
    const classIds = [...new Set(children.map((c) => c.classId).filter(Boolean))];
    if (!classIds.length) return { ...base, id: { in: [] } };
    return { ...base, id: { in: classIds } };
  }

  return base;
}

export async function homeworkScopeWhere(req) {
  const base = {
    campusId: req.campusId,
    academicYearId: req.academicYearId,
  };
  const { role, teacherId, studentId, parentId } = req.user;

  if (role === 'TEACHER') {
    const classIds = await teacherClassIdsForReq(req);
    if (!classIds.length) return { ...base, classId: { in: [] } };
    return { ...base, classId: { in: classIds } };
  }

  if (role === 'STUDENT' && studentId) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true },
    });
    if (!student?.classId) return { ...base, classId: { in: [] } };
    return { ...base, classId: student.classId };
  }

  if (role === 'PARENT' && parentId) {
    const children = await prisma.student.findMany({
      where: { parentId, ...studentYearWhere(req), registrationStatus: 'APPROVED' },
      select: { classId: true },
    });
    const classIds = [...new Set(children.map((c) => c.classId).filter(Boolean))];
    if (!classIds.length) return { ...base, classId: { in: [] } };
    return { ...base, classId: { in: classIds } };
  }

  return base;
}

export async function timetableScopeWhere(req) {
  return homeworkScopeWhere(req);
}

/** Student IDs enrolled in classes taught by the logged-in teacher. */
export async function teacherStudentIdsForReq(req) {
  const classIds = await teacherClassIdsForReq(req);
  if (!classIds?.length) return [];
  const students = await prisma.student.findMany({
    where: {
      ...studentYearWhere(req),
      registrationStatus: 'APPROVED',
      classId: { in: classIds },
    },
    select: { id: true },
  });
  return students.map((s) => s.id);
}
