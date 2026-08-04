import prisma from '../lib/prisma.js';
import { isManagerRole } from '../config/permissions.js';

export async function requireAcademicYear(req, res, next) {
  try {
    const headerYearId = req.headers['x-academic-year-id'];

    let year;
    if (headerYearId) {
      year = await prisma.academicYear.findFirst({
        where: { id: headerYearId, campusId: req.campusId },
      });
      if (!year) {
        return res.status(404).json({ error: 'Academic year not found' });
      }
      if (!year.isActive && !isManagerRole(req.user.role)) {
        return res.status(403).json({ error: 'You can only access the active academic year' });
      }
    } else {
      year = await prisma.academicYear.findFirst({
        where: { campusId: req.campusId, isActive: true },
      });
      if (!year) {
        return res.status(400).json({
          error: 'No active academic year for this campus. The school manager must set one.',
        });
      }
    }

    req.academicYearId = year.id;
    req.academicYear = year;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
