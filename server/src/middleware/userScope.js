import prisma from '../lib/prisma.js';

export async function enrichUserScope(req, res, next) {
  try {
    if (!req.user) return next();

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { teacherId: true, studentId: true, parentId: true },
    });

    if (user) {
      req.user.teacherId = user.teacherId;
      req.user.studentId = user.studentId;
      req.user.parentId = user.parentId;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
