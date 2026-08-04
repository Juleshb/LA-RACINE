import prisma from '../lib/prisma.js';
import { isManagerRole } from '../config/permissions.js';

export async function requireCampus(req, res, next) {
  try {
    const campusId = req.headers['x-campus-id'];

    if (!campusId) {
      return res.status(400).json({ error: 'Campus context required' });
    }

    const campus = await prisma.campus.findUnique({ where: { id: campusId } });
    if (!campus || !campus.isActive) {
      return res.status(404).json({ error: 'Campus not found or inactive' });
    }

    if (!isManagerRole(req.user.role)) {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { campusId: true },
      });
      if (dbUser?.campusId !== campusId) {
        return res.status(403).json({ error: 'You do not have access to this campus' });
      }
    }

    req.campusId = campusId;
    req.campus = campus;
    next();
  } catch (error) {
    if (error?.code === 'P1001') {
      return res.status(503).json({
        error: 'Database is unavailable. Start PostgreSQL on localhost:5432, then try again.',
      });
    }
    next(error);
  }
}
