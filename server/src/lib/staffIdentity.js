const STAFF_ROLES = [
  'SCHOOL_MANAGER',
  'SCHOOL_ADMIN',
  'TEACHER',
  'HEAD_OF_STUDIES',
  'HEAD_OF_DISCIPLINE',
  'SECRETARY',
  'ACCOUNTANT',
  'LIBRARIAN',
];

export function normalizeIdentityNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function randomIdentityNumber() {
  const stamp = Date.now().toString().slice(-10);
  const rand = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  return `11${stamp}${rand}`.slice(0, 16);
}

export async function identityNumberTaken(prisma, number, { userId = null, teacherId = null } = {}) {
  if (!number) return false;
  const [userHit, teacherHit] = await Promise.all([
    prisma.user.findFirst({
      where: { identityNumber: number },
      select: { id: true, teacherId: true },
    }),
    prisma.teacher.findFirst({
      where: { identityNumber: number },
      select: { id: true },
    }),
  ]);

  if (userHit && userHit.id !== userId && userHit.teacherId !== teacherId) {
    return true;
  }
  if (teacherHit && teacherHit.id !== teacherId) {
    if (!userId) return true;
    const linked = await prisma.user.findFirst({
      where: { id: userId, teacherId: teacherHit.id },
      select: { id: true },
    });
    if (!linked) return true;
  }
  return false;
}

export async function generateUniqueIdentityNumber(prisma) {
  for (let i = 0; i < 20; i += 1) {
    const candidate = randomIdentityNumber();
    if (!(await identityNumberTaken(prisma, candidate))) return candidate;
  }
  throw Object.assign(new Error('Could not generate a unique identity number'), { status: 500 });
}

export async function resolveStaffIdentityNumber(prisma, incoming, { userId = null, teacherId = null } = {}) {
  const provided = normalizeIdentityNumber(incoming);
  if (provided) {
    if (provided.length < 8) {
      const err = new Error('PP / identity number must have at least 8 digits');
      err.status = 400;
      throw err;
    }
    if (await identityNumberTaken(prisma, provided, { userId, teacherId })) {
      const err = new Error('This PP / identity number is already assigned to another staff member');
      err.status = 400;
      throw err;
    }
    return provided;
  }
  return generateUniqueIdentityNumber(prisma);
}

export async function backfillStaffIdentityNumbers(prisma) {
  const users = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLES }, identityNumber: null },
    select: { id: true, teacherId: true },
  });
  for (const user of users) {
    const identityNumber = await generateUniqueIdentityNumber(prisma);
    await prisma.user.update({ where: { id: user.id }, data: { identityNumber } });
    if (user.teacherId) {
      await prisma.teacher.update({
        where: { id: user.teacherId },
        data: { identityNumber },
      }).catch(() => {});
    }
  }

  const teachers = await prisma.teacher.findMany({
    where: { identityNumber: null },
    select: { id: true },
  });
  for (const teacher of teachers) {
    const linked = await prisma.user.findFirst({
      where: { teacherId: teacher.id, identityNumber: { not: null } },
      select: { identityNumber: true },
    });
    const identityNumber = linked?.identityNumber || await generateUniqueIdentityNumber(prisma);
    await prisma.teacher.update({ where: { id: teacher.id }, data: { identityNumber } });
  }
}
