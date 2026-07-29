import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { campusYearWhere } from '../lib/scope.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { getTeacherClassIds, getTeacherClassIdsForReq, resolveTeacherId } from '../lib/teacherAccess.js';

const router = Router();

function requireTeacher(req, res) {
  if (req.user.role !== 'TEACHER') {
    res.status(403).json({ error: 'This endpoint is for teacher accounts only' });
    return false;
  }
  return true;
}

function schoolDayIndex(date = new Date()) {
  return (date.getDay() + 6) % 7;
}

/** Aggregated teacher dashboard — scoped to the logged-in teacher. */
router.get('/dashboard', authorizePermission(PERMISSIONS.DASHBOARD), async (req, res) => {
  try {
    if (!requireTeacher(req, res)) return;

    const teacherId = await resolveTeacherId(req);
    if (!teacherId) {
      return res.json({
        classes: [],
        courses: [],
        studentCount: 0,
        todaySchedule: [],
        unreadCount: 0,
        recentMessages: [],
        upcomingHomework: [],
        attendanceToday: { present: 0, absent: 0, late: 0, excused: 0, total: 0, marked: 0 },
      });
    }

    const base = campusYearWhere(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayIndex = schoolDayIndex(today);

    const classIds = await getTeacherClassIds(teacherId, req.campusId, req.academicYearId);

    const [
      homeroomClasses,
      subjectLinks,
      courses,
      todaySlots,
      homeworkItems,
      broadcasts,
      openThreads,
      students,
      todayAttendance,
    ] = await Promise.all([
      prisma.class.findMany({
        where: { teacherId, ...base },
        orderBy: [{ grade: 'asc' }, { section: 'asc' }],
        include: { _count: { select: { students: true } } },
      }),
      prisma.subject.findMany({
        where: { teacherId, campusId: req.campusId, class: { academicYearId: req.academicYearId } },
        select: {
          id: true,
          name: true,
          code: true,
          class: { select: { id: true, name: true, grade: true, section: true } },
        },
        orderBy: [{ class: { grade: 'asc' } }, { name: 'asc' }],
        take: 12,
      }),
      prisma.subject.findMany({
        where: { teacherId, campusId: req.campusId, class: { academicYearId: req.academicYearId } },
        select: { id: true },
      }),
      classIds.length
        ? prisma.timetableSlot.findMany({
            where: {
              campusId: req.campusId,
              academicYearId: req.academicYearId,
              classId: { in: classIds },
              dayOfWeek: dayIndex,
            },
            orderBy: { startTime: 'asc' },
            include: {
              class: { select: { name: true, grade: true, section: true } },
              subject: { select: { name: true, code: true } },
            },
          })
        : [],
      classIds.length
        ? prisma.homework.findMany({
            where: {
              campusId: req.campusId,
              academicYearId: req.academicYearId,
              classId: { in: classIds },
              dueDate: { gte: today },
            },
            orderBy: { dueDate: 'asc' },
            take: 5,
            include: {
              class: { select: { name: true } },
              subject: { select: { name: true } },
            },
          })
        : [],
      prisma.communicationBroadcast.findMany({
        where: base,
        include: { reads: { where: { userId: req.user.id }, select: { id: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      (async () => {
        const ids = await getTeacherClassIdsForReq(req);
        if (!ids.length) return [];
        return prisma.communicationThread.findMany({
          where: {
            ...base,
            status: 'OPEN',
            OR: [
              { student: { classId: { in: ids } } },
              { initiatedBy: 'SCHOOL' },
            ],
          },
          orderBy: { lastMessageAt: 'desc' },
          take: 5,
          include: {
            messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { role: true } } } },
            student: { select: { firstName: true, lastName: true } },
          },
        });
      })(),
      classIds.length
        ? prisma.student.findMany({
            where: {
              ...base,
              classId: { in: classIds },
              registrationStatus: 'APPROVED',
            },
            select: { id: true },
          })
        : [],
      classIds.length
        ? prisma.attendance.findMany({
            where: {
              date: today,
              student: { classId: { in: classIds }, ...base, registrationStatus: 'APPROVED' },
            },
            select: { status: true },
          })
        : [],
    ]);

    const homeroomIds = new Set(homeroomClasses.map((c) => c.id));
    const extraClassIds = classIds.filter((id) => !homeroomIds.has(id));
    const extraClasses = extraClassIds.length
      ? await prisma.class.findMany({
          where: { id: { in: extraClassIds }, ...base },
          orderBy: [{ grade: 'asc' }, { section: 'asc' }],
          include: { _count: { select: { students: true } } },
        })
      : [];

    const classes = [
      ...homeroomClasses.map((c) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        section: c.section,
        studentCount: c._count.students,
        isHomeroom: true,
      })),
      ...extraClasses.map((c) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        section: c.section,
        studentCount: c._count.students,
        isHomeroom: false,
      })),
    ];

    const attendanceToday = {
      present: todayAttendance.filter((a) => a.status === 'PRESENT').length,
      absent: todayAttendance.filter((a) => a.status === 'ABSENT').length,
      late: todayAttendance.filter((a) => a.status === 'LATE').length,
      excused: todayAttendance.filter((a) => a.status === 'EXCUSED').length,
      marked: todayAttendance.length,
      total: students.length,
    };

    const unreadBroadcasts = broadcasts.filter((b) => !b.reads.length);
    const unreadThreads = openThreads.filter((t) => t.messages[0]?.sender?.role === 'PARENT');
    const unreadCount = unreadBroadcasts.length + unreadThreads.length;

    const recentMessages = [
      ...broadcasts.slice(0, 3).map((b) => ({
        id: b.id,
        type: 'announcement',
        title: b.title,
        body: b.body,
        createdAt: b.createdAt,
        isRead: b.reads.length > 0,
      })),
      ...openThreads.slice(0, 2).map((t) => ({
        id: t.id,
        type: 'thread',
        title: t.subject || `Message — ${t.student?.firstName || ''} ${t.student?.lastName || ''}`.trim(),
        body: t.messages[0]?.body || '',
        createdAt: t.lastMessageAt,
        isRead: t.messages[0]?.sender?.role !== 'PARENT',
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);

    res.json({
      classes,
      courses: subjectLinks,
      courseCount: courses.length,
      studentCount: students.length,
      todaySchedule: todaySlots.map((slot) => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        class: slot.class,
        subject: slot.subject,
      })),
      unreadCount,
      recentMessages,
      upcomingHomework: homeworkItems,
      attendanceToday,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
