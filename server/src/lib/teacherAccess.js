import prisma from './prisma.js';
import { usesCompetenceBulletin } from '../config/grades.js';

export async function getTeacherClassIds(teacherId, campusId, academicYearId) {
  if (!teacherId) return [];
  const [homeroom, subjects] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId, campusId, academicYearId },
      select: { id: true },
    }),
    prisma.subject.findMany({
      where: { teacherId, campusId, class: { academicYearId } },
      select: { classId: true },
    }),
  ]);
  return [...new Set([...homeroom.map((c) => c.id), ...subjects.map((s) => s.classId)])];
}

export async function getLinkedTeacherId(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teacherId: true },
  });
  return user?.teacherId || null;
}

export async function resolveTeacherId(req) {
  if (req.user.role !== 'TEACHER') return null;
  if (req.user.teacherId) return req.user.teacherId;
  return getLinkedTeacherId(req.user.id);
}

export async function getTeacherClassIdsForReq(req) {
  const teacherId = await resolveTeacherId(req);
  if (!teacherId) return [];
  return getTeacherClassIds(teacherId, req.campusId, req.academicYearId);
}

/** Classes where the teacher is assigned at least one subject (excludes homeroom-only). */
export async function getTeacherSubjectClassIds(teacherId, campusId, academicYearId) {
  if (!teacherId) return [];
  const subjects = await prisma.subject.findMany({
    where: { teacherId, campusId, class: { academicYearId } },
    select: { classId: true },
  });
  return [...new Set(subjects.map((s) => s.classId))];
}

export async function getTeacherSubjectClassIdsForReq(req) {
  const teacherId = await resolveTeacherId(req);
  if (!teacherId) return [];
  return getTeacherSubjectClassIds(teacherId, req.campusId, req.academicYearId);
}

/** Returns an error message if the teacher cannot access this class. */
export async function assertTeacherClassAccess(req, classId) {
  if (req.user.role !== 'TEACHER') return null;
  if (!classId) return 'Class is required';
  const allowed = await getTeacherClassIdsForReq(req);
  if (!allowed.length) return 'Your account is not linked to any classes';
  if (!allowed.includes(classId)) return 'You do not have access to this class';
  return null;
}

/**
 * Classes a teacher may use on Marks — only where they have at least one
 * subject assigned (primary or nursery). Homeroom-only does not grant access.
 */
export async function getTeacherMarksClassIdsForReq(req) {
  const teacherId = await resolveTeacherId(req);
  if (!teacherId) return [];
  return getTeacherSubjectClassIds(teacherId, req.campusId, req.academicYearId);
}

/** Marks access: must be assigned a subject in the class. */
export async function assertTeacherMarksClassAccess(req, classId) {
  if (req.user.role !== 'TEACHER') return null;
  if (!classId) return 'Class is required';
  const allowed = await getTeacherMarksClassIdsForReq(req);
  if (!allowed.length) {
    return 'You are not assigned to any subjects. Ask the Head of Studies to assign courses to you.';
  }
  if (!allowed.includes(classId)) {
    return 'You can only view marks for subjects assigned to you';
  }
  return null;
}

/** Nursery competence: teacher must be assigned at least one competence subject in the class. */
export async function assertTeacherCompetenceAccess(req, classId) {
  if (req.user.role !== 'TEACHER') return null;
  if (!classId) return 'Class is required';
  const teacherId = await resolveTeacherId(req);
  if (!teacherId) {
    return 'Your account is not linked to a teacher profile';
  }
  const cls = await prisma.class.findFirst({
    where: {
      id: classId,
      campusId: req.campusId,
      academicYearId: req.academicYearId,
    },
    select: { id: true, grade: true },
  });
  if (!cls) return 'Class not found';
  if (!usesCompetenceBulletin(cls.grade)) {
    return 'This class does not use competence grading';
  }
  const teaches = await prisma.subject.findFirst({
    where: {
      classId,
      teacherId,
      campusId: req.campusId,
      class: { academicYearId: req.academicYearId },
    },
    select: { id: true },
  });
  if (!teaches) {
    return 'You are not assigned to any subjects in this nursery class. Ask the Head of Studies to assign competences to you.';
  }
  return null;
}

export async function assertTeacherCourseAccess(req, course) {
  if (req.user.role !== 'TEACHER') return null;

  const teacherId = await resolveTeacherId(req);
  if (!teacherId) {
    return 'Your account is not linked to a teacher profile';
  }
  if (!course.teacherId || course.teacherId !== teacherId) {
    return 'You can only record marks for courses assigned to you';
  }
  return null;
}

export async function teacherCourseWhere(req) {
  if (req.user.role !== 'TEACHER') return {};
  const teacherId = await resolveTeacherId(req);
  if (!teacherId) return { id: { in: [] } };
  return { teacherId };
}

/**
 * Subjects visible on Marks: teachers → only theirs;
 * other staff → only subjects that already have a teacher (hide Unassigned).
 */
export async function marksCourseWhere(req) {
  if (req.user.role === 'TEACHER') {
    return teacherCourseWhere(req);
  }
  return { teacherId: { not: null } };
}

export function denyTeacherWrite(req, res) {
  if (req.user.role === 'TEACHER') {
    res.status(403).json({ error: 'Teachers can only view this information' });
    return true;
  }
  return false;
}
