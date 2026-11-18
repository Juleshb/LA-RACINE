import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { allows } from '../lib/accessControl.js';
import { PERMISSIONS, isManagerRole } from '../config/permissions.js';
import { classScopeWhere, studentScopeWhere } from '../lib/scope.js';

const router = Router();

function contains(term) {
  return { contains: term, mode: 'insensitive' };
}

function studentName(student) {
  return [student.firstName, student.postName, student.lastName].filter(Boolean).join(' ');
}

router.get('/', async (req, res) => {
  try {
    const term = String(req.query.q || '').trim().slice(0, 80);
    if (term.length < 2) return res.json({ results: [] });

    const role = req.user.role;
    const can = (permission) => allows(role, req.campusId, permission, 'VIEW');
    const [
      studentsOk,
      usersOk,
      teachersOk,
      classesOk,
      activitiesOk,
      transportOk,
      libraryOk,
      inventoryOk,
      feesOk,
    ] = await Promise.all([
      can(PERMISSIONS.STUDENTS),
      can(PERMISSIONS.USERS),
      can(PERMISSIONS.TEACHERS),
      can(PERMISSIONS.CLASSES),
      can(PERMISSIONS.EXTRACURRICULAR),
      can(PERMISSIONS.TRANSPORT),
      can(PERMISSIONS.LIBRARY),
      can(PERMISSIONS.INVENTORY),
      can(PERMISSIONS.FEES),
    ]);

    const text = contains(term);
    const results = [];
    const seesOwnChildren = role === 'PARENT';
    let studentScope = null;
    if (seesOwnChildren) {
      studentScope = req.user.parentId
        ? await studentScopeWhere(req)
        : { id: { in: [] } };
    } else if (studentsOk || feesOk) {
      studentScope = await studentScopeWhere(req);
    }

    if (studentScope && (studentsOk || seesOwnChildren)) {
      const students = await prisma.student.findMany({
        where: {
          AND: [
            studentScope,
            {
              OR: [
                { firstName: text },
                { lastName: text },
                { postName: text },
                { studentId: text },
                { email: text },
                { phone: text },
                { parentName: text },
                { parentPhone: text },
              ],
            },
          ],
        },
        take: 6,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          postName: true,
          studentId: true,
          email: true,
          class: { select: { name: true } },
        },
      });
      students.forEach((student) => {
        results.push({
          type: 'student',
          id: student.id,
          title: studentName(student),
          detail: [student.studentId, student.class?.name, student.email].filter(Boolean).join(' · '),
        });
      });
    }

    if (usersOk) {
      const userLimit = isManagerRole(role)
        ? { role: { not: 'STUDENT' } }
        : {
          role: { not: 'STUDENT' },
          OR: [
            { campusId: req.campusId },
            { parent: { students: { some: { campusId: req.campusId, academicYearId: req.academicYearId } } } },
          ],
        };
      const users = await prisma.user.findMany({
        where: {
          AND: [
            userLimit,
            { isActive: true },
            {
              OR: [
                { firstName: text },
                { lastName: text },
                { email: text },
                { phone: text },
                { identityNumber: text },
              ],
            },
          ],
        },
        take: 6,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true },
      });
      users.forEach((user) => {
        results.push({
          type: user.role === 'PARENT' ? 'parent' : 'staff',
          id: user.id,
          role: user.role,
          title: `${user.firstName} ${user.lastName}`.trim(),
          detail: [user.email, user.phone].filter(Boolean).join(' · '),
        });
      });
    }

    if (teachersOk) {
      const teachers = await prisma.teacher.findMany({
        where: {
          campusId: req.campusId,
          AND: [
            { OR: [{ academicYearId: req.academicYearId }, { academicYearId: null }] },
            {
              OR: [
                { name: text },
                { email: text },
                { phone: text },
                { identityNumber: text },
                { subject: text },
              ],
            },
          ],
        },
        take: 5,
        select: { id: true, name: true, email: true, subject: true },
      });
      teachers.forEach((teacher) => {
        results.push({
          type: 'teacher',
          id: teacher.id,
          title: teacher.name,
          detail: [teacher.subject, teacher.email].filter(Boolean).join(' · '),
        });
      });
    }

    if (classesOk) {
      const classes = await prisma.class.findMany({
        where: {
          AND: [
            await classScopeWhere(req),
            { OR: [{ name: text }, { grade: text }, { section: text }] },
          ],
        },
        take: 5,
        select: { id: true, name: true, grade: true, section: true },
      });
      classes.forEach((item) => {
        results.push({
          type: 'class',
          id: item.id,
          title: item.name,
          detail: [item.grade, item.section].filter(Boolean).join(' · '),
        });
      });
    }

    if (activitiesOk) {
      const activities = await prisma.extracurricularActivity.findMany({
        where: {
          campusId: req.campusId,
          academicYearId: req.academicYearId,
          OR: [{ name: text }, { category: text }, { instructor: text }],
        },
        take: 5,
        select: { id: true, name: true, category: true },
      });
      activities.forEach((item) => {
        results.push({
          type: 'activity',
          id: item.id,
          title: item.name,
          detail: item.category || '',
        });
      });
    }

    if (transportOk) {
      const routes = await prisma.transportRoute.findMany({
        where: {
          campusId: req.campusId,
          academicYearId: req.academicYearId,
          OR: [{ name: text }, { code: text }],
        },
        take: 5,
        select: { id: true, name: true, code: true },
      });
      routes.forEach((item) => {
        results.push({
          type: 'transport',
          id: item.id,
          title: item.name,
          detail: item.code,
        });
      });
    }

    if (libraryOk) {
      const books = await prisma.book.findMany({
        where: {
          campusId: req.campusId,
          OR: [{ title: text }, { author: text }, { isbn: text }],
        },
        take: 5,
        select: { id: true, title: true, author: true, isbn: true },
      });
      books.forEach((book) => {
        results.push({
          type: 'book',
          id: book.id,
          title: book.title,
          detail: [book.author, book.isbn].filter(Boolean).join(' · '),
        });
      });
    }

    if (inventoryOk && role !== 'TEACHER') {
      const articles = await prisma.stockArticle.findMany({
        where: {
          campusId: req.campusId,
          OR: [{ name: text }, { code: text }],
        },
        take: 5,
        select: { id: true, name: true, code: true },
      });
      articles.forEach((article) => {
        results.push({
          type: 'article',
          id: article.id,
          title: article.name,
          detail: article.code,
        });
      });
    }

    if (feesOk && studentScope) {
      const receipts = await prisma.feePayment.findMany({
        where: {
          student: studentScope,
          OR: [{ receiptNumber: text }, { notes: text }],
        },
        take: 5,
        orderBy: { paidDate: 'desc' },
        select: {
          id: true,
          receiptNumber: true,
          amount: true,
          currency: true,
          status: true,
          student: { select: { firstName: true, lastName: true, studentId: true } },
        },
      });
      receipts.forEach((fee) => {
        results.push({
          type: 'receipt',
          id: fee.id,
          title: fee.receiptNumber,
          detail: `${studentName(fee.student)} · ${fee.status} · ${fee.amount} ${fee.currency || 'RWF'}`,
        });
      });
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Search is unavailable right now.' });
  }
});

export default router;
