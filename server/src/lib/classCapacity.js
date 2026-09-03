/** Hard cap on students assigned to a class (non-rejected). */
export const CLASS_CAPACITY = 35;

const ENROLLED_STATUS = { not: 'REJECTED' };

/**
 * Count students currently assigned to a class (excludes rejected registrations).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} classId
 * @param {{ excludeStudentId?: string }} [opts]
 */
export async function countClassStudents(prisma, classId, opts = {}) {
  if (!classId) return 0;
  return prisma.student.count({
    where: {
      classId,
      registrationStatus: ENROLLED_STATUS,
      ...(opts.excludeStudentId ? { NOT: { id: opts.excludeStudentId } } : {}),
    },
  });
}

/**
 * Throw 400 if assigning another student would exceed CLASS_CAPACITY.
 * Pass excludeStudentId when moving an already-enrolled student within the same class (no-op)
 * or when re-counting after removing them from the destination count.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string|null|undefined} classId
 * @param {{ excludeStudentId?: string }} [opts]
 */
export async function assertClassHasSeat(prisma, classId, opts = {}) {
  if (!classId) return;
  const count = await countClassStudents(prisma, classId, opts);
  if (count >= CLASS_CAPACITY) {
    const err = new Error(
      `This class is full (${CLASS_CAPACITY} students maximum). Transfer a student out or choose another class.`,
    );
    err.status = 400;
    err.code = 'CLASS_FULL';
    throw err;
  }
}

/**
 * Build boys/girls/remaining stats for many classes in one query.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string[]} classIds
 * @returns {Promise<Map<string, { students: number, boys: number, girls: number, remaining: number, capacity: number }>>}
 */
export async function getClassEnrollmentStats(prisma, classIds) {
  const map = new Map();
  for (const id of classIds) {
    map.set(id, {
      capacity: CLASS_CAPACITY,
      students: 0,
      boys: 0,
      girls: 0,
      remaining: CLASS_CAPACITY,
    });
  }
  if (!classIds.length) return map;

  const rows = await prisma.student.groupBy({
    by: ['classId', 'gender'],
    where: {
      classId: { in: classIds },
      registrationStatus: ENROLLED_STATUS,
    },
    _count: { _all: true },
  });

  for (const row of rows) {
    if (!row.classId || !map.has(row.classId)) continue;
    const entry = map.get(row.classId);
    const n = row._count._all;
    entry.students += n;
    if (row.gender === 'MALE') entry.boys += n;
    if (row.gender === 'FEMALE') entry.girls += n;
  }

  for (const entry of map.values()) {
    entry.remaining = Math.max(0, CLASS_CAPACITY - entry.students);
  }
  return map;
}
