import prisma from './prisma.js';
import {
  CAMPUS_SCOPE_KEY,
  DEFAULT_PERIOD_DEFINITIONS,
  computePeriodTimes,
  normalizeTime,
  scopeKeyForClass,
  serializeTemplate,
  validatePeriodDefinitions,
} from './timetableTemplate.js';

function sortPeriods(periods) {
  return [...periods].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function findTemplateRecord(campusId, academicYearId, scopeKey) {
  return prisma.timetableTemplate.findUnique({
    where: {
      campusId_academicYearId_scopeKey: {
        campusId,
        academicYearId,
        scopeKey,
      },
    },
    include: { periods: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function resolveTimetableTemplate(campusId, academicYearId, classId) {
  if (classId) {
    const classTemplate = await findTemplateRecord(campusId, academicYearId, scopeKeyForClass(classId));
    if (classTemplate) {
      return {
        source: 'class',
        ...serializeTemplate(classTemplate, sortPeriods(classTemplate.periods)),
      };
    }
  }

  const campusTemplate = await findTemplateRecord(campusId, academicYearId, CAMPUS_SCOPE_KEY);
  if (campusTemplate) {
    return {
      source: classId ? 'campus' : 'campus',
      inheritedFromCampus: Boolean(classId),
      ...serializeTemplate(campusTemplate, sortPeriods(campusTemplate.periods)),
    };
  }

  const virtual = {
    id: null,
    campusId,
    academicYearId,
    classId: classId || null,
    scopeKey: classId ? scopeKeyForClass(classId) : CAMPUS_SCOPE_KEY,
    dayStartTime: '07:30',
  };
  const virtualPeriods = DEFAULT_PERIOD_DEFINITIONS.map((p, i) => ({ ...p, sortOrder: i }));
  return {
    source: 'default',
    inheritedFromCampus: false,
    isCampusDefault: !classId,
    ...serializeTemplate(virtual, virtualPeriods),
  };
}

export async function saveTimetableTemplate(campusId, academicYearId, { classId, dayStartTime, periods }) {
  validatePeriodDefinitions(periods);
  const scopeKey = scopeKeyForClass(classId || null);
  const normalizedStart = normalizeTime(dayStartTime);

  const data = periods.map((p, index) => ({
    sortOrder: index,
    label: String(p.label).trim(),
    durationMinutes: Number(p.durationMinutes),
    isBreak: Boolean(p.isBreak),
  }));

  const existing = await findTemplateRecord(campusId, academicYearId, scopeKey);

  if (existing) {
    await prisma.timetablePeriodDef.deleteMany({ where: { templateId: existing.id } });
    const updated = await prisma.timetableTemplate.update({
      where: { id: existing.id },
      data: {
        dayStartTime: normalizedStart,
        classId: classId || null,
        periods: { create: data },
      },
      include: { periods: { orderBy: { sortOrder: 'asc' } } },
    });
    return serializeTemplate(updated, sortPeriods(updated.periods));
  }

  const created = await prisma.timetableTemplate.create({
    data: {
      campusId,
      academicYearId,
      scopeKey,
      classId: classId || null,
      dayStartTime: normalizedStart,
      periods: { create: data },
    },
    include: { periods: { orderBy: { sortOrder: 'asc' } } },
  });
  return serializeTemplate(created, sortPeriods(created.periods));
}

export async function deleteClassTemplate(campusId, academicYearId, classId) {
  const scopeKey = scopeKeyForClass(classId);
  const existing = await findTemplateRecord(campusId, academicYearId, scopeKey);
  if (!existing) return null;
  await prisma.timetableTemplate.delete({ where: { id: existing.id } });
  return { deleted: true };
}

export async function ensureCampusDefaultTemplate(campusId, academicYearId) {
  const existing = await findTemplateRecord(campusId, academicYearId, CAMPUS_SCOPE_KEY);
  if (existing) return existing;
  return saveTimetableTemplate(campusId, academicYearId, {
    classId: null,
    dayStartTime: '07:30',
    periods: DEFAULT_PERIOD_DEFINITIONS,
  });
}

export { computePeriodTimes, DEFAULT_PERIOD_DEFINITIONS };
