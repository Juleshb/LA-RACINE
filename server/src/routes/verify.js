import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { verifyBulletinToken } from '../lib/bulletinVerification.js';
import { buildClassBulletinReport } from '../lib/bulletinReport.js';

const router = Router();

router.get('/bulletin/:token', async (req, res) => {
  try {
    const decoded = verifyBulletinToken(req.params.token);

    const student = await prisma.student.findUnique({
      where: { id: decoded.studentId },
      include: {
        class: { select: { id: true, name: true, grade: true, section: true, campusId: true, academicYearId: true } },
        campus: { select: { name: true, city: true } },
      },
    });

    if (!student) {
      return res.status(404).json({ valid: false, error: 'Student not found' });
    }

    let matchesCurrent = false;
    try {
      const report = await buildClassBulletinReport(prisma, {
        classId: decoded.classId,
        studentId: decoded.studentId,
        term: decoded.term,
        campusId: student.class?.campusId || student.campusId,
        academicYearId: student.class?.academicYearId || student.academicYearId,
      });
      matchesCurrent = report.summary.percentage === decoded.percentage
        && report.rank?.place === decoded.place;
    } catch {
      matchesCurrent = false;
    }

    const school = await prisma.schoolProfile.findFirst();

    res.json({
      valid: true,
      matchesCurrent,
      student: {
        code: student.studentId,
        name: [student.firstName, student.lastName, student.postName].filter(Boolean).join(' '),
      },
      class: student.class
        ? { name: student.class.name, grade: student.class.grade, section: student.class.section }
        : null,
      term: decoded.term,
      academicYear: decoded.academicYear || null,
      percentage: decoded.percentage,
      place: decoded.place,
      totalStudents: decoded.totalStudents,
      issuedAt: decoded.issuedAt,
      school: {
        name: school?.name || 'École La RACINE',
        campus: student.campus?.name || null,
        city: student.campus?.city || school?.city || null,
      },
    });
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: error.message === 'Invalid bulletin token' ? 'Invalid verification code' : 'Verification failed',
    });
  }
});

export default router;
