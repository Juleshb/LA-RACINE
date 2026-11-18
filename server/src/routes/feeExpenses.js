import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

const EDITORS = new Set(['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY', 'ACCOUNTANT']);
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function denied(req, res) {
  if (EDITORS.has(req.user?.role)) return false;
  res.status(403).json({ error: 'Access denied' });
  return true;
}

function resultOf(profit) {
  if (profit > 0) return 'PROFIT';
  if (profit < 0) return 'LOSS';
  return 'BREAK-EVEN';
}

function isoDay(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function kigaliDay(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kigali',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type).value;
  return { month: Number(value('month')), key: `${value('year')}-${value('month')}-${value('day')}` };
}

function withinYear(date, year) {
  const key = kigaliDay(date).key;
  if (key < kigaliDay(new Date(year.startDate)).key) return false;
  if (year.endDate && key > kigaliDay(new Date(year.endDate)).key) return false;
  return true;
}

async function collectedByMonth(campusId, academicYear) {
  const payments = await prisma.feePayment.findMany({
    where: {
      status: 'PAID',
      currency: { not: 'USD' },
      paidDate: { not: null },
      student: { campusId, academicYearId: academicYear.id },
    },
    select: { amount: true, paidDate: true },
  });
  const totals = new Map();
  payments.forEach((payment) => {
    if (!withinYear(payment.paidDate, academicYear)) return;
    const month = kigaliDay(payment.paidDate).month;
    totals.set(month, (totals.get(month) || 0) + (payment.amount || 0));
  });
  return totals;
}

async function buildSummary(campusId, academicYear) {
  const academicYearId = academicYear.id;
  const [savedMonths, expenses, feesByMonth] = await Promise.all([
    prisma.schoolMonthSummary.findMany({ where: { campusId, academicYearId } }),
    prisma.schoolExpense.findMany({
      where: { campusId, academicYearId },
      orderBy: [{ spentOn: 'asc' }, { createdAt: 'asc' }],
    }),
    collectedByMonth(campusId, academicYear),
  ]);
  const notesByMonth = new Map(savedMonths.map((row) => [row.month, row]));
  const spentByMonth = new Map();
  expenses.forEach((row) => {
    spentByMonth.set(row.month, (spentByMonth.get(row.month) || 0) + row.amount);
  });

  const months = MONTHS.map((name, index) => {
    const month = index + 1;
    const saved = notesByMonth.get(month);
    const feesCollected = feesByMonth.get(month) || 0;
    const spent = spentByMonth.get(month) || 0;
    const profit = feesCollected - spent;
    return {
      month,
      name,
      feesCollected,
      expenses: spent,
      profit,
      result: resultOf(profit),
      notes: saved?.notes || '',
    };
  });

  const totals = months.reduce((sum, row) => ({
    feesCollected: sum.feesCollected + row.feesCollected,
    expenses: sum.expenses + row.expenses,
    profit: sum.profit + row.profit,
  }), { feesCollected: 0, expenses: 0, profit: 0 });
  totals.result = resultOf(totals.profit);

  return {
    months,
    expenses: expenses.map((row) => ({
      id: row.id,
      month: row.month,
      spentOn: isoDay(row.spentOn),
      amount: row.amount,
      description: row.description,
    })),
    totals,
  };
}

router.get('/expenses-summary', async (req, res) => {
  try {
    if (denied(req, res)) return;
    res.json(await buildSummary(req.campusId, req.academicYear));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/expenses-summary/months/:month', async (req, res) => {
  try {
    if (denied(req, res)) return;
    const month = Number(req.params.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Choose a month from January to December.' });
    }
    const notes = String(req.body?.notes || '').trim().slice(0, 300);
    await prisma.schoolMonthSummary.upsert({
      where: {
        campusId_academicYearId_month: {
          campusId: req.campusId,
          academicYearId: req.academicYearId,
          month,
        },
      },
      update: { notes, updatedById: req.user.id },
      create: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        month,
        notes,
        updatedById: req.user.id,
      },
    });
    res.json(await buildSummary(req.campusId, req.academicYear));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/expenses-summary/expenses', async (req, res) => {
  try {
    if (denied(req, res)) return;
    const month = Number(req.body?.month);
    const spentOn = parseDay(req.body?.spentOn);
    const amount = Number(req.body?.amount);
    const description = String(req.body?.description || '').trim().slice(0, 300);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Choose the month this expense belongs to.' });
    }
    if (!spentOn) return res.status(400).json({ error: 'Enter the date of the expense.' });
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Enter the amount spent.' });
    }
    if (!description) return res.status(400).json({ error: 'Enter a short description.' });
    await prisma.schoolExpense.create({
      data: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        month,
        spentOn,
        amount,
        description,
        createdById: req.user.id,
      },
    });
    res.status(201).json(await buildSummary(req.campusId, req.academicYear));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/expenses-summary/expenses/:id', async (req, res) => {
  try {
    if (denied(req, res)) return;
    const existing = await prisma.schoolExpense.findFirst({
      where: {
        id: req.params.id,
        campusId: req.campusId,
        academicYearId: req.academicYearId,
      },
    });
    if (!existing) return res.status(404).json({ error: 'Expense not found.' });
    await prisma.schoolExpense.delete({ where: { id: existing.id } });
    res.json(await buildSummary(req.campusId, req.academicYear));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
