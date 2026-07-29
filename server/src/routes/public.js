import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { getWebsitePagesForLocale } from '../lib/websiteCms.js';
import { normalizeLocale, WEBSITE_LOCALES } from '../lib/websiteLocales.js';

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

export default router;
