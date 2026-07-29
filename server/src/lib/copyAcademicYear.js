export async function getCopyPreview(tx, campusId, sourceYearId) {
  const [teachers, classes, subjects] = await Promise.all([
    tx.teacher.count({ where: { campusId, academicYearId: sourceYearId } }),
    tx.class.count({ where: { campusId, academicYearId: sourceYearId } }),
    tx.subject.count({
      where: { campusId, class: { academicYearId: sourceYearId } },
    }),
  ]);
  return { teachers, classes, subjects };
}

export async function copyAcademicYearRecords(tx, {
  campusId,
  sourceYearId,
  targetYearId,
  copyTeachers = false,
  copyClasses = false,
  copySubjects = false,
}) {
  const stats = { teachers: 0, classes: 0, subjects: 0, usersRelinked: 0 };
  const teacherIdMap = new Map();
  const classIdMap = new Map();

  if (copyTeachers) {
    const teachers = await tx.teacher.findMany({
      where: { campusId, academicYearId: sourceYearId },
      orderBy: { name: 'asc' },
    });
    for (const t of teachers) {
      const created = await tx.teacher.create({
        data: {
          campusId,
          academicYearId: targetYearId,
          name: t.name,
          email: t.email,
          phone: t.phone,
          subject: t.subject,
        },
      });
      teacherIdMap.set(t.id, created.id);
      stats.teachers += 1;
    }
  }

  if (copyClasses) {
    const classes = await tx.class.findMany({
      where: { campusId, academicYearId: sourceYearId },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }],
    });
    for (const c of classes) {
      const newTeacherId = c.teacherId ? teacherIdMap.get(c.teacherId) ?? null : null;
      const created = await tx.class.create({
        data: {
          campusId,
          academicYearId: targetYearId,
          name: c.name,
          grade: c.grade,
          section: c.section,
          teacherId: newTeacherId,
        },
      });
      classIdMap.set(c.id, created.id);
      stats.classes += 1;
    }
  }

  if (copySubjects && copyClasses) {
    const subjects = await tx.subject.findMany({
      where: { campusId, class: { academicYearId: sourceYearId } },
      orderBy: { name: 'asc' },
    });
    for (const s of subjects) {
      const newClassId = classIdMap.get(s.classId);
      if (!newClassId) continue;
      const newTeacherId = s.teacherId ? teacherIdMap.get(s.teacherId) ?? null : null;
      await tx.subject.create({
        data: {
          campusId,
          name: s.name,
          code: s.code,
          classId: newClassId,
          teacherId: newTeacherId,
          periodsPerWeek: s.periodsPerWeek,
        },
      });
      stats.subjects += 1;
    }
  }

  return stats;
}
