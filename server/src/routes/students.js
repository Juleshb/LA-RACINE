import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';
import { studentScopeWhere, resolveClassIdFilter } from '../lib/scope.js';
import { authorizePermission, authorizeRoles, PERMISSIONS, isManagerRole } from '../config/permissions.js';
import {
  suggestFamilyAccountEmails,
  provisionFamilyAccounts,
} from '../lib/studentUserAccount.js';
import { getFormOptions } from '../config/registration.js';
import {
  loadPhotoDataUrl,
  generateStudentId,
  replaceStudentDocument,
  deleteStudentDocument,
} from '../lib/studentRegistration.js';
import { createStudentRegistration } from '../lib/createRegistration.js';
import { studentDuplicateKey, buildDuplicateIndex } from '../lib/studentDuplicate.js';
import { OTP_PURPOSE, createAndSendOtp, verifyOtpChallenge } from '../lib/authOtp.js';
import { isOtpEnabled } from '../lib/appSettings.js';

const router = Router();
const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

router.use(authorizePermission(PERMISSIONS.STUDENTS));

/** Resolve target campus for an Excel import row (Inscrit à A/B). */
async function resolveImportCampusId(req, rowCampusId) {
  const requested = String(rowCampusId || '').trim() || req.campusId;
  if (!requested) {
    const err = new Error('Campus is required for each imported student');
    err.status = 400;
    throw err;
  }
  if (requested === req.campusId) return requested;

  if (!isManagerRole(req.user.role)) {
    const err = new Error('You can only import students into your assigned campus');
    err.status = 403;
    throw err;
  }

  const campus = await prisma.campus.findUnique({ where: { id: requested } });
  if (!campus || !campus.isActive) {
    const err = new Error('Target campus not found or inactive');
    err.status = 400;
    throw err;
  }
  return campus.id;
}

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

router.get('/:id/documents/:docId', async (req, res) => {
  try {
    const scope = await studentScopeWhere(req);
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
      select: { id: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const doc = await prisma.studentDocument.findFirst({
      where: { id: req.params.docId, studentId: student.id },
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const absPath = path.resolve(serverRoot, doc.filePath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Document file missing' });
    }

    const disposition = req.query.download === '1' ? 'attachment' : 'inline';
    const safeName = String(doc.fileName || 'document').replace(/[^\w.\- ()[\]]+/g, '_');
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
    if (doc.mimeType) res.setHeader('Content-Type', doc.mimeType);
    else if (/\.pdf$/i.test(doc.fileName || '')) res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(absPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Upload or replace a student attachment (old file deleted when replaced). */
router.post('/:id/documents', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot replace student documents' });
    }
    const scope = await studentScopeWhere(req);
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
      select: { id: true, studentId: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { docType, fileName, contentBase64, mimeType, replaceDocId } = req.body || {};
    const allowed = ['BIRTH_CERTIFICATE', 'PHOTO', 'REPORT_CARD', 'MEDICAL_CERTIFICATE', 'OTHER'];
    if (!allowed.includes(docType)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    const record = await replaceStudentDocument({
      studentUuid: student.id,
      studentCode: student.studentId,
      docType,
      replaceDocId: replaceDocId || null,
      fileName,
      contentBase64,
      mimeType: mimeType || null,
    });

    const fresh = await prisma.student.findFirst({
      where: { id: student.id },
      include: studentInclude,
    });
    res.status(201).json({
      document: record,
      student: { ...fresh, photoUrl: loadPhotoDataUrl(fresh.documents) },
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete('/:id/documents/:docId', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete student documents' });
    }
    const scope = await studentScopeWhere(req);
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
      select: { id: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const doc = await prisma.studentDocument.findFirst({
      where: { id: req.params.docId, studentId: student.id },
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    await deleteStudentDocument(doc);

    const fresh = await prisma.student.findFirst({
      where: { id: student.id },
      include: studentInclude,
    });
    res.json({
      message: 'Document deleted',
      student: { ...fresh, photoUrl: loadPhotoDataUrl(fresh.documents) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/transfer-destinations', async (req, res) => {
  try {
    if (!isManagerRole(req.user.role) && req.user.role !== 'SECRETARY') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const campuses = await prisma.campus.findMany({
      where: { isActive: true, NOT: { id: req.campusId } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, city: true },
    });
    res.json(campuses);
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

router.post('/:id/transfer', async (req, res) => {
  try {
    if (!isManagerRole(req.user.role) && req.user.role !== 'SECRETARY') {
      return res.status(403).json({ error: 'Only a school manager, school admin, or secretary can transfer students' });
    }

    const destCampusId = String(req.body?.campusId || '').trim();
    const destClassId = req.body?.classId ? String(req.body.classId).trim() : null;
    if (!destCampusId) {
      return res.status(400).json({ error: 'Select the destination campus' });
    }
    if (destCampusId === req.campusId) {
      return res.status(400).json({ error: 'Choose a different campus' });
    }

    const scope = await studentScopeWhere(req);
    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    const destCampus = await prisma.campus.findFirst({
      where: { id: destCampusId, isActive: true },
      select: { id: true, name: true },
    });
    if (!destCampus) return res.status(404).json({ error: 'Destination campus not found' });

    const destYear = await prisma.academicYear.findFirst({
      where: { campusId: destCampusId, isActive: true },
      select: { id: true, name: true },
    });
    if (!destYear) {
      return res.status(400).json({ error: `No active academic year on ${destCampus.name}. Open a year there first.` });
    }

    const clash = await prisma.student.findFirst({
      where: {
        campusId: destCampusId,
        academicYearId: destYear.id,
        studentId: existing.studentId,
        NOT: { id: existing.id },
      },
      select: { id: true },
    });
    if (clash) {
      return res.status(400).json({
        error: `A student with ID ${existing.studentId} already exists on ${destCampus.name} for ${destYear.name}`,
      });
    }

    let classId = null;
    if (destClassId) {
      const destClass = await prisma.class.findFirst({
        where: { id: destClassId, campusId: destCampusId, academicYearId: destYear.id },
        select: { id: true },
      });
      if (!destClass) {
        return res.status(400).json({ error: 'Selected class does not belong to the destination campus year' });
      }
      classId = destClass.id;
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentTransport.deleteMany({ where: { studentId: existing.id } }).catch(() => {});
      await tx.student.update({
        where: { id: existing.id },
        data: {
          campusId: destCampusId,
          academicYearId: destYear.id,
          classId,
          busStop: null,
        },
      });
      await tx.user.updateMany({
        where: { studentId: existing.id },
        data: { campusId: destCampusId },
      });
    });

    const student = await prisma.student.findUnique({
      where: { id: existing.id },
      include: studentInclude,
    });

    res.json({
      ...student,
      photoUrl: loadPhotoDataUrl(student.documents),
      message: `Transferred to ${destCampus.name} (${destYear.name})`,
      campusId: destCampusId,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'This student ID is already used on the destination campus' });
    }
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
      body: {
        ...req.body,
        ...(req.user.role === 'ACCOUNTANT' && !req.body.registrationStatus
          ? { registrationStatus: 'APPROVED' }
          : {}),
      },
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

/** Check which import rows already exist (preview before confirm). */
router.post('/check-duplicates', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot check student imports' });
    }

    const rows = Array.isArray(req.body?.students) ? req.body.students : [];
    if (rows.length > 300) {
      return res.status(400).json({ error: 'Maximum 300 students per check' });
    }

    const campusIds = [...new Set(
      rows.map((row) => String(row?.campusId || req.campusId || '').trim()).filter(Boolean),
    )];
    if (!campusIds.length) campusIds.push(req.campusId);

    for (const campusId of campusIds) {
      if (campusId === req.campusId) continue;
      if (!isManagerRole(req.user.role)) {
        return res.status(403).json({ error: 'You can only import students into your assigned campus' });
      }
      const campus = await prisma.campus.findUnique({ where: { id: campusId } });
      if (!campus || !campus.isActive) {
        return res.status(400).json({ error: 'One or more target campuses are invalid' });
      }
    }

    const existing = await prisma.student.findMany({
      where: { campusId: { in: campusIds } },
      select: {
        id: true,
        studentId: true,
        lastName: true,
        postName: true,
        firstName: true,
        dateOfBirth: true,
        academicYearId: true,
        campusId: true,
        registrationStatus: true,
        academicYear: { select: { name: true } },
      },
    });
    // Index per campus so A and B do not collide
    const existingByCampus = new Map();
    for (const campusId of campusIds) {
      existingByCampus.set(
        campusId,
        buildDuplicateIndex(existing.filter((s) => s.campusId === campusId)),
      );
    }

    const seenInFile = new Map();
    const duplicates = [];

    rows.forEach((row, i) => {
      const excelRow = row.__row || i + 2;
      const key = studentDuplicateKey(row);
      if (!key || key === '|||') return;

      const campusId = String(row.campusId || req.campusId).trim();
      const name = [row.lastName, row.postName, row.firstName].filter(Boolean).join(' ');
      const fileKey = `${campusId}::${key}`;

      if (seenInFile.has(fileKey)) {
        duplicates.push({
          row: excelRow,
          reason: 'file',
          message: `Duplicate in this file (same as row ${seenInFile.get(fileKey)})`,
          matchRow: seenInFile.get(fileKey),
          name,
        });
        return;
      }
      seenInFile.set(fileKey, excelRow);

      const existingIndex = existingByCampus.get(campusId) || new Map();
      const matches = existingIndex.get(key) || [];
      if (matches.length) {
        const match = matches[0];
        duplicates.push({
          row: excelRow,
          reason: 'database',
          message: `Already registered as ${match.studentId}`
            + (match.academicYear?.name ? ` (${match.academicYear.name})` : ''),
          existingId: match.id,
          existingStudentId: match.studentId,
          existingStatus: match.registrationStatus,
          name,
        });
      }
    });

    res.json({
      total: rows.length,
      duplicateCount: duplicates.length,
      duplicates,
      matchRule: 'Same last name + post name + first name + date of birth (same campus)',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Bulk register students from parsed Excel rows (admin / secretary). */
router.post('/register-bulk', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot import students' });
    }

    const rows = Array.isArray(req.body?.students) ? req.body.students : [];
    const defaultStatus = ['PENDING', 'APPROVED', 'REJECTED'].includes(req.body?.defaultStatus)
      ? req.body.defaultStatus
      : 'APPROVED';
    const skipDuplicates = req.body?.skipDuplicates !== false;

    if (!rows.length) {
      return res.status(400).json({ error: 'No students to import' });
    }
    if (rows.length > 300) {
      return res.status(400).json({ error: 'Maximum 300 students per import' });
    }

    const campusIds = [...new Set(
      rows.map((row) => String(row?.campusId || req.campusId || '').trim()).filter(Boolean),
    )];
    if (!campusIds.length) campusIds.push(req.campusId);

    for (const campusId of campusIds) {
      await resolveImportCampusId(req, campusId);
    }

    const existing = skipDuplicates
      ? await prisma.student.findMany({
        where: { campusId: { in: campusIds } },
        select: {
          id: true,
          studentId: true,
          lastName: true,
          postName: true,
          firstName: true,
          dateOfBirth: true,
          campusId: true,
          academicYear: { select: { name: true } },
        },
      })
      : [];
    const existingByCampus = new Map();
    for (const campusId of campusIds) {
      existingByCampus.set(
        campusId,
        buildDuplicateIndex(existing.filter((s) => s.campusId === campusId)),
      );
    }
    const seenInFile = new Map();

    const results = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const excelRow = row.__row || i + 2;
      const name = [row.lastName, row.postName, row.firstName].filter(Boolean).join(' ');

      try {
        const campusId = await resolveImportCampusId(req, row.campusId);
        const existingIndex = existingByCampus.get(campusId) || buildDuplicateIndex([]);
        if (!existingByCampus.has(campusId)) existingByCampus.set(campusId, existingIndex);

        if (skipDuplicates) {
          const key = studentDuplicateKey(row);
          if (key && key !== '|||') {
            const fileKey = `${campusId}::${key}`;
            if (seenInFile.has(fileKey)) {
              results.push({
                row: excelRow,
                ok: false,
                skipped: true,
                reason: 'file_duplicate',
                error: `Skipped duplicate in file (same as row ${seenInFile.get(fileKey)})`,
                name,
              });
              continue;
            }
            seenInFile.set(fileKey, excelRow);

            const matches = existingIndex.get(key) || [];
            if (matches.length) {
              const match = matches[0];
              results.push({
                row: excelRow,
                ok: false,
                skipped: true,
                reason: 'existing_duplicate',
                error: `Skipped — already registered as ${match.studentId}`
                  + (match.academicYear?.name ? ` (${match.academicYear.name})` : ''),
                existingId: match.id,
                existingStudentId: match.studentId,
                name,
              });
              continue;
            }
          }
        }

        const { student } = await createStudentRegistration({
          campusId,
          body: {
            ...row,
            registrationStatus: row.registrationStatus || defaultStatus,
            documents: [],
          },
          parentSubmitted: false,
          requireDocuments: false,
          studentInclude,
        });

        // Prevent later rows in same batch matching this newly created student
        if (skipDuplicates) {
          const key = studentDuplicateKey(student);
          if (key && key !== '|||') {
            if (!existingIndex.has(key)) existingIndex.set(key, []);
            existingIndex.get(key).push(student);
          }
        }

        results.push({
          row: excelRow,
          ok: true,
          id: student.id,
          studentId: student.studentId,
          campusId,
          name: [student.lastName, student.postName, student.firstName].filter(Boolean).join(' '),
        });
      } catch (error) {
        results.push({
          row: excelRow,
          ok: false,
          error: error.message || 'Import failed',
          name,
        });
      }
    }

    const created = results.filter((r) => r.ok).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.ok && !r.skipped).length;
    res.status(created > 0 || skipped > 0 ? 201 : 400).json({
      created,
      skipped,
      failed,
      total: results.length,
      results,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

const canProvisionAccounts = authorizeRoles('SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY');

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
    if (!['PENDING', 'AWAITING_CONFIRMATION', 'APPROVED', 'REJECTED'].includes(status)) {
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

    const body = req.body || {};
    const optionalStr = (key) => (
      body[key] !== undefined
        ? (body[key] === '' || body[key] === null ? null : String(body[key]))
        : undefined
    );
    /** Required String columns — never send null to Prisma */
    const requiredStr = (key) => {
      if (body[key] === undefined) return undefined;
      const v = String(body[key] ?? '').trim();
      return v;
    };
    const bool = (key) => {
      if (body[key] === undefined) return undefined;
      if (body[key] === null || body[key] === '') return null;
      return Boolean(body[key]);
    };

    const data = {};
    const optionalStringFields = [
      'postName', 'nationality', 'email', 'phone', 'address',
      'parentName', 'parentPhone',
      'fatherName', 'fatherProfession', 'fatherPhone', 'fatherEmail',
      'motherName', 'motherProfession', 'motherPhone', 'motherEmail',
      'province', 'district', 'sector', 'cell', 'village',
      'emergencyContactName', 'emergencyContactPhone',
      'previousSchoolName', 'previousSchoolYear', 'previousClass',
      'registrationYear', 'registrationClass', 'generalAllergies', 'additionalInfo',
    ];
    for (const key of optionalStringFields) {
      const v = optionalStr(key);
      if (v !== undefined) data[key] = v;
    }

    if (body.lastName !== undefined) {
      const lastName = requiredStr('lastName');
      if (!lastName) return res.status(400).json({ error: 'Last name is required' });
      data.lastName = lastName;
    }
    if (body.firstName !== undefined) {
      // Non-nullable in schema; empty string is allowed when prénom is blank
      data.firstName = requiredStr('firstName') || existing.firstName || '';
    }

    if (body.gender !== undefined) {
      if (!['MALE', 'FEMALE'].includes(body.gender)) {
        return res.status(400).json({ error: 'Invalid gender' });
      }
      data.gender = body.gender;
    }
    if (body.treatment !== undefined) data.treatment = body.treatment || null;
    if (body.transportMode !== undefined) data.transportMode = body.transportMode || null;
    if (body.busStop !== undefined) data.busStop = body.busStop || null;
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod || null;
    if (body.registrationStatus !== undefined) data.registrationStatus = body.registrationStatus;

    for (const key of [
      'surgicalHistory', 'heartMurmur', 'medicinalAllergies', 'tuberculosis',
      'foodIntolerance', 'diabetes', 'asthma', 'visualDisturbances',
    ]) {
      const v = bool(key);
      if (v !== undefined) data[key] = v;
    }

    if (body.dateOfBirth !== undefined) {
      data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    }
    if (body.registrationDate !== undefined) {
      data.registrationDate = body.registrationDate ? new Date(body.registrationDate) : null;
    }

    if (body.classId !== undefined) {
      const nextClassId = body.classId || null;
      if (nextClassId) {
        const klass = await prisma.class.findFirst({
          where: { id: nextClassId, campusId: existing.campusId },
        });
        if (!klass) return res.status(400).json({ error: 'Invalid class for this campus' });
        data.classId = klass.id;
        if (body.registrationClass === undefined) {
          data.registrationClass = klass.name;
        }
      } else {
        data.classId = null;
      }
    }

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data,
      include: studentInclude,
    });
    res.json({ ...student, photoUrl: loadPhotoDataUrl(student.documents) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/request-delete-otp', async (req, res) => {
  try {
    if (!['SCHOOL_MANAGER','SCHOOL_ADMIN','SECRETARY'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete student records' });
    }
    const scope = await studentScopeWhere(req);
    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
      select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    const studentLabel = `${existing.lastName || ''} ${existing.firstName || ''}`.trim()
      || existing.studentId
      || existing.id;

    if (!(await isOtpEnabled())) {
      return res.json({
        requiresOtp: false,
        studentName: studentLabel,
      });
    }

    const actor = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, firstName: true },
    });
    if (!actor?.email) {
      return res.status(400).json({ error: 'Your account has no email for OTP verification' });
    }

    const otp = await createAndSendOtp({
      userId: actor.id,
      email: actor.email,
      purpose: OTP_PURPOSE.DELETE_STUDENT,
      subject: 'Confirm student deletion — École La RACINE',
      introHtml: `Hello ${actor.firstName || ''}, enter this code to permanently delete student <strong>${studentLabel}</strong>:`,
      meta: { studentId: existing.id },
    });

    res.json({
      requiresOtp: true,
      challengeId: otp.challengeId,
      emailMasked: otp.emailMasked,
      expiresAt: otp.expiresAt,
      studentName: studentLabel,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!['SCHOOL_MANAGER','SCHOOL_ADMIN','SECRETARY'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete student records' });
    }
    const otpOn = await isOtpEnabled();
    const { challengeId, code } = req.body || {};
    if (otpOn) {
      if (!challengeId || !code) {
        return res.status(400).json({ error: 'OTP verification is required to delete a student' });
      }
      await verifyOtpChallenge({
        challengeId,
        code,
        purpose: OTP_PURPOSE.DELETE_STUDENT,
        userId: req.user.id,
        metaMatch: { studentId: req.params.id },
      });
    }

    const scope = await studentScopeWhere(req);
    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Student not found' });
    await prisma.student.delete({ where: { id: req.params.id } });
    res.json({ message: 'Student deleted' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
