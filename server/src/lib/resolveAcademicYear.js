import { ensureDefaultClasses } from './defaultClasses.js';

/**
 * Resolve an academic year for a campus. If the given year id belongs to another
 * campus (common when Excel import maps LA RACINE A/B), find or create a year
 * with the same name on the target campus and backfill default classes.
 */
export async function resolveAcademicYearForCampus(db, campusId, academicYearId) {
  if (!campusId || !academicYearId) return null;

  const onCampus = await db.academicYear.findFirst({
    where: { id: academicYearId, campusId },
  });
  if (onCampus) return onCampus;

  const source = await db.academicYear.findUnique({ where: { id: academicYearId } });
  if (!source) return null;

  const byName = await db.academicYear.findFirst({
    where: { campusId, name: source.name },
  });
  if (byName) {
    await ensureDefaultClasses(db, campusId, byName.id);
    return byName;
  }

  const created = await db.academicYear.create({
    data: {
      campusId,
      name: source.name,
      startDate: source.startDate,
      endDate: source.endDate,
      // Keep existing active year on this campus; new year stays inactive until managers activate it
      isActive: false,
      status: source.status === 'CLOSED' ? 'ACTIVE' : (source.status || 'ACTIVE'),
    },
  });
  await ensureDefaultClasses(db, campusId, created.id);
  return created;
}
