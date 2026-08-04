import { getCurriculum } from '../config/curriculum/index.js';

export async function applyCurriculumToClass(db, campusId, classId, grade) {
  const cls = await db.class.findFirst({
    where: { id: classId, campusId },
    select: { id: true, grade: true, name: true },
  });
  if (!cls) {
    throw new Error('Class not found');
  }

  const resolvedGrade = String(grade || cls.grade || '').trim().toUpperCase();
  const curriculum = getCurriculum(resolvedGrade);
  if (!curriculum) {
    throw new Error(
      `No bulletin curriculum for grade ${resolvedGrade}. `
      + 'Expected nursery M1/M2/M3/TOP (or legacy N1/N2/N3) or primary P1–P6.',
    );
  }

  const existing = await db.subject.findMany({
    where: { classId },
    select: { id: true, code: true, name: true, category: true, subcategory: true, categoryOrder: true, sortOrder: true },
  });
  const existingByCode = new Map(existing.map((s) => [s.code, s]));
  const isCompetence = curriculum.mode === 'COMPETENCE';

  const desiredCodes = new Set();
  const toCreate = [];
  const toUpdate = [];

  for (const domain of curriculum.domains) {
    domain.subjects.forEach((sub, index) => {
      desiredCodes.add(sub.code);
      const sortOrder = sub.sortOrder || index + 1;
      const payload = {
        name: sub.name,
        category: domain.name,
        categoryOrder: domain.order,
        sortOrder,
        subcategory: sub.subcategory || null,
        test1Max: isCompetence ? null : sub.test1Max,
        test2Max: isCompetence ? null : sub.test2Max,
        examMax: isCompetence ? null : sub.examMax,
        totalMax: isCompetence ? null : sub.totalMax,
      };
      const current = existingByCode.get(sub.code);
      if (!current) {
        toCreate.push({
          campusId,
          classId,
          code: sub.code,
          periodsPerWeek: 1,
          ...payload,
        });
        return;
      }
      if (
        current.name !== payload.name
        || current.category !== payload.category
        || (current.subcategory || null) !== payload.subcategory
        || current.categoryOrder !== payload.categoryOrder
        || current.sortOrder !== payload.sortOrder
      ) {
        toUpdate.push({ id: current.id, data: payload });
      }
    });
  }

  // For competence nursery curricula, remove obsolete numeric/old skill subjects
  let removed = 0;
  if (isCompetence) {
    const obsoleteIds = existing.filter((s) => !desiredCodes.has(s.code)).map((s) => s.id);
    if (obsoleteIds.length) {
      await db.subject.deleteMany({ where: { id: { in: obsoleteIds } } });
      removed = obsoleteIds.length;
    }
  }

  for (const row of toUpdate) {
    await db.subject.update({ where: { id: row.id }, data: row.data });
  }

  if (toCreate.length) {
    await db.subject.createMany({ data: toCreate });
  }

  return {
    created: toCreate.length,
    updated: toUpdate.length,
    removed,
    skipped: existing.length - removed,
    grade: resolvedGrade,
    className: cls.name,
    grandTotalMax: curriculum.grandTotalMax,
    mode: curriculum.mode || 'NUMERIC',
    expectedSubjects: desiredCodes.size,
  };
}

/** Ensure nursery class subjects match Excel competence templates. */
export async function ensureNurseryCurriculum(db, campusId, classId, grade) {
  const curriculum = getCurriculum(grade);
  if (!curriculum || curriculum.mode !== 'COMPETENCE') {
    return null;
  }
  return applyCurriculumToClass(db, campusId, classId, grade);
}

export async function applyCurriculumToAllClasses(db, campusId, academicYearId) {
  const classes = await db.class.findMany({
    where: { campusId, academicYearId },
    orderBy: [{ grade: 'asc' }],
    select: { id: true, grade: true, name: true },
  });

  const results = [];
  let totalCreated = 0;
  const skipped = [];

  for (const cls of classes) {
    try {
      const result = await applyCurriculumToClass(db, campusId, cls.id, cls.grade);
      results.push(result);
      totalCreated += result.created;
    } catch (err) {
      skipped.push({ classId: cls.id, grade: cls.grade, name: cls.name, error: err.message });
      console.warn(`Skipping curriculum for ${cls.name} (${cls.grade}): ${err.message}`);
    }
  }

  return {
    classes: results.length,
    totalCreated,
    skipped,
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

/** Group nursery competence subjects by domain then subcategory for bulletin layout. */
export function groupCompetenceSubjects(subjects) {
  const domains = [];
  const domainMap = new Map();

  const sorted = [...subjects].sort(
    (a, b) => (a.categoryOrder || 0) - (b.categoryOrder || 0)
      || (a.sortOrder || 0) - (b.sortOrder || 0)
      || String(a.name).localeCompare(String(b.name)),
  );

  for (const subject of sorted) {
    const domainKey = subject.category || 'OTHER';
    if (!domainMap.has(domainKey)) {
      const domain = {
        category: domainKey,
        categoryOrder: subject.categoryOrder || 999,
        subdomains: [],
        _subMap: new Map(),
      };
      domainMap.set(domainKey, domain);
      domains.push(domain);
    }
    const domain = domainMap.get(domainKey);
    const subKey = subject.subcategory || '';
    if (!domain._subMap.has(subKey)) {
      const sub = { name: subKey, items: [] };
      domain._subMap.set(subKey, sub);
      domain.subdomains.push(sub);
    }
    domain._subMap.get(subKey).items.push(subject);
  }

  return domains.map(({ _subMap, ...domain }) => domain);
}
