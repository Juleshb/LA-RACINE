import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { classScopeWhere } from '../lib/scope.js';
import { resolveTeacherId } from '../lib/teacherAccess.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { listBulletinPresets, resolveBulletinConfig } from '../config/bulletinPresets.js';
import { isNurseryGrade } from '../config/grades.js';
import { ensureDefaultClasses, classSortKey } from '../lib/defaultClasses.js';

const router = Router();

router.use(authorizePermission(PERMISSIONS.CLASSES));

router.get('/bulletin-presets', (_req, res) => {
  res.json(listBulletinPresets());
});

router.get('/:id/bulletin-config', async (req, res) => {
  try {
    const scope = await classScopeWhere(req);
    const cls = await prisma.class.findFirst({
      where: { id: req.params.id, ...scope },
      select: { id: true, name: true, grade: true, bulletinConfig: true },
    });
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    const config = resolveBulletinConfig(cls.bulletinConfig, cls.grade);
    res.json({ classId: cls.id, className: cls.name, grade: cls.grade, stored: cls.bulletinConfig, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/bulletin-config', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit bulletin settings' });
    }
    const scope = await classScopeWhere(req);
    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Class not found' });

    const { preset, assessments, terms, label } = req.body;
    let bulletinConfig = null;

    if (preset === 'CUSTOM') {
      if (!Array.isArray(assessments) || !assessments.length) {
        return res.status(400).json({ error: 'Custom bulletin requires at least one assessment' });
      }
      bulletinConfig = {
        preset: 'CUSTOM',
        label: label || 'Custom bulletin',
        assessments: assessments.map((a) => ({
          key: String(a.key || '').trim().toUpperCase(),
          label: String(a.label || a.key || '').trim(),
          maxField: a.maxField || 'custom',
          customMax: a.customMax ? Number(a.customMax) : undefined,
          fallbackMax: a.fallbackMax ? Number(a.fallbackMax) : 100,
        })),
        terms: terms?.length ? terms : undefined,
      };
    } else if (preset) {
      bulletinConfig = { preset, terms: terms?.length ? terms : undefined };
    } else {
      return res.status(400).json({ error: 'preset is required' });
    }

    const cls = await prisma.class.update({
      where: { id: req.params.id },
      data: { bulletinConfig },
      select: { id: true, name: true, grade: true, bulletinConfig: true },
    });
    const config = resolveBulletinConfig(cls.bulletinConfig, cls.grade);
    res.json({ classId: cls.id, className: cls.name, grade: cls.grade, stored: cls.bulletinConfig, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    // Align nursery/primary names & create missing official levels for the active year
    if (!['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role) && req.academicYearId) {
      await ensureDefaultClasses(prisma, req.campusId, req.academicYearId);
    }

    const allYears = String(req.query.allYears || '') === '1';
    const scope = allYears && !['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)
      ? { campusId: req.campusId }
      : await classScopeWhere(req);
    const classes = await prisma.class.findMany({
      where: scope,
      orderBy: [{ section: 'asc' }],
      include: {
        teacher: true,
        academicYear: { select: { id: true, name: true } },
        _count: { select: { students: true, subjects: true } },
      },
    });
    classes.sort((a, b) => {
      const ka = classSortKey(a.grade, a.section);
      const kb = classSortKey(b.grade, b.section);
      if (ka !== kb) return ka - kb;
      return String(a.name).localeCompare(String(b.name));
    });
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const scope = await classScopeWhere(req);
    const cls = await prisma.class.findFirst({
      where: { id: req.params.id, ...scope },
      include: {
        teacher: true,
        students: true,
        subjects: { include: { teacher: true } },
      },
    });
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    if (req.user.role === 'TEACHER') {
      const teacherId = await resolveTeacherId(req);
      const filtered = {
        ...cls,
        subjects: teacherId
          ? cls.subjects.filter((s) => s.teacherId === teacherId)
          : [],
      };
      return res.json(filtered);
    }
    res.json(cls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot create classes' });
    }

    const name = String(req.body.name || '').trim();
    let grade = String(req.body.grade || '').trim().toUpperCase();
    const section = String(req.body.section || '').trim().toUpperCase();
    const teacherId = req.body.teacherId || null;

    if (!name || !grade || !section) {
      return res.status(400).json({ error: 'Class name, grade (niveau), and section are required' });
    }

    // "Top Class" / Grande Section Top is its own level
    if (
      (/top\s*class/i.test(name) || /grande\s*section.*top/i.test(name))
      && (grade === 'N3' || grade === 'M3' || grade === 'NURSERY 3')
    ) {
      grade = 'TOP';
    }

    const duplicate = await prisma.class.findFirst({
      where: {
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        grade,
        section,
      },
      select: { id: true, name: true, grade: true, section: true },
    });
    if (duplicate) {
      const used = await prisma.class.findMany({
        where: { campusId: req.campusId, academicYearId: req.academicYearId, grade },
        select: { section: true },
      });
      const usedSections = new Set(used.map((c) => c.section));
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const suggested = [...alphabet].find((letter) => !usedSections.has(letter)) || 'Z';
      return res.status(409).json({
        error: `A class with niveau ${grade} and section ${section} already exists (“${duplicate.name}”). `
          + `Each niveau+section can only exist once per school year. `
          + `Try section ${suggested}, or edit the existing class.`,
        existingClassId: duplicate.id,
        existingClassName: duplicate.name,
        suggestedSection: suggested,
      });
    }

    const cls = await prisma.class.create({
      data: {
        name,
        grade,
        section,
        teacherId,
        campusId: req.campusId,
        academicYearId: req.academicYearId,
        bulletinConfig: isNurseryGrade(grade)
          ? { preset: 'COMPETENCE' }
          : { preset: 'STANDARD' },
      },
      include: { teacher: true },
    });
    res.status(201).json(cls);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        error: 'A class with this niveau and section already exists for this school year. Use a different section or edit the existing class.',
      });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (['TEACHER', 'PARENT', 'STUDENT'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot edit classes' });
    }
    const scope = await classScopeWhere(req);
    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Class not found' });

    const { campusId: _c, academicYearId: _y, ...raw } = req.body;
    const data = { ...raw };
    if (data.name != null) data.name = String(data.name).trim();
    if (data.grade != null) data.grade = String(data.grade).trim().toUpperCase();
    if (data.section != null) data.section = String(data.section).trim().toUpperCase();
    if (data.teacherId === '') data.teacherId = null;

    if (data.name && (/top\s*class/i.test(data.name) || /grande\s*section.*top/i.test(data.name))
      && (data.grade === 'N3' || data.grade === 'M3' || data.grade === 'NURSERY 3')) {
      data.grade = 'TOP';
    }

    const nextGrade = data.grade ?? existing.grade;
    const nextSection = data.section ?? existing.section;
    const conflict = await prisma.class.findFirst({
      where: {
        campusId: existing.campusId,
        academicYearId: existing.academicYearId,
        grade: nextGrade,
        section: nextSection,
        NOT: { id: existing.id },
      },
      select: { id: true, name: true },
    });
    if (conflict) {
      return res.status(409).json({
        error: `Another class already uses niveau ${nextGrade} section ${nextSection} (“${conflict.name}”). Choose a different section.`,
        existingClassId: conflict.id,
        existingClassName: conflict.name,
      });
    }

    const cls = await prisma.class.update({
      where: { id: req.params.id },
      data,
      include: { teacher: true },
    });
    res.json(cls);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        error: 'A class with this niveau and section already exists for this school year.',
      });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!['SCHOOL_MANAGER','SCHOOL_ADMIN','SECRETARY'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot delete classes' });
    }
    const scope = await classScopeWhere(req);
    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, ...scope },
    });
    if (!existing) return res.status(404).json({ error: 'Class not found' });
    await prisma.class.delete({ where: { id: req.params.id } });
    res.json({ message: 'Class deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
