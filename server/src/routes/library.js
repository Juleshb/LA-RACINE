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
    const { title, author, isbn, category, publisher, copies = 1 } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const book = await prisma.book.create({
      data: {
        campusId: req.campusId,
        title: String(title).trim(),
        author: author?.trim() || null,
        isbn: isbn?.trim() || null,
        category: category?.trim() || null,
        publisher: publisher?.trim() || null,
        copies: Math.max(1, Number(copies) || 1),
        available: Math.max(1, Number(copies) || 1),
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

    const { title, author, isbn, category, publisher, copies } = req.body;
    const activeLoans = await prisma.bookLoan.count({
      where: { bookId: existing.id, status: 'ACTIVE' },
    });
    const newCopies = copies ?? existing.copies;
    const available = Math.max(0, newCopies - activeLoans);

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: {
        title: title?.trim() || existing.title,
        author: author !== undefined ? (author?.trim() || null) : existing.author,
        isbn: isbn !== undefined ? (isbn?.trim() || null) : existing.isbn,
        category: category !== undefined ? (category?.trim() || null) : existing.category,
        publisher: publisher !== undefined ? (publisher?.trim() || null) : existing.publisher,
        copies: newCopies,
        available,
      },
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
    const loanCount = await prisma.bookLoan.count({ where: { bookId: existing.id } });
    if (loanCount) {
      return res.status(400).json({ error: 'This book has loan history and cannot be deleted' });
    }
    await prisma.book.delete({ where: { id: existing.id } });
    res.json({ message: 'Book deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/books/import', async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const mode = req.body?.mode === 'skip' ? 'skip' : 'merge';
    if (!rows.length) return res.status(400).json({ error: 'No book rows to import' });
    let created = 0;
    let merged = 0;
    let skipped = 0;

    for (const row of rows) {
      const title = String(row.title || '').trim();
      if (!title) {
        skipped += 1;
        continue;
      }
      const author = String(row.author || '').trim();
      const isbn = String(row.isbn || '').trim();
      const category = String(row.category || '').trim() || null;
      const publisher = String(row.publisher || '').trim() || null;
      const copies = Math.max(1, Number(row.copies) || 1);
      const existing = isbn
        ? await prisma.book.findFirst({ where: { campusId: req.campusId, isbn } })
        : await prisma.book.findFirst({
          where: {
            campusId: req.campusId,
            title: { equals: title, mode: 'insensitive' },
            ...(author ? { author: { equals: author, mode: 'insensitive' } } : {}),
          },
        });
      if (existing) {
        if (mode === 'skip') {
          skipped += 1;
          continue;
        }
        const active = await prisma.bookLoan.count({ where: { bookId: existing.id, status: 'ACTIVE' } });
        const nextCopies = existing.copies + copies;
        await prisma.book.update({
          where: { id: existing.id },
          data: {
            copies: nextCopies,
            available: Math.max(0, nextCopies - active),
            category: existing.category || category,
            publisher: existing.publisher || publisher,
          },
        });
        merged += 1;
        continue;
      }
      await prisma.book.create({
        data: {
          campusId: req.campusId,
          title,
          author: author || null,
          isbn: isbn || null,
          category,
          publisher,
          copies,
          available: copies,
        },
      });
      created += 1;
    }

    res.json({ created, merged, skipped });
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
    const { bookId, borrowerType, borrowerName, studentId, teacherId, dueDate, loanedAt, notes } = req.body;
    const book = await prisma.book.findFirst({
      where: { id: bookId, campusId: req.campusId },
    });
    if (!book) return res.status(404).json({ error: 'Book not found' });
    if (book.available < 1) return res.status(400).json({ error: 'No copies available' });
    if (!String(borrowerName || '').trim()) return res.status(400).json({ error: 'Borrower name is required' });
    if (!dueDate) return res.status(400).json({ error: 'Return date is required' });
    const allowedTypes = ['STUDENT', 'TEACHER', 'STAFF', 'PARENT'];
    if (!allowedTypes.includes(borrowerType)) return res.status(400).json({ error: 'Borrower type is not recognized' });

    const [loan] = await prisma.$transaction([
      prisma.bookLoan.create({
        data: {
          bookId,
          borrowerType,
          borrowerName,
          studentId: studentId || null,
          teacherId: teacherId || null,
          loanedAt: loanedAt ? new Date(loanedAt) : new Date(),
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

    const { returnedAt, condition, notes } = req.body || {};
    const lost = /lost/i.test(String(condition || ''));
    const operations = [
      prisma.bookLoan.update({
        where: { id: loan.id },
        data: {
          status: 'RETURNED',
          returnedAt: returnedAt ? new Date(returnedAt) : new Date(),
          condition: condition?.trim() || null,
          notes: notes !== undefined ? (notes?.trim() || null) : loan.notes,
        },
        include: { book: { select: { title: true } } },
      }),
    ];
    if (!lost) {
      operations.push(prisma.book.update({
        where: { id: loan.bookId },
        data: { available: { increment: 1 } },
      }));
    }
    const [updated] = await prisma.$transaction(operations);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const whereBook = { campusId: req.campusId };
    const [totalBooks, totalCopies, availableCopies, activeLoans, overdueLoans, returnedLoans] = await Promise.all([
      prisma.book.count({ where: whereBook }),
      prisma.book.aggregate({ where: whereBook, _sum: { copies: true } }),
      prisma.book.aggregate({ where: whereBook, _sum: { available: true } }),
      prisma.bookLoan.count({ where: { book: whereBook, status: 'ACTIVE' } }),
      prisma.bookLoan.count({
        where: {
          book: whereBook,
          status: 'ACTIVE',
          dueDate: { lt: new Date() },
        },
      }),
      prisma.bookLoan.count({ where: { book: whereBook, status: 'RETURNED' } }),
    ]);
    res.json({
      totalBooks,
      totalCopies: totalCopies._sum.copies || 0,
      availableCopies: availableCopies._sum.available || 0,
      activeLoans,
      overdueLoans,
      returnedLoans,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
