import { applyCurriculumToClass } from './curriculum.js';

export const DEFAULT_CLASS_LEVELS = [
  { grade: 'CRECHE', name: 'Crèche', section: 'A' },
  { grade: 'N1', name: '1ère année Maternelle / Nursery 1', section: 'A' },
  { grade: 'N2', name: '2ème année Maternelle / Nursery 2', section: 'A' },
  { grade: 'N3', name: '3ème année Maternelle / Nursery 3', section: 'A' },
  { grade: 'TOP', name: 'Top Class', section: 'A' },
  { grade: 'P1', name: '1ère année Primaire / Primary 1', section: 'A' },
  { grade: 'P2', name: '2ème année Primaire / Primary 2', section: 'A' },
  { grade: 'P3', name: '3ème année Primaire / Primary 3', section: 'A' },
  { grade: 'P4', name: '4ème année Primaire / Primary 4', section: 'A' },
  { grade: 'P5', name: '5ème année Primaire / Primary 5', section: 'A' },
  { grade: 'P6', name: '6ème année Primaire / Primary 6', section: 'A' },
];

export async function ensureDefaultClasses(db, campusId, academicYearId) {
  const existing = await db.class.findMany({
    where: { campusId, academicYearId },
    select: { id: true, grade: true, section: true },
  });
  const existingKeys = new Set(existing.map((c) => `${c.grade}:${c.section}`));

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
      bulletinConfig: ['CRECHE', 'N1', 'N2', 'N3', 'TOP'].includes(lvl.grade)
        ? { preset: 'NURSERY' }
        : { preset: 'STANDARD' },
    })),
  });

  const newClasses = await db.class.findMany({
    where: {
      campusId,
      academicYearId,
      grade: { in: toCreate.map((l) => l.grade) },
      section: 'A',
    },
    select: { id: true, grade: true },
  });

  for (const cls of newClasses) {
    await applyCurriculumToClass(db, campusId, cls.id, cls.grade);
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
