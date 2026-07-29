import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { campusYearWhere } from '../lib/scope.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'TEACHER') {
      return res.status(403).json({ error: 'Teachers cannot list all staff' });
    }
    const teachers = await prisma.teacher.findMany({
      where: campusYearWhere(req),
      orderBy: { name: 'asc' },
      include: { _count: { select: { classes: true, subjects: true } } },
    });
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const teacher = await prisma.teacher.create({
      data: { ...req.body, campusId: req.campusId, academicYearId: req.academicYearId },
    });
    res.status(201).json(teacher);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.teacher.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Teacher not found' });

    const { campusId: _, academicYearId: __, ...data } = req.body;
    const teacher = await prisma.teacher.update({
      where: { id: req.params.id },
      data,
    });
    res.json(teacher);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.teacher.findFirst({
      where: { id: req.params.id, ...campusYearWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Teacher not found' });
    await prisma.teacher.delete({ where: { id: req.params.id } });
    res.json({ message: 'Teacher deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
