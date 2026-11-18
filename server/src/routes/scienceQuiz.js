import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';

const router = Router();
const LEVELS = ['easy', 'medium', 'hard', 'impossible'];

router.use(authorizePermission(PERMISSIONS.E_LEARNING));

function canManage(role) {
  return !['STUDENT', 'PARENT'].includes(role);
}

function cleanQuestions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const options = Array.isArray(item?.options)
      ? item.options.slice(0, 4).map((option) => String(option || '').trim())
      : [];
    while (options.length < 4) options.push('');
    const answer = Number(item?.answer);
    return {
      sortOrder: index,
      prompt: String(item?.prompt || '').trim(),
      options,
      answer: Number.isInteger(answer) && answer >= 0 && answer <= 3 ? answer : 0,
      note: String(item?.note || '').trim() || null,
    };
  }).filter((item) => item.prompt);
}

function isPlayable(questions) {
  return questions.length > 0 && questions.every((question) => (
    question.options.length === 4
    && question.options.every(Boolean)
    && question.options[question.answer]
  ));
}

function readQuiz(body) {
  const title = String(body?.title || '').trim();
  const level = LEVELS.includes(body?.level) ? body.level : 'easy';
  const description = String(body?.description || '').trim() || null;
  const isPublished = Boolean(body?.isPublished);
  const questions = cleanQuestions(body?.questions);
  return { title, level, description, isPublished, questions };
}

router.get('/', async (req, res) => {
  try {
    const where = { campusId: req.campusId };
    if (!canManage(req.user.role)) where.isPublished = true;
    const quizzes = await prisma.scienceQuiz.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { questions: true } } },
    });
    res.json(quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      level: quiz.level,
      isPublished: quiz.isPublished,
      questionCount: quiz._count.questions,
      updatedAt: quiz.updatedAt,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const quiz = await prisma.scienceQuiz.findFirst({
      where: { id: req.params.id, campusId: req.campusId },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!quiz || (!quiz.isPublished && !canManage(req.user.role))) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    res.json(quiz);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'You cannot create quizzes' });
    const quiz = readQuiz(req.body);
    if (!quiz.title) return res.status(400).json({ error: 'Title is required' });
    if (quiz.isPublished && !isPlayable(quiz.questions)) {
      return res.status(400).json({ error: 'A published quiz needs at least one question with four answers' });
    }
    const created = await prisma.scienceQuiz.create({
      data: {
        campusId: req.campusId,
        title: quiz.title,
        description: quiz.description,
        level: quiz.level,
        isPublished: quiz.isPublished,
        questions: { create: quiz.questions },
      },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'You cannot edit quizzes' });
    const existing = await prisma.scienceQuiz.findFirst({
      where: { id: req.params.id, campusId: req.campusId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Quiz not found' });
    const quiz = readQuiz(req.body);
    if (!quiz.title) return res.status(400).json({ error: 'Title is required' });
    if (quiz.isPublished && !isPlayable(quiz.questions)) {
      return res.status(400).json({ error: 'A published quiz needs at least one question with four answers' });
    }
    const [, , updated] = await prisma.$transaction([
      prisma.scienceQuizQuestion.deleteMany({ where: { quizId: existing.id } }),
      prisma.scienceQuiz.update({
        where: { id: existing.id },
        data: {
          title: quiz.title,
          description: quiz.description,
          level: quiz.level,
          isPublished: quiz.isPublished,
          questions: { create: quiz.questions },
        },
      }),
      prisma.scienceQuiz.findUnique({
        where: { id: existing.id },
        include: { questions: { orderBy: { sortOrder: 'asc' } } },
      }),
    ]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!canManage(req.user.role)) return res.status(403).json({ error: 'You cannot delete quizzes' });
    const existing = await prisma.scienceQuiz.findFirst({
      where: { id: req.params.id, campusId: req.campusId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Quiz not found' });
    await prisma.scienceQuiz.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
