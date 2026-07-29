import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.LIBRARY));

router.get('/books', async (req, res) => {
  try {
    const books = await prisma.book.findMany({
      where: { campusId: req.campusId },
      orderBy: { title: 'asc' },
      include: { _count: { select: { loans: { where: { status: 'ACTIVE' } } } } },
    });
    res.json(books);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/books', async (req, res) => {
  try {
    const { title, author, isbn, category, copies = 1 } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const book = await prisma.book.create({
      data: {
        campusId: req.campusId,
        title,
        author,
        isbn,
        category,
        copies,
        available: copies,
      },
    });
    res.status(201).json(book);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/books/:id', async (req, res) => {
  try {
    const existing = await prisma.book.findFirst({
      where: { id: req.params.id, campusId: req.campusId },
    });
    if (!existing) return res.status(404).json({ error: 'Book not found' });

    const { title, author, isbn, category, copies } = req.body;
    const activeLoans = await prisma.bookLoan.count({
      where: { bookId: existing.id, status: 'ACTIVE' },
    });
    const newCopies = copies ?? existing.copies;
    const available = Math.max(0, newCopies - activeLoans);

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: { title, author, isbn, category, copies: newCopies, available },
    });
    res.json(book);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/books/:id', async (req, res) => {
  try {
    const existing = await prisma.book.findFirst({
      where: { id: req.params.id, campusId: req.campusId },
    });
    if (!existing) return res.status(404).json({ error: 'Book not found' });
    await prisma.book.delete({ where: { id: req.params.id } });
    res.json({ message: 'Book deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/loans', async (req, res) => {
  try {
    const loans = await prisma.bookLoan.findMany({
      where: { book: { campusId: req.campusId } },
      orderBy: { loanedAt: 'desc' },
      include: { book: { select: { title: true, author: true } } },
    });
    res.json(loans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/loans', async (req, res) => {
  try {
    const { bookId, borrowerType, borrowerName, studentId, teacherId, dueDate, notes } = req.body;
    const book = await prisma.book.findFirst({
      where: { id: bookId, campusId: req.campusId },
    });
    if (!book) return res.status(404).json({ error: 'Book not found' });
    if (book.available < 1) return res.status(400).json({ error: 'No copies available' });

    const [loan] = await prisma.$transaction([
      prisma.bookLoan.create({
        data: {
          bookId,
          borrowerType,
          borrowerName,
          studentId: studentId || null,
          teacherId: teacherId || null,
          dueDate: new Date(dueDate),
          notes,
        },
        include: { book: { select: { title: true } } },
      }),
      prisma.book.update({
        where: { id: bookId },
        data: { available: { decrement: 1 } },
      }),
    ]);

    res.status(201).json(loan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/loans/:id/return', async (req, res) => {
  try {
    const loan = await prisma.bookLoan.findFirst({
      where: { id: req.params.id, book: { campusId: req.campusId } },
      include: { book: true },
    });
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    if (loan.status === 'RETURNED') return res.status(400).json({ error: 'Already returned' });

    const [updated] = await prisma.$transaction([
      prisma.bookLoan.update({
        where: { id: loan.id },
        data: { status: 'RETURNED', returnedAt: new Date() },
        include: { book: { select: { title: true } } },
      }),
      prisma.book.update({
        where: { id: loan.bookId },
        data: { available: { increment: 1 } },
      }),
    ]);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [totalBooks, totalCopies, activeLoans, overdueLoans] = await Promise.all([
      prisma.book.count({ where: { campusId: req.campusId } }),
      prisma.book.aggregate({ where: { campusId: req.campusId }, _sum: { copies: true } }),
      prisma.bookLoan.count({ where: { book: { campusId: req.campusId }, status: 'ACTIVE' } }),
      prisma.bookLoan.count({
        where: {
          book: { campusId: req.campusId },
          status: 'ACTIVE',
          dueDate: { lt: new Date() },
        },
      }),
    ]);
    res.json({
      totalBooks,
      totalCopies: totalCopies._sum.copies || 0,
      activeLoans,
      overdueLoans,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
