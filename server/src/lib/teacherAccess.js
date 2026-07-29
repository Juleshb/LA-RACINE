import prisma from './prisma.js';

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

/** Returns an error message if the teacher cannot access this class. */
export async function assertTeacherClassAccess(req, classId) {
  if (req.user.role !== 'TEACHER') return null;
  if (!classId) return 'Class is required';
  const allowed = await getTeacherClassIdsForReq(req);
  if (!allowed.length) return 'Your account is not linked to any classes';
  if (!allowed.includes(classId)) return 'You do not have access to this class';
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

export function denyTeacherWrite(req, res) {
  if (req.user.role === 'TEACHER') {
    res.status(403).json({ error: 'Teachers can only view this information' });
    return true;
  }
  return false;
}
