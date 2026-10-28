/** Default number of students a class can hold. Each class can set its own size. */
export const CLASS_CAPACITY = 35;

export function parseClassCapacity(value) {
  if (value == null || value === '') return CLASS_CAPACITY;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 500) {
    const err = new Error('Class size must be a whole number from 1 to 500.');
    err.status = 400;
    throw err;
  }
  return n;
}

export function capacityOf(cls) {
  const n = Number(cls?.capacity);
  return Number.isInteger(n) && n > 0 ? n : CLASS_CAPACITY;
}

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
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { capacity: true },
  });
  const capacity = capacityOf(cls);
  const count = await countClassStudents(prisma, classId, opts);
  if (count >= capacity) {
    const err = new Error(
      `This class is full (${capacity} students maximum). Transfer a student out, raise the class size, or choose another class.`,
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
  const classRows = classIds.length
    ? await prisma.class.findMany({
      where: { id: { in: classIds } },
      select: { id: true, capacity: true },
    })
    : [];
  const capacityById = new Map(classRows.map((row) => [row.id, capacityOf(row)]));
  for (const id of classIds) {
    const capacity = capacityById.get(id) ?? CLASS_CAPACITY;
    map.set(id, {
      capacity,
      students: 0,
      boys: 0,
      girls: 0,
      remaining: capacity,
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
    entry.remaining = Math.max(0, entry.capacity - entry.students);
  }
  return map;
}
