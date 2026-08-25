import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { studentScopeWhere, campusYearWhere } from '../lib/scope.js';
import { generateFeeReceiptNumber } from '../lib/deliberation.js';

const router = Router();

const FINANCE_ROLES = ['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY', 'ACCOUNTANT'];

function requireFinance(req, res) {
  if (!FINANCE_ROLES.includes(req.user.role)) {
    res.status(403).json({ error: 'Only finance staff can access this' });
    return false;
  }
  return true;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(from, to) {
  const ms = new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0);
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function splitInstallments(total, count) {
  const n = Math.max(1, Math.min(12, Number(count) || 1));
  const base = Math.floor(total / n);
  const parts = Array.from({ length: n }, () => base);
  parts[n - 1] = total - base * (n - 1);
  return parts;
}

async function campusStudentFilter(req) {
  const where = await studentScopeWhere(req);
  return { student: where };
}

// ── Fee structures ──────────────────────────────────────────────────────────

router.get('/structures', async (req, res) => {
  try {
    if (!requireFinance(req, res)) return;
    const structures = await prisma.feeStructure.findMany({
      where: campusYearWhere(req),
      orderBy: [{ feeType: 'asc' }, { label: 'asc' }],
      include: {
        class: { select: { id: true, name: true, grade: true, section: true } },
        _count: { select: { payments: true } },
      },
    });
    res.json(structures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/structures', async (req, res) => {
  try {
    if (!requireFinance(req, res)) return;
    const {
      classId = null,
      feeType,
      amount,
      label = null,
      installments = 1,
      dueDate = null,
      isActive = true,
    } = req.body || {};

    if (!feeType || amount == null || Number(amount) < 0) {
      return res.status(400).json({ error: 'Fee type and a non-negative amount are required' });
    }

    if (classId) {
      const cls = await prisma.class.findFirst({
        where: { id: classId, ...campusYearWhere(req) },
      });
      if (!cls) return res.status(400).json({ error: 'Class not found in this campus year' });
    }

    const structure = await prisma.feeStructure.create({
      data: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        classId: classId || null,
        feeType,
        amount: Number(amount),
        label: label?.trim() || null,
        installments: Math.max(1, Math.min(12, Number(installments) || 1)),
        dueDate: dueDate ? new Date(dueDate) : null,
        isActive: Boolean(isActive),
      },
      include: {
        class: { select: { id: true, name: true, grade: true, section: true } },
      },
    });
    res.status(201).json(structure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/structures/:id', async (req, res) => {
  try {
    if (!requireFinance(req, res)) return;
    const existing = await prisma.feeStructure.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Fee structure not found' });

    const {
      classId,
      feeType,
      amount,
      label,
      installments,
      dueDate,
      isActive,
    } = req.body || {};

    if (classId) {
      const cls = await prisma.class.findFirst({
        where: { id: classId, ...campusYearWhere(req) },
      });
      if (!cls) return res.status(400).json({ error: 'Class not found in this campus year' });
    }

    const structure = await prisma.feeStructure.update({
      where: { id: existing.id },
      data: {
        ...(classId !== undefined ? { classId: classId || null } : {}),
        ...(feeType ? { feeType } : {}),
        ...(amount != null ? { amount: Number(amount) } : {}),
        ...(label !== undefined ? { label: label?.trim() || null } : {}),
        ...(installments != null ? { installments: Math.max(1, Math.min(12, Number(installments) || 1)) } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
      include: {
        class: { select: { id: true, name: true, grade: true, section: true } },
      },
    });
    res.json(structure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/structures/:id', async (req, res) => {
  try {
    if (!requireFinance(req, res)) return;
    const existing = await prisma.feeStructure.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Fee structure not found' });
    await prisma.feeStructure.delete({ where: { id: existing.id } });
    res.json({ message: 'Fee structure deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Bill approved students from a fee structure (creates installment fee records). */
router.post('/structures/:id/generate', async (req, res) => {
  try {
    if (!requireFinance(req, res)) return;
    const structure = await prisma.feeStructure.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req), isActive: true },
    });
    if (!structure) return res.status(404).json({ error: 'Active fee structure not found' });

    const classId = req.body?.classId || structure.classId || null;
    const studentWhere = {
      ...campusYearWhere(req),
      registrationStatus: 'APPROVED',
      ...(classId ? { classId } : {}),
    };

    const students = await prisma.student.findMany({
      where: studentWhere,
      select: { id: true, classId: true, firstName: true, lastName: true },
    });

    if (!students.length) {
      return res.status(400).json({ error: 'No approved students match this structure' });
    }

    const parts = splitInstallments(structure.amount, structure.installments);
    const baseDue = structure.dueDate ? new Date(structure.dueDate) : new Date();
    let created = 0;
    let skipped = 0;

    for (const student of students) {
      for (let i = 0; i < parts.length; i += 1) {
        const installmentIndex = parts.length > 1 ? i + 1 : null;
        const existing = await prisma.feePayment.findFirst({
          where: {
            studentId: student.id,
            feeType: structure.feeType,
            structureId: structure.id,
            ...(installmentIndex ? { installmentIndex } : {}),
          },
          select: { id: true },
        });
        if (existing) {
          skipped += 1;
          continue;
        }

        const noteParts = [
          structure.label || null,
          parts.length > 1 ? `Installment ${i + 1}/${parts.length}` : null,
        ].filter(Boolean);

        await prisma.feePayment.create({
          data: {
            receiptNumber: generateFeeReceiptNumber(),
            studentId: student.id,
            feeType: structure.feeType,
            amount: parts[i],
            originalAmount: parts[i],
            dueDate: addDays(baseDue, i * 30),
            status: 'PENDING',
            notes: noteParts.join(' · ') || null,
            installmentIndex,
            installmentTotal: parts.length > 1 ? parts.length : null,
            structureId: structure.id,
          },
        });
        created += 1;
      }
    }

    res.json({
      students: students.length,
      created,
      skipped,
      installments: parts.length,
      amountEach: parts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Cash report ─────────────────────────────────────────────────────────────

router.get('/cash-report', async (req, res) => {
  try {
    if (!requireFinance(req, res)) return;
    const filter = await campusStudentFilter(req);
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(1);
    const from = req.query.from ? new Date(req.query.from) : defaultFrom;
    const to = req.query.to ? new Date(req.query.to) : today;
    to.setHours(23, 59, 59, 999);

    const fees = await prisma.feePayment.findMany({
      where: {
        ...filter,
        status: 'PAID',
        paidDate: { gte: from, lte: to },
      },
      orderBy: { paidDate: 'desc' },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            studentId: true,
            class: { select: { name: true } },
          },
        },
      },
    });

    const byType = {};
    let total = 0;
    for (const fee of fees) {
      total += fee.amount || 0;
      if (!byType[fee.feeType]) byType[fee.feeType] = { feeType: fee.feeType, count: 0, amount: 0 };
      byType[fee.feeType].count += 1;
      byType[fee.feeType].amount += fee.amount || 0;
    }

    const byDay = {};
    for (const fee of fees) {
      const key = fee.paidDate ? new Date(fee.paidDate).toISOString().slice(0, 10) : 'unknown';
      if (!byDay[key]) byDay[key] = { date: key, count: 0, amount: 0 };
      byDay[key].count += 1;
      byDay[key].amount += fee.amount || 0;
    }

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      totalCollected: total,
      receiptCount: fees.length,
      byType: Object.values(byType).sort((a, b) => b.amount - a.amount),
      byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
      receipts: fees.slice(0, 200),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Debtors aging ───────────────────────────────────────────────────────────

router.get('/debtors', async (req, res) => {
  try {
    if (!requireFinance(req, res)) return;
    const filter = await campusStudentFilter(req);
    const today = new Date();
    const fees = await prisma.feePayment.findMany({
      where: {
        ...filter,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentId: true,
            parentId: true,
            class: { select: { id: true, name: true } },
            parent: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    const byStudent = new Map();

    for (const fee of fees) {
      const overdueDays = Math.max(0, daysBetween(fee.dueDate, today));
      let bucket = 'current';
      if (overdueDays >= 1 && overdueDays <= 30) bucket = 'd1_30';
      else if (overdueDays <= 60 && overdueDays > 30) bucket = 'd31_60';
      else if (overdueDays <= 90 && overdueDays > 60) bucket = 'd61_90';
      else if (overdueDays > 90) bucket = 'd90plus';
      buckets[bucket] += fee.amount || 0;

      const sid = fee.studentId;
      if (!byStudent.has(sid)) {
        byStudent.set(sid, {
          student: fee.student,
          totalDue: 0,
          oldestOverdueDays: 0,
          fees: [],
        });
      }
      const row = byStudent.get(sid);
      row.totalDue += fee.amount || 0;
      row.oldestOverdueDays = Math.max(row.oldestOverdueDays, overdueDays);
      row.fees.push({
        id: fee.id,
        receiptNumber: fee.receiptNumber,
        feeType: fee.feeType,
        amount: fee.amount,
        dueDate: fee.dueDate,
        status: fee.status,
        overdueDays,
        discountAmount: fee.discountAmount,
      });
    }

    const debtors = [...byStudent.values()].sort((a, b) => b.totalDue - a.totalDue);

    res.json({
      asOf: today.toISOString(),
      totalOutstanding: debtors.reduce((s, d) => s + d.totalDue, 0),
      debtorCount: debtors.length,
      feeCount: fees.length,
      buckets,
      debtors,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Transport unpaid ────────────────────────────────────────────────────────

router.get('/transport-unpaid', async (req, res) => {
  try {
    if (!requireFinance(req, res)) return;
    const filter = await campusStudentFilter(req);
    const fees = await prisma.feePayment.findMany({
      where: {
        ...filter,
        feeType: 'TRANSPORT',
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentId: true,
            class: { select: { name: true } },
            transportEnrollment: {
              select: {
                isActive: true,
                route: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json({
      count: fees.length,
      total: fees.reduce((s, f) => s + (f.amount || 0), 0),
      fees: fees.map((f) => ({
        ...f,
        routeName: f.student.transportEnrollment?.isActive
          ? f.student.transportEnrollment?.route?.name
          : null,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Discount / scholarship ──────────────────────────────────────────────────

router.patch('/:id/discount', async (req, res) => {
  try {
    if (!requireFinance(req, res)) return;
    const filter = await campusStudentFilter(req);
    const existing = await prisma.feePayment.findFirst({
      where: { id: req.params.id, ...filter },
    });
    if (!existing) return res.status(404).json({ error: 'Fee payment not found' });
    if (existing.status === 'PAID') {
      return res.status(400).json({ error: 'Cannot discount a paid fee — reverse payment first' });
    }

    const discountAmount = Number(req.body?.discountAmount || 0);
    const discountReason = String(req.body?.discountReason || '').trim();
    if (discountAmount < 0) {
      return res.status(400).json({ error: 'Discount cannot be negative' });
    }

    const original = existing.originalAmount ?? existing.amount + (existing.discountAmount || 0);
    if (discountAmount > original) {
      return res.status(400).json({ error: 'Discount cannot exceed the original amount' });
    }

    const newAmount = Math.max(0, original - discountAmount);
    const waiveFully = Boolean(req.body?.waive) || newAmount === 0;

    const fee = await prisma.feePayment.update({
      where: { id: existing.id },
      data: {
        originalAmount: original,
        discountAmount,
        discountReason: discountReason || null,
        discountedById: req.user.id,
        amount: newAmount,
        status: waiveFully ? 'WAIVED' : existing.status === 'WAIVED' ? 'PENDING' : existing.status,
        notes: discountReason
          ? [existing.notes, `Discount: ${discountReason}`].filter(Boolean).join('\n')
          : existing.notes,
      },
      include: {
        student: { include: { class: true } },
        discountedBy: { select: { firstName: true, lastName: true, role: true } },
      },
    });

    res.json(fee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Lookup suggested amount from fee structures for a student + fee type. */
router.get('/suggest-amount', async (req, res) => {
  try {
    if (!requireFinance(req, res)) return;
    const { studentId, feeType } = req.query;
    if (!studentId || !feeType) {
      return res.status(400).json({ error: 'studentId and feeType are required' });
    }
    const scope = await studentScopeWhere(req);
    const student = await prisma.student.findFirst({
      where: { id: studentId, ...scope },
      select: { id: true, classId: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const structures = await prisma.feeStructure.findMany({
      where: {
        ...campusYearWhere(req),
        feeType,
        isActive: true,
        OR: [
          { classId: student.classId },
          { classId: null },
        ],
      },
      orderBy: { classId: 'desc' },
      include: { class: { select: { name: true } } },
    });

    const match = structures.find((s) => s.classId === student.classId) || structures.find((s) => !s.classId) || null;
    res.json({
      suggested: match,
      structures,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
