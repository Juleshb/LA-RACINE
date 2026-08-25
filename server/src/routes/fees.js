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
            parent: { select: { id: true, firstName: true, lastName: true, phone: true } },
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

    const fee = await prisma.feePayment.create({
      data: {
        receiptNumber: generateFeeReceiptNumber(),
        studentId,
        feeType,
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
