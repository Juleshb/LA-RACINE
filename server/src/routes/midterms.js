import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { isPrimaryGrade } from '../config/grades.js';
import { studentScopeWhere } from '../lib/scope.js';
import {
  DEFAULT_TERMS,
  canManageMidterms,
  defaultMidtermTitle,
  ensureMidtermWindows,
  listPrimaryClasses,
  notifyParentsMidtermPublished,
  publishMidtermSnapshot,
} from '../lib/midterms.js';

const router = Router();
router.use(authorizePermission(PERMISSIONS.MARKS));

router.get('/terms', (_req, res) => {
  res.json({ terms: DEFAULT_TERMS });
});

router.get('/windows', async (req, res) => {
  try {
    const term = String(req.query.term || DEFAULT_TERMS[0]);
    const windows = await ensureMidtermWindows(req.campusId, req.academicYearId, term);
    const primaryClasses = await listPrimaryClasses(req.campusId, req.academicYearId);
    res.json({
      term,
      terms: DEFAULT_TERMS,
      windows,
      primaryClassCount: primaryClasses.length,
      canManage: canManageMidterms(req.user.role),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/windows/:id', async (req, res) => {
  try {
    if (!canManageMidterms(req.user.role)) {
      return res.status(403).json({ error: 'Seuls les responsables peuvent modifier les dates des périodes' });
    }

    const existing = await prisma.midtermWindow.findFirst({
      where: {
        id: req.params.id,
        campusId: req.campusId,
        academicYearId: req.academicYearId,
      },
    });
    if (!existing) return res.status(404).json({ error: 'Période introuvable' });

    const { cutoffDate, title } = req.body || {};
    if (!cutoffDate) {
      return res.status(400).json({ error: 'La date limite est obligatoire' });
    }

    const parsed = new Date(cutoffDate);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: 'Date limite invalide' });
    }

    // Si 2ème période, la date doit être ≥ 1ère période
    if (existing.sequence === 2) {
      const mt1 = await prisma.midtermWindow.findFirst({
        where: {
          campusId: req.campusId,
          academicYearId: req.academicYearId,
          term: existing.term,
          sequence: 1,
        },
      });
      if (mt1 && parsed < new Date(mt1.cutoffDate)) {
        return res.status(400).json({ error: 'La date de la 2ème période doit être postérieure ou égale à la 1ère période' });
      }
    }

    const updated = await prisma.midtermWindow.update({
      where: { id: existing.id },
      data: {
        cutoffDate: parsed,
        title: title?.trim() || existing.title || defaultMidtermTitle(existing.sequence),
        // Editing a published window moves it back to draft until re-published
        status: existing.status === 'PUBLISHED' ? 'DRAFT' : existing.status,
        publishedAt: existing.status === 'PUBLISHED' ? null : existing.publishedAt,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/windows/:id/publish', async (req, res) => {
  try {
    if (!canManageMidterms(req.user.role)) {
      return res.status(403).json({ error: 'Seuls les responsables peuvent publier les périodes' });
    }

    const existing = await prisma.midtermWindow.findFirst({
      where: {
        id: req.params.id,
        campusId: req.campusId,
        academicYearId: req.academicYearId,
      },
    });
    if (!existing) return res.status(404).json({ error: 'Période introuvable' });

    if (existing.sequence === 2) {
      const mt1 = await prisma.midtermWindow.findFirst({
        where: {
          campusId: req.campusId,
          academicYearId: req.academicYearId,
          term: existing.term,
          sequence: 1,
        },
      });
      if (!mt1 || mt1.status !== 'PUBLISHED') {
        return res.status(400).json({ error: 'Publiez d\'abord la 1ère période avant la 2ème' });
      }
    }

    const snapshot = await publishMidtermSnapshot(existing, { publishedById: req.user.id });

    let sms = null;
    if (req.body?.notifyParents) {
      sms = await notifyParentsMidtermPublished(existing, {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
      });
      sms = {
        requested: sms.requested,
        sent: sms.sent,
        failed: sms.failed,
        skipped: sms.skipped,
        error: sms.error,
      };
    }

    const window = await prisma.midtermWindow.findUnique({ where: { id: existing.id } });
    res.json({ window, snapshot, sms });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Class midterm report (all students) */
router.get('/windows/:id/report', async (req, res) => {
  try {
    const window = await prisma.midtermWindow.findFirst({
      where: {
        id: req.params.id,
        campusId: req.campusId,
        academicYearId: req.academicYearId,
      },
    });
    if (!window) return res.status(404).json({ error: 'Période introuvable' });

    const isParent = req.user.role === 'PARENT';
    const isStudent = req.user.role === 'STUDENT';
    if ((isParent || isStudent) && window.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'Cette période n\'est pas encore publiée' });
    }

    const classId = req.query.classId;
    if (!classId) return res.status(400).json({ error: 'classId est obligatoire' });

    const cls = await prisma.class.findFirst({
      where: { id: classId, campusId: req.campusId, academicYearId: req.academicYearId },
      include: { subjects: { orderBy: [{ categoryOrder: 'asc' }, { sortOrder: 'asc' }] } },
    });
    if (!cls) return res.status(404).json({ error: 'Classe introuvable' });
    if (!isPrimaryGrade(cls.grade)) {
      return res.status(400).json({ error: 'Les périodes concernent uniquement le primaire (P1–P6)' });
    }

    let studentWhere = {
      classId: cls.id,
      campusId: req.campusId,
      academicYearId: req.academicYearId,
      registrationStatus: 'APPROVED',
    };

    if (isParent || isStudent) {
      const scope = await studentScopeWhere(req);
      studentWhere = { ...studentWhere, ...scope };
    }

    const students = await prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        postName: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const studentIds = students.map((s) => s.id);
    const [results, standings] = await Promise.all([
      prisma.midtermResult.findMany({
        where: { windowId: window.id, classId: cls.id, studentId: { in: studentIds } },
      }),
      prisma.midtermStanding.findMany({
        where: { windowId: window.id, classId: cls.id, studentId: { in: studentIds } },
      }),
    ]);

    const standingByStudent = new Map(standings.map((s) => [s.studentId, s]));
    const resultsByStudent = new Map();
    for (const r of results) {
      if (!resultsByStudent.has(r.studentId)) resultsByStudent.set(r.studentId, []);
      resultsByStudent.get(r.studentId).push(r);
    }

    const rows = students.map((student) => {
      const standing = standingByStudent.get(student.id);
      const subjectMap = new Map((resultsByStudent.get(student.id) || []).map((r) => [r.subjectId, r]));
      return {
        student,
        standing: standing
          ? {
            obtained: standing.obtained,
            maxScore: standing.maxScore,
            pct: standing.pct,
            place: standing.place,
            totalStudents: standing.totalStudents,
          }
          : null,
        subjects: cls.subjects.map((sub) => {
          const r = subjectMap.get(sub.id);
          return {
            subjectId: sub.id,
            name: sub.name,
            code: sub.code,
            obtained: r?.obtained ?? null,
            maxScore: r?.maxScore ?? null,
            pct: r?.pct ?? null,
          };
        }),
      };
    });

    res.json({
      window,
      class: { id: cls.id, name: cls.name, grade: cls.grade, section: cls.section },
      subjects: cls.subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      rows,
      published: window.status === 'PUBLISHED',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Single student midterm detail */
router.get('/windows/:id/students/:studentId', async (req, res) => {
  try {
    const window = await prisma.midtermWindow.findFirst({
      where: {
        id: req.params.id,
        campusId: req.campusId,
        academicYearId: req.academicYearId,
      },
    });
    if (!window) return res.status(404).json({ error: 'Période introuvable' });

    if (['PARENT', 'STUDENT'].includes(req.user.role) && window.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'Cette période n\'est pas encore publiée' });
    }

    const scope = await studentScopeWhere(req);
    const student = await prisma.student.findFirst({
      where: { id: req.params.studentId, ...scope },
      include: { class: true },
    });
    if (!student) return res.status(404).json({ error: 'Élève introuvable' });
    if (!isPrimaryGrade(student.class?.grade)) {
      return res.status(400).json({ error: 'Les périodes concernent uniquement les élèves du primaire' });
    }

    const [standing, results] = await Promise.all([
      prisma.midtermStanding.findUnique({
        where: { windowId_studentId: { windowId: window.id, studentId: student.id } },
      }),
      prisma.midtermResult.findMany({
        where: { windowId: window.id, studentId: student.id },
        include: { subject: { select: { id: true, name: true, code: true, sortOrder: true } } },
      }),
    ]);

    results.sort((a, b) => (a.subject?.sortOrder ?? 0) - (b.subject?.sortOrder ?? 0));

    res.json({
      window,
      student: {
        id: student.id,
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        postName: student.postName,
        class: student.class,
      },
      standing,
      subjects: results,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
