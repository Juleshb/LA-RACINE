import { applyCurriculumToClass } from './curriculum.js';
import { usesNurseryCompetence } from '../config/grades.js';

/**
 * Official La Racine class list (nursery + primary).
 * From school "Classes (Liste)" document.
 */
export const DEFAULT_CLASS_LEVELS = [
  { grade: 'M1', name: 'Petite Section (PS)/M1', section: 'A' },
  { grade: 'M2', name: 'Moyenne Section/M2', section: 'A' },
  { grade: 'M2', name: 'Moyenne Section/M2 (Middle class)', section: 'B' },
  { grade: 'M3', name: 'Grande Section/M3', section: 'A' },
  { grade: 'TOP', name: 'Grande Section/M3 (Top class)', section: 'A' },
  { grade: 'P1', name: 'CP/P1', section: 'A' },
  { grade: 'P2', name: 'CE1/P2', section: 'A' },
  { grade: 'P3', name: 'CE2/P3', section: 'A' },
  { grade: 'P4', name: 'CM1/P4', section: 'A' },
  { grade: 'P5', name: 'CM2/P5', section: 'A' },
  { grade: 'P6', name: '6ème année/P6', section: 'A' },
];

/** Legacy grade codes → new grade (section stays unless overridden). */
const LEGACY_GRADE_MAP = {
  N1: { grade: 'M1', section: 'A' },
  N2: { grade: 'M2', section: 'A' },
  N3: { grade: 'M3', section: 'A' },
  // TOP stays TOP (Top class under Grande Section)
  // CRECHE kept for legacy records; not in official list
};

const NAME_BY_KEY = new Map(
  DEFAULT_CLASS_LEVELS.map((l) => [`${l.grade}:${l.section}`, l.name]),
);

export function officialClassName(grade, section = 'A') {
  return NAME_BY_KEY.get(`${grade}:${section}`) || null;
}

export function classSortKey(grade, section = 'A') {
  const idx = DEFAULT_CLASS_LEVELS.findIndex(
    (l) => l.grade === grade && l.section === (section || 'A'),
  );
  if (idx >= 0) return idx;
  const legacy = ['CRECHE', 'N1', 'N2', 'N3', 'TOP'];
  const li = legacy.indexOf(grade);
  if (li >= 0) return li;
  return 100 + String(grade || '').charCodeAt(0);
}

async function migrateLegacyGrades(db, campusId, academicYearId) {
  const classes = await db.class.findMany({
    where: { campusId, academicYearId },
    select: { id: true, grade: true, section: true, name: true },
  });

  let migrated = 0;
  for (const cls of classes) {
    const map = LEGACY_GRADE_MAP[cls.grade];
    if (!map) continue;

    const targetSection = map.section || cls.section || 'A';
    const conflict = await db.class.findFirst({
      where: {
        campusId,
        academicYearId,
        grade: map.grade,
        section: targetSection,
        NOT: { id: cls.id },
      },
      select: { id: true },
    });
    if (conflict) continue;

    const name = officialClassName(map.grade, targetSection) || cls.name;
    await db.class.update({
      where: { id: cls.id },
      data: {
        grade: map.grade,
        section: targetSection,
        name,
        bulletinConfig: usesNurseryCompetence(map.grade)
          ? { preset: 'COMPETENCE' }
          : { preset: 'STANDARD' },
      },
    });
    migrated += 1;
  }
  return migrated;
}

async function syncOfficialNames(db, campusId, academicYearId) {
  const classes = await db.class.findMany({
    where: { campusId, academicYearId },
    select: { id: true, grade: true, section: true, name: true },
  });
  let updated = 0;
  for (const cls of classes) {
    const section = cls.section || 'A';
    const name = officialClassName(cls.grade, section);
    if (!name || name === cls.name) continue;
    await db.class.update({
      where: { id: cls.id },
      data: { name },
    });
    updated += 1;
  }
  return updated;
}

export async function ensureDefaultClasses(db, campusId, academicYearId) {
  await migrateLegacyGrades(db, campusId, academicYearId);
  await syncOfficialNames(db, campusId, academicYearId);

  const existing = await db.class.findMany({
    where: { campusId, academicYearId },
    select: { id: true, grade: true, section: true },
  });
  const existingKeys = new Set(existing.map((c) => `${c.grade}:${c.section || 'A'}`));

  const toCreate = DEFAULT_CLASS_LEVELS.filter(
    (lvl) => !existingKeys.has(`${lvl.grade}:${lvl.section}`),
  );
  if (!toCreate.length) return 0;

  await db.class.createMany({
    data: toCreate.map((lvl) => ({
      campusId,
      academicYearId,
      name: lvl.name,
      grade: lvl.grade,
      section: lvl.section,
      bulletinConfig: usesNurseryCompetence(lvl.grade)
        ? { preset: 'COMPETENCE' }
        : { preset: 'STANDARD' },
    })),
  });

  const newClasses = await db.class.findMany({
    where: {
      campusId,
      academicYearId,
      OR: toCreate.map((l) => ({ grade: l.grade, section: l.section })),
    },
    select: { id: true, grade: true },
  });

  for (const cls of newClasses) {
    try {
      await applyCurriculumToClass(db, campusId, cls.id, cls.grade);
    } catch (err) {
      console.warn(`Curriculum apply skipped for ${cls.grade} (${cls.id}): ${err.message}`);
    }
  }

  return toCreate.length;
}

export async function ensureDefaultClassesForCampus(db, campusId) {
  const years = await db.academicYear.findMany({
    where: { campusId },
    select: { id: true },
  });
  let total = 0;
  for (const year of years) {
    total += await ensureDefaultClasses(db, campusId, year.id);
  }
  return total;
}

/**
 * Find class by grade+section for a year, or create it (used by Excel import).
 */
export async function resolveOrCreateClass(
  db,
  campusId,
  academicYearId,
  gradeInput,
  sectionInput = 'A',
  nameHint = '',
) {
  let grade = String(gradeInput || '').trim().toUpperCase();
  let section = String(sectionInput || 'A').trim().toUpperCase() || 'A';
  if (!grade) return null;

  const legacy = LEGACY_GRADE_MAP[grade];
  if (legacy) {
    grade = legacy.grade;
    section = legacy.section || section;
  }

  let cls = await db.class.findFirst({
    where: { campusId, academicYearId, grade, section },
  });
  if (cls) return cls;

  const level = DEFAULT_CLASS_LEVELS.find((l) => l.grade === grade && l.section === section)
    || DEFAULT_CLASS_LEVELS.find((l) => l.grade === grade);
  const baseName = String(nameHint || '').trim()
    || officialClassName(grade, section)
    || level?.name
    || grade;
  const name = section === 'A' || officialClassName(grade, section)
    ? (officialClassName(grade, section) || baseName)
    : `${baseName} (${section})`;

  cls = await db.class.create({
    data: {
      campusId,
      academicYearId,
      name,
      grade,
      section,
      bulletinConfig: usesNurseryCompetence(grade)
        ? { preset: 'COMPETENCE' }
        : { preset: 'STANDARD' },
    },
  });

  try {
    await applyCurriculumToClass(db, campusId, cls.id, grade);
  } catch {
    // Curriculum is best-effort for import-created classes
  }

  return cls;
}
