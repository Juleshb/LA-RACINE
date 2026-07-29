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

export function formatGradingScale(course) {
  if (!course?.totalMax) return null;
  return `T1/${course.test1Max} · T2/${course.test2Max} · EX/${course.examMax} · Total/${course.totalMax}`;
}
