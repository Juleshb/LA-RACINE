import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { studentScopeWhere } from '../lib/scope.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.FEES));

function campusStudentFilter(req) {
  const scope = studentScopeWhere(req);
  return scope.then((where) => ({ student: where }));
}

function generateReceiptNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `FEE-${year}${month}-${random}`;
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

router.get('/:id', async (req, res) => {
  try {
    const filter = await campusStudentFilter(req);
    const fee = await prisma.feePayment.findFirst({
      where: { id: req.params.id, ...filter },
      include: { student: { include: { class: true } } },
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
    const { studentId, feeType, amount, dueDate, notes, status = 'PENDING' } = req.body;

    const scope = await studentScopeWhere(req);
    const student = await prisma.student.findFirst({
      where: { id: studentId, ...scope },
    });
    if (!student) return res.status(400).json({ error: 'Student not found in this campus' });

    const fee = await prisma.feePayment.create({
      data: {
        receiptNumber: generateReceiptNumber(),
        studentId,
        feeType,
        amount,
        dueDate: new Date(dueDate),
        paidDate: status === 'PAID' ? new Date() : null,
        status,
        notes,
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
    res.json(fee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'SCHOOL_MANAGER' && req.user.role !== 'SECRETARY' && req.user.role !== 'ACCOUNTANT') {
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
