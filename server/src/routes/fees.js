import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { studentScopeWhere } from '../lib/scope.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { generateFeeReceiptNumber } from '../lib/deliberation.js';
import { isMailConfigured, sendMail } from '../lib/mailer.js';
import feeFinanceRoutes from './feeFinance.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.FEES));
router.use(feeFinanceRoutes);

function campusStudentFilter(req) {
  const scope = studentScopeWhere(req);
  return scope.then((where) => ({ student: where }));
}

router.get('/', async (req, res) => {
  try {
    const filter = await campusStudentFilter(req);
    const fees = await prisma.feePayment.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      include: { student: { include: { class: true } } },
    });
    res.json(fees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const filter = await campusStudentFilter(req);
    const [total, paid, pending, overdue] = await Promise.all([
      prisma.feePayment.count({ where: filter }),
      prisma.feePayment.count({ where: { ...filter, status: 'PAID' } }),
      prisma.feePayment.count({ where: { ...filter, status: 'PENDING' } }),
      prisma.feePayment.count({ where: { ...filter, status: 'OVERDUE' } }),
    ]);

    const collected = await prisma.feePayment.aggregate({
      where: { ...filter, status: 'PAID' },
      _sum: { amount: true },
    });

    res.json({
      total,
      paid,
      pending,
      overdue,
      totalCollected: collected._sum.amount || 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Confirmation / re-enrollment fee queue for returning students. */
router.get('/confirmation-queue', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const filter = await campusStudentFilter(req);
    const fees = await prisma.feePayment.findMany({
      where: {
        ...filter,
        feeType: 'CONFIRMATION',
        status: { in: ['PENDING', 'OVERDUE'] },
        student: {
          ...(filter.student || {}),
          registrationStatus: 'AWAITING_CONFIRMATION',
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        student: {
          include: {
            class: { select: { id: true, name: true, grade: true, section: true } },
            parent: {
              select: {
                id: true,
                phone: true,
                user: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
        },
      },
    });
    res.json(fees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send fee payment reminders to parents of students with outstanding fees.
 * Creates a Messages thread per parent (and emails when mail is configured).
 */
router.post('/reminders', async (req, res) => {
  try {
    if (!['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY', 'ACCOUNTANT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only finance staff can send fee reminders' });
    }

    const {
      feeIds,
      statuses = ['PENDING', 'OVERDUE'],
      feeType,
      title,
      body,
      sendEmail = true,
    } = req.body || {};

    const filter = await campusStudentFilter(req);
    const where = {
      ...filter,
      status: { in: Array.isArray(statuses) && statuses.length ? statuses : ['PENDING', 'OVERDUE'] },
      ...(feeType ? { feeType } : {}),
      ...(Array.isArray(feeIds) && feeIds.length ? { id: { in: feeIds } } : {}),
    };

    const fees = await prisma.feePayment.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            postName: true,
            studentId: true,
            parentId: true,
            class: { select: { name: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    if (!fees.length) {
      return res.status(400).json({ error: 'No outstanding fees match the selection' });
    }

    const byParent = new Map();
    let skippedNoParent = 0;
    for (const fee of fees) {
      const parentId = fee.student?.parentId;
      if (!parentId) {
        skippedNoParent += 1;
        continue;
      }
      if (!byParent.has(parentId)) {
        byParent.set(parentId, []);
      }
      byParent.get(parentId).push(fee);
    }

    if (!byParent.size) {
      return res.status(400).json({
        error: 'No linked parent accounts found for the selected outstanding fees',
        skippedNoParent,
      });
    }

    const formatAmount = (amount) => new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      maximumFractionDigits: 0,
    }).format(amount || 0);

    const defaultTitle = title?.trim() || 'Fee payment reminder';
    let threadsCreated = 0;
    let emailsSent = 0;
    let emailFailed = 0;

    for (const [parentId, parentFees] of byParent.entries()) {
      const lines = parentFees.map((fee) => {
        const name = `${fee.student.firstName} ${fee.student.lastName}`.trim();
        const cls = fee.student.class?.name ? ` (${fee.student.class.name})` : '';
        const due = fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : '—';
        return `• ${name}${cls}: ${fee.feeType} — ${formatAmount(fee.amount)} (due ${due}, ${fee.status})`;
      });

      const messageBody = (body?.trim() || [
        'Dear parent,',
        '',
        'This is a reminder that the following school fee(s) are still outstanding:',
        '',
        ...lines,
        '',
        'Please settle payment at the school accounts office or via the fee payment accounts listed in the school profile.',
        '',
        'Thank you,',
        'Accounts office — École La RACINE',
      ].join('\n'));

      const primaryStudentId = parentFees[0]?.student?.id || null;

      await prisma.communicationThread.create({
        data: {
          campusId: req.campusId,
          academicYearId: req.academicYearId,
          subject: defaultTitle,
          category: 'GENERAL',
          studentId: primaryStudentId,
          parentId,
          initiatedBy: 'SCHOOL',
          createdById: req.user.id,
          messages: {
            create: {
              senderId: req.user.id,
              body: messageBody,
            },
          },
        },
      });
      threadsCreated += 1;

      if (sendEmail && isMailConfigured()) {
        try {
          const parentUsers = await prisma.user.findMany({
            where: { parentId, role: 'PARENT', isActive: true },
            select: { email: true },
          });
          const emails = [...new Set(parentUsers.map((u) => u.email).filter(Boolean))];
          for (const email of emails) {
            await sendMail({
              to: email,
              subject: defaultTitle,
              text: messageBody,
              html: `<div style="font-family:sans-serif;line-height:1.5;color:#0f172a"><p>${messageBody.replace(/\n/g, '<br/>')}</p></div>`,
            });
            emailsSent += 1;
          }
        } catch {
          emailFailed += 1;
        }
      }
    }

    res.json({
      outstandingFees: fees.length,
      parentsNotified: threadsCreated,
      skippedNoParent,
      emailsSent,
      emailFailed,
      threadsCreated,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const IMPORT_FEE_TYPES = new Set([
  'TUITION', 'REGISTRATION', 'CONFIRMATION', 'EXAM', 'TRANSPORT',
  'UNIFORM', 'EXTRACURRICULAR', 'CARRY_OVER', 'OTHER',
]);
const IMPORT_TERMS = new Set(['ANNUAL', 'TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3', 'PRIOR_YEAR']);
const IMPORT_STATUSES = new Set(['PENDING', 'PAID', 'OVERDUE', 'WAIVED']);
const FINANCE_IMPORT_ROLES = ['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY', 'ACCOUNTANT'];

function personKey(parts) {
  return parts
    .map((part) => String(part || '').trim().toLowerCase())
    .join('|');
}

/** Create fee records from a parsed Excel sheet. Finance staff only. */
router.post('/import', async (req, res) => {
  try {
    if (!FINANCE_IMPORT_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Only finance staff can import fee records' });
    }

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'No fee rows to import' });
    if (rows.length > 4000) return res.status(400).json({ error: 'Maximum 4000 fee rows per import' });

    const scope = await studentScopeWhere(req);
    const students = await prisma.student.findMany({
      where: scope,
      select: {
        id: true,
        studentId: true,
        lastName: true,
        postName: true,
        firstName: true,
        registrationStatus: true,
      },
    });

    const byCode = new Map();
    const byName = new Map();
    const byFullName = new Map();
    for (const student of students) {
      const code = String(student.studentId || '').trim().toLowerCase();
      if (code) byCode.set(code, student);
      const key = personKey([student.lastName, student.postName, student.firstName]);
      if (key !== '||') {
        const list = byName.get(key) || [];
        list.push(student);
        byName.set(key, list);
      }
      const full = [student.lastName, student.postName, student.firstName]
        .map((part) => String(part || '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
      if (full) {
        const list = byFullName.get(full) || [];
        list.push(student);
        byFullName.set(full, list);
      }
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const excelRow = row.sheet
        ? `${row.sheet} row ${Number(row.row) || i + 2}`
        : (Number(row.row) || i + 2);
      const feeType = String(row.feeType || '').trim().toUpperCase();
      const amount = Number(row.amount);
      const status = IMPORT_STATUSES.has(String(row.status || '').toUpperCase())
        ? String(row.status).toUpperCase()
        : 'PENDING';
      const termRaw = row.term ? String(row.term).trim().toUpperCase() : '';
      const term = IMPORT_TERMS.has(termRaw) ? termRaw : null;

      if (!IMPORT_FEE_TYPES.has(feeType)) {
        errors.push({ row: excelRow, error: 'Fee type is missing or not recognized' });
        continue;
      }
      if (!Number.isFinite(amount) || amount < 0) {
        errors.push({ row: excelRow, error: 'Amount must be zero or more' });
        continue;
      }
      const parsedDue = row.dueDate ? new Date(row.dueDate) : new Date();
      if (Number.isNaN(parsedDue.getTime())) {
        errors.push({ row: excelRow, error: 'Due date is missing or invalid' });
        continue;
      }

      const code = String(row.studentCode || '').trim().toLowerCase();
      let student = code ? byCode.get(code) : null;
      if (!student) {
        const matches = byName.get(personKey([row.lastName, row.postName, row.firstName])) || [];
        if (matches.length === 1) [student] = matches;
        else if (matches.length > 1) {
          errors.push({ row: excelRow, error: 'More than one student matches this name. Use the student ID.' });
          continue;
        }
      }
      if (!student && row.fullName) {
        const full = String(row.fullName).trim().toLowerCase().replace(/\s+/g, ' ');
        const matches = byFullName.get(full) || [];
        if (matches.length === 1) [student] = matches;
        else if (matches.length > 1) {
          errors.push({ row: excelRow, error: 'More than one student matches this name. Use the student ID.' });
          continue;
        }
      }
      if (!student) {
        errors.push({ row: excelRow, error: 'Student not found in this campus and year' });
        continue;
      }

      const finalStatus = amount === 0 ? 'WAIVED' : status;
      const installmentIndex = row.installmentIndex ? Number(row.installmentIndex) : null;
      const installmentTotal = row.installmentTotal ? Number(row.installmentTotal) : null;

      try {
        let fee = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            fee = await prisma.feePayment.create({
              data: {
                receiptNumber: generateFeeReceiptNumber(),
                studentId: student.id,
                feeType,
                term,
                amount,
                originalAmount: amount,
                dueDate: parsedDue,
                paidDate: finalStatus === 'PAID' ? new Date() : null,
                status: finalStatus,
                notes: row.notes ? String(row.notes).trim().slice(0, 500) : null,
                installmentIndex: Number.isFinite(installmentIndex) && installmentIndex > 0
                  ? installmentIndex
                  : null,
                installmentTotal: Number.isFinite(installmentTotal) && installmentTotal > 0
                  ? installmentTotal
                  : null,
              },
            });
            break;
          } catch (err) {
            if (err.code !== 'P2002' || attempt === 4) throw err;
          }
        }

        if (
          fee.feeType === 'CONFIRMATION'
          && ['PAID', 'WAIVED'].includes(finalStatus)
          && student.registrationStatus === 'AWAITING_CONFIRMATION'
        ) {
          await prisma.student.update({
            where: { id: student.id },
            data: { registrationStatus: 'APPROVED' },
          });
          student.registrationStatus = 'APPROVED';
        }

        created.push({ row: excelRow, id: fee.id, receiptNumber: fee.receiptNumber });
      } catch (err) {
        errors.push({ row: excelRow, error: err.message || 'Could not save this row' });
      }
    }

    res.json({
      created: created.length,
      skipped: errors.length,
      errors: errors.slice(0, 50),
      receipts: created.slice(0, 20).map((item) => item.receiptNumber),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const filter = await campusStudentFilter(req);
    const fee = await prisma.feePayment.findFirst({
      where: { id: req.params.id, ...filter },
      include: {
        student: { include: { class: true } },
        discountedBy: { select: { firstName: true, lastName: true, role: true } },
        structure: { select: { id: true, label: true, amount: true, installments: true } },
      },
    });
    if (!fee) return res.status(404).json({ error: 'Fee payment not found' });
    res.json(fee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot create fee records' });
    }
    const {
      studentId,
      feeType,
      amount,
      dueDate,
      notes,
      status = 'PENDING',
      discountAmount = 0,
      discountReason = '',
      structureId = null,
      installmentIndex = null,
      installmentTotal = null,
      term = null,
    } = req.body;

    const scope = await studentScopeWhere(req);
    const student = await prisma.student.findFirst({
      where: { id: studentId, ...scope },
    });
    if (!student) return res.status(400).json({ error: 'Student not found in this campus' });

    const originalAmount = Number(amount);
    const discount = Math.max(0, Number(discountAmount) || 0);
    if (discount > originalAmount) {
      return res.status(400).json({ error: 'Discount cannot exceed amount' });
    }
    const finalAmount = Math.max(0, originalAmount - discount);
    const finalStatus = finalAmount === 0 ? 'WAIVED' : status;
    const normalizedTerm = term
      ? String(term).trim().toUpperCase()
      : null;

    const fee = await prisma.feePayment.create({
      data: {
        receiptNumber: generateFeeReceiptNumber(),
        studentId,
        feeType,
        term: ['ANNUAL', 'TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3', 'PRIOR_YEAR'].includes(normalizedTerm)
          ? normalizedTerm
          : null,
        amount: finalAmount,
        originalAmount,
        discountAmount: discount,
        discountReason: discountReason?.trim() || null,
        discountedById: discount > 0 ? req.user.id : null,
        dueDate: new Date(dueDate),
        paidDate: finalStatus === 'PAID' ? new Date() : null,
        status: finalStatus,
        notes,
        structureId: structureId || null,
        installmentIndex: installmentIndex || null,
        installmentTotal: installmentTotal || null,
      },
      include: { student: { include: { class: true } } },
    });

    res.status(201).json(fee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot update fee records' });
    }
    const filter = await campusStudentFilter(req);
    const existing = await prisma.feePayment.findFirst({
      where: { id: req.params.id, ...filter },
    });
    if (!existing) return res.status(404).json({ error: 'Fee payment not found' });

    const { status } = req.body;
    const fee = await prisma.feePayment.update({
      where: { id: req.params.id },
      data: { status, paidDate: status === 'PAID' ? new Date() : null },
      include: { student: { include: { class: true } } },
    });

    if (
      fee.feeType === 'CONFIRMATION'
      && ['PAID', 'WAIVED'].includes(status)
      && fee.student?.registrationStatus === 'AWAITING_CONFIRMATION'
    ) {
      await prisma.student.update({
        where: { id: fee.studentId },
        data: { registrationStatus: 'APPROVED' },
      });
    }

    res.json(fee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!['SCHOOL_MANAGER','SCHOOL_ADMIN','SECRETARY','ACCOUNTANT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete fee records' });
    }
    const filter = await campusStudentFilter(req);
    const existing = await prisma.feePayment.findFirst({
      where: { id: req.params.id, ...filter },
    });
    if (!existing) return res.status(404).json({ error: 'Fee payment not found' });
    await prisma.feePayment.delete({ where: { id: req.params.id } });
    res.json({ message: 'Fee payment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
