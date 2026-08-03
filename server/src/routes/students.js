import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';
import { studentScopeWhere, resolveClassIdFilter } from '../lib/scope.js';
import { authorizePermission, authorizeRoles, PERMISSIONS } from '../config/permissions.js';
import {
  suggestFamilyAccountEmails,
  provisionFamilyAccounts,
} from '../lib/studentUserAccount.js';
import { getFormOptions } from '../config/registration.js';
import {
  loadPhotoDataUrl,
  generateStudentId,
} from '../lib/studentRegistration.js';
import { createStudentRegistration } from '../lib/createRegistration.js';

const router = Router();
const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

router.use(authorizePermission(PERMISSIONS.STUDENTS));

const studentInclude = {
  class: true,
  academicYear: { select: { id: true, name: true, isActive: true } },
  documents: { orderBy: { createdAt: 'desc' } },
  _count: { select: { feePayments: true, attendance: true } },
};

router.get('/registration/options', async (req, res) => {
  try {
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

router.get('/', async (req, res) => {
  try {
    const { classId, status } = req.query;
    const scope = await studentScopeWhere(req);
    const safeClassId = classId ? await resolveClassIdFilter(req, classId) : undefined;
    const students = await prisma.student.findMany({
      where: {
        ...scope,
        ...(safeClassId ? { classId: safeClassId } : {}),
        ...(status ? { registrationStatus: status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: studentInclude,
    });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/photo', async (req, res) => {
  try {
    const scope = await studentScopeWhere(req);
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
      include: {
        documents: {
          where: { docType: 'PHOTO' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!student?.documents?.[0]) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const doc = student.documents[0];
    const absPath = path.resolve(serverRoot, doc.filePath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Photo file missing' });
    }

    if (doc.mimeType) res.setHeader('Content-Type', doc.mimeType);
    res.sendFile(absPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const scope = await studentScopeWhere(req);
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
      include: {
        ...studentInclude,
        parent: {
          select: {
            id: true,
            phone: true,
            user: {
              select: { id: true, email: true, isActive: true, firstName: true, lastName: true },
            },
          },
        },
        user: {
          select: { id: true, email: true, isActive: true, firstName: true, lastName: true, createdAt: true },
        },
        feePayments: { orderBy: { createdAt: 'desc' } },
        attendance: { orderBy: { date: 'desc' }, take: 30 },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const photoUrl = loadPhotoDataUrl(student.documents);
    if (req.user.role === 'TEACHER') {
      const { feePayments, parent, ...rest } = student;
      return res.json({
        ...rest,
        photoUrl,
        parent: parent ? { id: parent.id, phone: parent.phone } : null,
      });
    }
    res.json({ ...student, photoUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot register students' });
    }

    const { student, documents, parentRecordId } = await createStudentRegistration({
      campusId: req.campusId,
      body: req.body,
      parentSubmitted: false,
      requireDocuments: false,
      studentInclude,
    });

    res.status(201).json({
      ...student,
      documents,
      parentRecord: { id: parentRecordId },
      parentAccountNote: 'A parent record was created from the guardian phone number. After enrollment is approved, create a parent login in User Accounts so the family can access their dashboard.',
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

const canProvisionAccounts = authorizeRoles('SCHOOL_MANAGER', 'SECRETARY');

router.get('/:id/account-suggestions', canProvisionAccounts, async (req, res) => {
  try {
    const scope = await studentScopeWhere(req);
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
      include: {
        parent: {
          include: {
            user: { select: { id: true, email: true, isActive: true, firstName: true, lastName: true } },
          },
        },
        user: { select: { id: true, email: true, isActive: true, firstName: true, lastName: true } },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const suggestions = suggestFamilyAccountEmails(student);
    res.json({
      registrationStatus: student.registrationStatus,
      parent: {
        ...suggestions.parent,
        hasLogin: Boolean(student.parent?.user),
        login: student.parent?.user || null,
        hasRecord: Boolean(student.parent),
      },
      student: {
        ...suggestions.student,
        hasLogin: Boolean(student.user),
        login: student.user || null,
      },
      canProvisionParent: student.registrationStatus === 'APPROVED' && Boolean(student.parent) && !student.parent?.user,
      canProvisionStudent: student.registrationStatus === 'APPROVED' && !student.user,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/:id/provision-accounts', canProvisionAccounts, async (req, res) => {
  try {
    const scope = await studentScopeWhere(req);
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
      include: {
        parent: {
          include: {
            user: { select: { id: true, email: true, isActive: true, firstName: true, lastName: true } },
          },
        },
        user: { select: { id: true, email: true, isActive: true, firstName: true, lastName: true } },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (student.registrationStatus !== 'APPROVED') {
      return res.status(400).json({ error: 'Enrollment must be approved before creating portal accounts' });
    }

    const result = await provisionFamilyAccounts(student, req.body);
    res.status(201).json({
      ...result,
      message: result.messages.join(' '),
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.patch('/:id/registration-status', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot update registration status' });
    }
    const { status } = req.body;
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const scope = await studentScopeWhere(req);
    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { registrationStatus: status },
      include: {
        ...studentInclude,
        parent: {
          select: {
            id: true,
            phone: true,
            user: {
              select: { id: true, email: true, isActive: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    const parentAccountNote = status === 'APPROVED' && student.parent && !student.parent.user
      ? 'Enrollment approved. Use Family portal accounts below to create the parent login in one step.'
      : null;

    const studentAccountNote = status === 'APPROVED' && !student.user
      ? (student.parentSubmitted
        ? 'Enrollment approved. The parent can create the student login from Child accounts — or use Family portal accounts below to set up both logins now.'
        : 'Enrollment approved. Use Family portal accounts below to create parent and student logins linked to this family.')
      : null;

    res.json({ ...student, parentAccountNote, studentAccountNote });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot create student records' });
    }
    const { dateOfBirth, registrationDate, documents: _, ...data } = req.body;
    const studentId = data.studentId || await generateStudentId(req.campusId, req.academicYearId);
    const student = await prisma.student.create({
      data: {
        ...data,
        studentId,
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        registrationDate: registrationDate ? new Date(registrationDate) : new Date(),
      },
      include: studentInclude,
    });
    res.status(201).json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit student records' });
    }
    const scope = await studentScopeWhere(req);
    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    const { dateOfBirth, registrationDate, campusId: _, academicYearId: __, documents: ___, ...data } = req.body;
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: {
        ...data,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        registrationDate: registrationDate ? new Date(registrationDate) : undefined,
      },
      include: studentInclude,
    });
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'SCHOOL_MANAGER' && req.user.role !== 'SECRETARY') {
      return res.status(403).json({ error: 'You cannot delete student records' });
    }
    const scope = await studentScopeWhere(req);
    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Student not found' });
    await prisma.student.delete({ where: { id: req.params.id } });
    res.json({ message: 'Student deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
