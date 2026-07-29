import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureYearForCampus(campus) {
  let year = await prisma.academicYear.findFirst({
    where: { campusId: campus.id, isActive: true },
  });

  if (!year) {
    year = await prisma.academicYear.findFirst({
      where: { campusId: campus.id },
      orderBy: { startDate: 'desc' },
    });
  }

  if (!year) {
    year = await prisma.academicYear.create({
      data: {
        campusId: campus.id,
        name: '2025-2026',
        startDate: new Date('2025-09-01'),
        isActive: true,
        status: 'ACTIVE',
      },
    });
    console.log(`Created academic year ${year.name} for ${campus.name}`);
  } else if (!year.isActive) {
    year = await prisma.academicYear.update({
      where: { id: year.id },
      data: { isActive: true, status: 'ACTIVE' },
    });
  }

  await prisma.teacher.updateMany({
    where: { campusId: campus.id, academicYearId: null },
    data: { academicYearId: year.id },
  });
  await prisma.class.updateMany({
    where: { campusId: campus.id, academicYearId: null },
    data: { academicYearId: year.id },
  });
  await prisma.student.updateMany({
    where: { campusId: campus.id, academicYearId: null },
    data: { academicYearId: year.id },
  });

  return year;
}

async function main() {
  const campuses = await prisma.campus.findMany();
  for (const campus of campuses) {
    await ensureYearForCampus(campus);
  }
  console.log('Academic year backfill complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
