import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { studentScopeWhere, resolveClassIdFilter } from '../lib/scope.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.ATTENDANCE));

router.get('/', async (req, res) => {
  try {
    const { date, classId } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const scope = await studentScopeWhere(req);
    const safeClassId = classId ? await resolveClassIdFilter(req, classId) : undefined;
    const students = await prisma.student.findMany({
      where: {
        ...scope,
        ...(safeClassId ? { classId: safeClassId } : {}),
      },
      include: {
        class: true,
        attendance: { where: { date: targetDate } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    res.json({ date: targetDate.toISOString().split('T')[0], students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    if (['PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot record attendance' });
    }
    const { date, records } = req.body;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const scope = await studentScopeWhere(req);
    const studentIds = records.map((r) => r.studentId);
    const validStudents = await prisma.student.findMany({
      where: { id: { in: studentIds }, ...scope },
      select: { id: true },
    });
    const validIds = new Set(validStudents.map((s) => s.id));

    const results = await Promise.all(
      records
        .filter(({ studentId }) => validIds.has(studentId))
        .map(({ studentId, status, notes }) =>
          prisma.attendance.upsert({
            where: { studentId_date: { studentId, date: targetDate } },
            update: { status, notes },
            create: { studentId, date: targetDate, status, notes },
          })
        )
    );

    res.json({ saved: results.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scope = await studentScopeWhere(req);
    const campusStudents = await prisma.student.findMany({
      where: scope,
      select: { id: true },
    });
    const studentIds = campusStudents.map((s) => s.id);

    const [totalStudents, presentToday, absentToday, lateToday] = await Promise.all([
      Promise.resolve(studentIds.length),
      prisma.attendance.count({
        where: { date: today, status: 'PRESENT', studentId: { in: studentIds } },
      }),
      prisma.attendance.count({
        where: { date: today, status: 'ABSENT', studentId: { in: studentIds } },
      }),
      prisma.attendance.count({
        where: { date: today, status: 'LATE', studentId: { in: studentIds } },
      }),
    ]);

    const weeklyTrend = await Promise.all(
      Array.from({ length: 7 }, (_, index) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - index));
        return Promise.all([
          prisma.attendance.count({
            where: { date: day, status: 'PRESENT', studentId: { in: studentIds } },
          }),
          prisma.attendance.count({
            where: { date: day, status: 'ABSENT', studentId: { in: studentIds } },
          }),
          prisma.attendance.count({
            where: { date: day, status: 'LATE', studentId: { in: studentIds } },
          }),
        ]).then(([present, absent, late]) => ({
          date: day.toISOString().split('T')[0],
          label: day.toLocaleDateString('en-US', { weekday: 'short' }),
          present,
          absent,
          late,
        }));
      }),
    );

    const markedToday = presentToday + absentToday + lateToday;
    const attendanceRate = markedToday > 0
      ? Math.round((presentToday / markedToday) * 1000) / 10
      : null;

    res.json({
      totalStudents,
      presentToday,
      absentToday,
      lateToday,
      markedToday,
      attendanceRate,
      weeklyTrend,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
