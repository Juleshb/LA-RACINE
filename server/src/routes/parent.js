import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { campusYearWhere } from '../lib/scope.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { getFormOptions } from '../config/registration.js';
import { createStudentRegistration } from '../lib/createRegistration.js';
import { loadPhotoDataUrl } from '../lib/studentRegistration.js';
import {
  createStudentPortalAccount,
  findParentApprovedChild,
  formatStudentAccount,
  resetStudentPortalPassword,
  setStudentPortalActive,
} from '../lib/studentUserAccount.js';

const router = Router();

const studentInclude = {
  class: true,
  academicYear: { select: { id: true, name: true, isActive: true } },
  documents: { orderBy: { createdAt: 'desc' } },
};

function requireParent(req, res) {
  if (req.user.role !== 'PARENT') {
    res.status(403).json({ error: 'This endpoint is for parent accounts only' });
    return false;
  }
  return true;
}

async function ensureParentRecord(req) {
  if (req.user.parentId) return req.user.parentId;

  const parent = await prisma.parent.create({ data: { phone: null } });
  await prisma.user.update({
    where: { id: req.user.id },
    data: { parentId: parent.id },
  });
  req.user.parentId = parent.id;
  return parent.id;
}

/** Children linked to the logged-in parent (read-only family data). */
router.get('/children', authorizePermission(PERMISSIONS.DASHBOARD), async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    if (!req.user.parentId) return res.json([]);

    const children = await prisma.student.findMany({
      where: {
        parentId: req.user.parentId,
        ...campusYearWhere(req),
        registrationStatus: 'APPROVED',
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        classId: true,
        studentAccountCreatedBy: true,
        class: { select: { id: true, name: true, grade: true, section: true } },
        user: { select: { id: true, email: true, isActive: true } },
      },
    });

    res.json(children);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Aggregated parent dashboard — avoids calling staff-only endpoints. */
router.get('/dashboard', authorizePermission(PERMISSIONS.DASHBOARD), async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

      if (!req.user.parentId) {
      return res.json({
        children: [],
        unreadCount: 0,
        recentMessages: [],
        pendingFees: [],
        upcomingHomework: [],
        homeworkGrades: [],
        eLearningGrades: [],
        transport: null,
        pendingRegistrations: [],
      });
    }

    const base = campusYearWhere(req);
    const childWhere = { parentId: req.user.parentId, ...base, registrationStatus: 'APPROVED' };

    const children = await prisma.student.findMany({
      where: childWhere,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        classId: true,
        studentAccountCreatedBy: true,
        class: { select: { id: true, name: true, grade: true, section: true } },
        user: { select: { id: true, email: true, isActive: true } },
      },
    });

    const childIds = children.map((c) => c.id);
    const classIds = [...new Set(children.map((c) => c.classId).filter(Boolean))];

    const [
      todayAttendance,
      pendingFees,
      homeworkItems,
      homeworkSubmissions,
      eLearningSubmissions,
      transportEnrollment,
      unreadBroadcasts,
      openThreads,
      transportAlerts,
      pendingRegistrations,
    ] = await Promise.all([
      childIds.length
        ? prisma.attendance.findMany({
            where: { studentId: { in: childIds }, date: today },
            select: { studentId: true, status: true },
          })
        : [],
      childIds.length
        ? prisma.feePayment.findMany({
            where: {
              studentId: { in: childIds },
              status: { in: ['PENDING', 'OVERDUE'] },
            },
            orderBy: { dueDate: 'asc' },
            include: {
              student: { select: { firstName: true, lastName: true } },
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
      childIds.length
        ? prisma.homeworkSubmission.findMany({
            where: { studentId: { in: childIds } },
            include: {
              homework: {
                select: {
                  id: true, title: true, dueDate: true, subject: { select: { name: true } },
                },
              },
              student: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { submittedAt: 'desc' },
            take: 20,
          })
        : [],
      childIds.length
        ? prisma.eLearningExerciseSubmission.findMany({
            where: { studentId: { in: childIds } },
            include: {
              course: {
                select: { id: true, title: true, subject: true },
              },
              student: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { submittedAt: 'desc' },
            take: 20,
          })
        : [],
      prisma.studentTransport.findFirst({
        where: { isActive: true, student: childWhere },
        include: {
          route: { select: { id: true, name: true, code: true } },
          stop: { select: { name: true, pickupTime: true } },
          student: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.communicationBroadcast.findMany({
        where: { ...base },
        include: {
          reads: { where: { userId: req.user.id }, select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.communicationThread.findMany({
        where: { parentId: req.user.parentId, ...base, status: 'OPEN' },
        orderBy: { lastMessageAt: 'desc' },
        take: 5,
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { role: true } } } },
          student: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.transportAlert.findMany({
        where: {
          ...base,
          notifyParents: true,
          effectiveDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.student.findMany({
        where: {
          parentId: req.user.parentId,
          campusId: req.campusId,
          parentSubmitted: true,
          registrationStatus: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          registrationClass: true,
          registrationStatus: true,
          createdAt: true,
        },
      }),
    ]);

    const attendanceMap = new Map(todayAttendance.map((a) => [a.studentId, a.status]));
    const childrenWithAttendance = children.map((child) => ({
      ...child,
      todayStatus: attendanceMap.get(child.id) || null,
    }));

    const unreadBroadcastsFiltered = unreadBroadcasts.filter((b) => {
      if (b.targetType === 'ALL_PARENTS') return !b.reads.length;
      if (b.targetType === 'CLASS') {
        const applies = children.some((c) => c.classId === b.targetClassId);
        return applies && !b.reads.length;
      }
      if (b.targetType === 'STUDENT') {
        const applies = childIds.includes(b.targetStudentId);
        return applies && !b.reads.length;
      }
      return false;
    });

    const unreadCount = unreadBroadcastsFiltered.length
      + openThreads.filter((t) => t.messages[0]?.sender?.role !== 'PARENT').length;

    const recentMessages = [
      ...unreadBroadcasts.slice(0, 3).map((b) => ({
        id: b.id,
        type: 'announcement',
        title: b.title,
        body: b.body,
        category: b.category,
        priority: b.priority,
        createdAt: b.createdAt,
        isRead: b.reads.length > 0,
      })),
      ...openThreads.slice(0, 2).map((t) => ({
        id: t.id,
        type: 'thread',
        title: t.subject,
        body: t.messages[0]?.body || '',
        category: t.category,
        priority: 'NORMAL',
        createdAt: t.lastMessageAt,
        isRead: t.messages[0]?.sender?.role === 'PARENT',
        studentName: t.student ? `${t.student.firstName} ${t.student.lastName}` : null,
      })),
      ...transportAlerts.slice(0, 2).map((a) => ({
        id: `transport-${a.id}`,
        type: 'transport_alert',
        title: a.title,
        body: a.message,
        category: 'TRANSPORT',
        priority: a.type === 'DELAY' ? 'URGENT' : 'NORMAL',
        createdAt: a.createdAt,
        isRead: true,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4);

    const transport = transportEnrollment
      ? {
          route: transportEnrollment.route,
          stop: transportEnrollment.stop,
          student: transportEnrollment.student,
        }
      : null;

    const homeworkGrades = await Promise.all(children.map(async (child) => {
      const subs = homeworkSubmissions.filter((s) => s.studentId === child.id);
      const totalScore = subs.reduce((sum, s) => sum + s.score, 0);
      const totalMax = subs.reduce((sum, s) => sum + s.maxScore, 0);
      let pending = 0;
      if (child.classId) {
        const homeworkCount = await prisma.homework.count({
          where: {
            campusId: req.campusId,
            academicYearId: req.academicYearId,
            classId: child.classId,
          },
        });
        pending = Math.max(0, homeworkCount - subs.length);
      }
      return {
        student: { id: child.id, firstName: child.firstName, lastName: child.lastName },
        completed: subs.length,
        pending,
        averagePercent: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null,
        recentSubmissions: subs.slice(0, 5).map((s) => ({
          homeworkId: s.homeworkId,
          title: s.homework.title,
          subject: s.homework.subject?.name,
          score: s.score,
          maxScore: s.maxScore,
          percent: s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0,
          submittedAt: s.submittedAt,
        })),
      };
    }));

    const eLearningGrades = await Promise.all(children.map(async (child) => {
      const subs = eLearningSubmissions.filter((s) => s.studentId === child.id);
      const totalScore = subs.reduce((sum, s) => sum + s.score, 0);
      const totalMax = subs.reduce((sum, s) => sum + s.maxScore, 0);
      let pending = 0;
      if (child.classId) {
        const courseCount = await prisma.eLearningCourse.count({
          where: {
            campusId: req.campusId,
            academicYearId: req.academicYearId,
            isPublished: true,
            OR: [{ classId: null }, { classId: child.classId }],
            exercises: { some: {} },
          },
        });
        pending = Math.max(0, courseCount - subs.length);
      }
      return {
        student: { id: child.id, firstName: child.firstName, lastName: child.lastName },
        completed: subs.length,
        pending,
        averagePercent: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null,
        recentSubmissions: subs.slice(0, 5).map((s) => ({
          courseId: s.courseId,
          title: s.course.title,
          subject: s.course.subject,
          score: s.score,
          maxScore: s.maxScore,
          percent: s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0,
          submittedAt: s.submittedAt,
        })),
      };
    }));

    res.json({
      children: childrenWithAttendance,
      childrenWithoutLogin: children.filter((c) => !c.user).length,
      unreadCount,
      recentMessages,
      pendingFees,
      upcomingHomework: homeworkItems,
      homeworkGrades,
      eLearningGrades,
      transport,
      pendingRegistrations,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Registration form options for parents */
router.get('/registration/options', authorizePermission(PERMISSIONS.REGISTRATION), async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    const [academicYears, classes] = await Promise.all([
      prisma.academicYear.findMany({
        where: { campusId: req.campusId },
        orderBy: { startDate: 'desc' },
        select: { id: true, name: true, isActive: true, status: true },
      }),
      prisma.class.findMany({
        where: { campusId: req.campusId },
        orderBy: [{ grade: 'asc' }, { section: 'asc' }],
        select: { id: true, name: true, grade: true, section: true, academicYearId: true },
      }),
    ]);

    res.json({
      ...getFormOptions(),
      academicYears,
      classes,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Submit a child registration for school review */
router.post('/registration', authorizePermission(PERMISSIONS.REGISTRATION), async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    const parentId = await ensureParentRecord(req);

    const { student, documents } = await createStudentRegistration({
      campusId: req.campusId,
      body: req.body,
      parentId,
      parentSubmitted: true,
      studentInclude,
    });

    res.status(201).json({
      ...student,
      documents,
      message: 'Registration submitted successfully. The school will review and approve or reject your application.',
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/** List all registrations submitted by this parent */
router.get('/registrations', authorizePermission(PERMISSIONS.REGISTRATION), async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    if (!req.user.parentId) return res.json([]);

    const registrations = await prisma.student.findMany({
      where: {
        parentId: req.user.parentId,
        campusId: req.campusId,
        parentSubmitted: true,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        class: { select: { name: true } },
        academicYear: { select: { name: true } },
      },
    });

    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** View one parent-submitted registration */
router.get('/registrations/:id', authorizePermission(PERMISSIONS.REGISTRATION), async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    if (!req.user.parentId) return res.status(404).json({ error: 'Registration not found' });

    const student = await prisma.student.findFirst({
      where: {
        id: req.params.id,
        parentId: req.user.parentId,
        campusId: req.campusId,
        parentSubmitted: true,
      },
      include: {
        ...studentInclude,
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!student) return res.status(404).json({ error: 'Registration not found' });

    const photoUrl = loadPhotoDataUrl(student.documents);
    res.json({ ...student, photoUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** List approved children with student portal account status (parent-managed). */
router.get('/children/accounts', authorizePermission(PERMISSIONS.REGISTRATION), async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    if (!req.user.parentId) return res.json([]);

    const children = await prisma.student.findMany({
      where: {
        parentId: req.user.parentId,
        campusId: req.campusId,
        registrationStatus: 'APPROVED',
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      include: {
        class: { select: { id: true, name: true, grade: true, section: true } },
        user: { select: { id: true, email: true, isActive: true, createdAt: true } },
      },
    });

    res.json(children.map(formatStudentAccount));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Get one child's portal account details */
router.get('/children/:studentId/account', authorizePermission(PERMISSIONS.REGISTRATION), async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    const student = await findParentApprovedChild(req.user.parentId, req.params.studentId, req.campusId);
    if (!student) return res.status(404).json({ error: 'Child not found or not approved yet' });
    res.json(formatStudentAccount(student));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Create student portal login — only after school approval */
router.post('/children/:studentId/account', authorizePermission(PERMISSIONS.REGISTRATION), async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    const { email, password } = req.body;
    const student = await findParentApprovedChild(req.user.parentId, req.params.studentId, req.campusId);
    if (!student) {
      return res.status(404).json({ error: 'Child not found. The school must approve enrollment first.' });
    }
    if (student.user) {
      return res.status(400).json({ error: 'This child already has a student portal account' });
    }

    const login = await createStudentPortalAccount({
      student,
      email,
      password,
      createdBy: 'PARENT',
    });

    res.status(201).json({
      ...formatStudentAccount({ ...student, user: login, studentAccountCreatedBy: 'PARENT' }),
      message: 'Student portal account created. Your child can now sign in with this email and password.',
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/** Reset child portal password */
router.patch('/children/:studentId/account/password', authorizePermission(PERMISSIONS.REGISTRATION), async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    const { password } = req.body;
    const student = await findParentApprovedChild(req.user.parentId, req.params.studentId, req.campusId);
    if (!student?.user) {
      return res.status(404).json({ error: 'No student portal account found for this child' });
    }
    if (student.studentAccountCreatedBy === 'STAFF' && student.user) {
      // Parents can still reset passwords for their children — family manages access
    }
    const login = await resetStudentPortalPassword(student.user.id, password);
    res.json({
      ...formatStudentAccount({ ...student, user: login }),
      message: 'Password updated successfully.',
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/** Enable or disable child portal access */
router.patch('/children/:studentId/account/status', authorizePermission(PERMISSIONS.REGISTRATION), async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    const { isActive } = req.body;
    const student = await findParentApprovedChild(req.user.parentId, req.params.studentId, req.campusId);
    if (!student?.user) {
      return res.status(404).json({ error: 'No student portal account found for this child' });
    }
    const login = await setStudentPortalActive(student.user.id, isActive);
    res.json({
      ...formatStudentAccount({ ...student, user: login }),
      message: isActive ? 'Student portal access enabled.' : 'Student portal access paused.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
