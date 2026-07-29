import { getCurriculum } from '../config/curriculum/index.js';

export async function applyCurriculumToClass(db, campusId, classId, grade) {
  const cls = await db.class.findFirst({
    where: { id: classId, campusId },
    select: { id: true, grade: true, name: true },
  });
  if (!cls) {
    throw new Error('Class not found');
  }

  const resolvedGrade = grade || cls.grade;
  const curriculum = getCurriculum(resolvedGrade);
  if (!curriculum) {
    throw new Error(`No bulletin curriculum for grade ${resolvedGrade}`);
  }

  const existing = await db.subject.findMany({
    where: { classId },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((s) => s.code));

  const toCreate = [];
  for (const domain of curriculum.domains) {
    domain.subjects.forEach((sub, index) => {
      if (existingCodes.has(sub.code)) return;
      toCreate.push({
        campusId,
        classId,
        name: sub.name,
        code: sub.code,
        category: domain.name,
        categoryOrder: domain.order,
        sortOrder: index + 1,
        test1Max: sub.test1Max,
        test2Max: sub.test2Max,
        examMax: sub.examMax,
        totalMax: sub.totalMax,
        periodsPerWeek: 1,
      });
    });
  }

  if (!toCreate.length) {
    return {
      created: 0,
      skipped: existing.length,
      grade: resolvedGrade,
      className: cls.name,
      grandTotalMax: curriculum.grandTotalMax,
    };
  }

  await db.subject.createMany({ data: toCreate });
  return {
    created: toCreate.length,
    skipped: existing.length,
    grade: resolvedGrade,
    className: cls.name,
    grandTotalMax: curriculum.grandTotalMax,
  };
}

export async function applyCurriculumToAllClasses(db, campusId, academicYearId) {
  const classes = await db.class.findMany({
    where: { campusId, academicYearId },
    orderBy: [{ grade: 'asc' }],
    select: { id: true, grade: true, name: true },
  });

  const results = [];
  let totalCreated = 0;

  for (const cls of classes) {
    const result = await applyCurriculumToClass(db, campusId, cls.id, cls.grade);
    results.push(result);
    totalCreated += result.created;
  }

  return {
    classes: results.length,
    totalCreated,
    results,
  };
}

export function groupCoursesByCategory(courses) {
  const groups = new Map();
  for (const course of courses) {
    const key = course.category || 'OTHER';
    if (!groups.has(key)) {
      groups.set(key, {
        category: key,
        categoryOrder: course.categoryOrder || 999,
        courses: [],
        domainTotalMax: 0,
      });
    }
    const group = groups.get(key);
    group.courses.push(course);
    group.domainTotalMax += course.totalMax || 0;
  }
  return Array.from(groups.values())
    .sort((a, b) => a.categoryOrder - b.categoryOrder)
    .map((g) => ({
      ...g,
      courses: g.courses.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    }));
}
