import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { getWebsitePagesForLocale } from '../lib/websiteCms.js';
import { normalizeLocale, WEBSITE_LOCALES } from '../lib/websiteLocales.js';
import { getFormOptions } from '../config/registration.js';
import { createStudentRegistration } from '../lib/createRegistration.js';
import { dayKey, emailStatusSubscription, isoDay, runStatusCheck } from '../lib/statusMonitor.js';

const router = Router();

const FALLBACK_SCHOOL = {
  name: 'École La RACINE',
  abbreviation: 'LRS',
  country: 'RWANDA',
  province: 'WESTERN',
  district: 'RUBAVU',
  city: 'GISENYI',
  email: 'laracineschool@gmail.com',
  phone1: '0789028283',
  phone2: '0792445913',
  website: 'laracineschool.rw',
};

/** Simple in-memory rate limit for public registration (per IP). */
const registrationHits = new Map();
function allowPublicRegistration(ip) {
  const key = String(ip || 'unknown');
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const recent = (registrationHits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= 8) {
    registrationHits.set(key, recent);
    return false;
  }
  recent.push(now);
  registrationHits.set(key, recent);
  return true;
}

async function loadSchoolAndCampuses() {
  const [school, campuses] = await Promise.all([
    prisma.schoolProfile.findFirst(),
    prisma.campus.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        district: true,
        province: true,
        country: true,
        address: true,
        phone: true,
        email: true,
      },
    }),
  ]);

  return {
    school: school
      ? {
          name: school.name,
          abbreviation: school.abbreviation,
          country: school.country,
          province: school.province,
          district: school.district,
          city: school.city,
          email: school.email,
          phone1: school.phone1,
          phone2: school.phone2,
          website: school.website,
        }
      : FALLBACK_SCHOOL,
    campuses,
    motto: 'Discipline · Intelligence · Innovation',
  };
}

router.get('/school', async (_req, res) => {
  try {
    const base = await loadSchoolAndCampuses();
    res.json(base);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/site', async (req, res) => {
  try {
    const locale = normalizeLocale(req.query.locale);
    const [base, content] = await Promise.all([
      loadSchoolAndCampuses(),
      getWebsitePagesForLocale(locale),
    ]);
    res.json({
      ...base,
      locale: content.locale,
      pages: content.pages,
      locales: WEBSITE_LOCALES,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Public registration form options for a campus (no auth). */
router.get('/registration/options', async (req, res) => {
  try {
    const campusId = String(req.query.campusId || '').trim();
    if (!campusId) {
      return res.status(400).json({ error: 'campusId is required' });
    }

    const campus = await prisma.campus.findFirst({
      where: { id: campusId, isActive: true },
      select: { id: true, name: true, code: true, city: true },
    });
    if (!campus) {
      return res.status(404).json({ error: 'Campus not found or inactive' });
    }

    const [academicYears, classes] = await Promise.all([
      prisma.academicYear.findMany({
        where: { campusId },
        orderBy: { startDate: 'desc' },
        select: { id: true, name: true, isActive: true, status: true },
      }),
      prisma.class.findMany({
        where: { campusId },
        orderBy: [{ grade: 'asc' }, { section: 'asc' }],
        select: { id: true, name: true, grade: true, section: true, academicYearId: true },
      }),
    ]);

    res.json({
      campus,
      ...getFormOptions(),
      academicYears,
      classes,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Public online admission — no account required. */
router.post('/registration', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';
    if (!allowPublicRegistration(ip)) {
      return res.status(429).json({
        error: 'Too many registration attempts. Please wait a few minutes and try again, or contact the school office.',
      });
    }

    // Honeypot — bots fill this; humans never see it
    if (req.body?.website || req.body?.company) {
      return res.status(201).json({
        message: 'Registration submitted successfully. The school will review your application.',
        studentId: 'PENDING',
      });
    }

    const campusId = String(req.body?.campusId || '').trim();
    if (!campusId) {
      return res.status(400).json({ error: 'Please select a campus' });
    }

    const campus = await prisma.campus.findFirst({
      where: { id: campusId, isActive: true },
      select: { id: true, name: true },
    });
    if (!campus) {
      return res.status(400).json({ error: 'Selected campus is not available' });
    }

    const { campusId: _ignored, website: _w, company: _c, ...body } = req.body || {};

    const { student, documents } = await createStudentRegistration({
      campusId,
      body,
      parentId: null,
      parentSubmitted: true,
      studentInclude: {
        class: { select: { id: true, name: true, grade: true, section: true } },
        academicYear: { select: { id: true, name: true } },
        campus: { select: { id: true, name: true, code: true } },
      },
    });

    res.status(201).json({
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      postName: student.postName,
      registrationStatus: student.registrationStatus,
      campus: student.campus,
      class: student.class,
      academicYear: student.academicYear,
      documents: (documents || []).map((d) => ({ id: d.id, docType: d.docType, fileName: d.fileName })),
      message: 'Registration submitted successfully. The school will review your application. Keep your student reference number for follow-up.',
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/status', async (_req, res) => {
  try {
    const checks = await runStatusCheck();

    const since = dayKey(new Date());
    since.setDate(since.getDate() - 89);
    const samples = await prisma.statusSample.findMany({
      where: { day: { gte: since } },
      select: { service: true, day: true, status: true },
    });
    const byService = new Map();
    samples.forEach((sample) => {
      const list = byService.get(sample.service) || [];
      list.push(sample);
      byService.set(sample.service, list);
    });

    const days = Array.from({ length: 90 }, (_, index) => {
      const date = new Date(since);
      date.setDate(since.getDate() + index);
      return isoDay(date);
    });

    const groups = [
      { id: 'website', en: 'School website', fr: 'Site de l’école' },
      { id: 'portal', en: 'School portal', fr: 'Portail de l’école' },
      { id: 'platform', en: 'Platform', fr: 'Plateforme' },
    ].map((group) => ({
      ...group,
      components: checks.filter((item) => item.group === group.id).map((item) => {
        const history = new Map((byService.get(item.id) || []).map((sample) => [isoDay(sample.day), sample.status]));
        const recorded = days.filter((day) => history.has(day));
        const healthy = recorded.filter((day) => history.get(day) === 'up').length;
        return {
          id: item.id,
          en: item.en,
          fr: item.fr,
          status: item.status,
          latencyMs: item.latencyMs,
          uptime: recorded.length ? Math.round((healthy / recorded.length) * 1000) / 10 : null,
          recordedDays: recorded.length,
          days: days.map((day) => ({ day, status: history.get(day) || 'unknown' })),
        };
      }),
    }));

    const failing = checks.filter((item) => item.status !== 'up');
    const overall = failing.some((item) => item.status === 'down')
      ? 'outage'
      : failing.length
        ? 'degraded'
        : 'operational';

    res.json({
      updatedAt: new Date().toISOString(),
      overall,
      incidents: failing.map((item) => ({
        id: item.id,
        en: item.status === 'down'
          ? `${item.en} is unavailable`
          : `${item.en} is slow`,
        fr: item.status === 'down'
          ? `${item.fr} est indisponible`
          : `${item.fr} répond lentement`,
        detailEn: item.status === 'down'
          ? 'The latest check could not complete. The school team can see this on the status page.'
          : `The latest check took ${item.latencyMs} ms.`,
        detailFr: item.status === 'down'
          ? 'La dernière vérification n’a pas abouti. L’équipe de l’école voit cette note sur la page d’état.'
          : `La dernière vérification a pris ${item.latencyMs} ms.`,
        state: item.status === 'down' ? 'identified' : 'monitoring',
      })),
      groups,
    });
  } catch (error) {
    res.status(500).json({ error: 'Status checks are unavailable right now.' });
  }
});

router.post('/status/subscribe', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    await prisma.statusSubscriber.upsert({
      where: { email },
      update: {},
      create: { email },
    });
    try {
      await emailStatusSubscription(email);
      res.json({ ok: true, mailed: true });
    } catch (error) {
      console.error(`Status subscription email was not sent: ${error.message}`);
      res.json({ ok: true, mailed: false });
    }
  } catch {
    res.status(500).json({ error: 'The subscription could not be saved.' });
  }
});

export default router;
