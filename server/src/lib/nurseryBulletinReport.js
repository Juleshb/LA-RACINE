import { resolveBulletinConfig } from '../config/bulletinPresets.js';
import { groupCompetenceSubjects, ensureNurseryCurriculum } from './curriculum.js';
import { loadPhotoDataUrl } from './studentRegistration.js';
import { createBulletinVerificationToken, buildVerifyUrl } from './bulletinVerification.js';
import {
  scoreToLetter,
  NURSERY_ASSESSMENT,
  NURSERY_GRADE_LABELS,
  NURSERY_TERMS,
  NURSERY_FULL_YEAR_COLUMNS,
  resolveNurseryBulletinView,
} from './nurseryGrade.js';
import { isNurseryGrade } from '../config/grades.js';

async function buildMeta(db, { campusId, academicYearId, classTeacher, issuedAt }) {
  if (!campusId) return { meta: null, academicYearName: '' };
  const [campus, school, year] = await Promise.all([
    db.campus.findUnique({ where: { id: campusId } }),
    db.schoolProfile.findFirst(),
    academicYearId ? db.academicYear.findUnique({ where: { id: academicYearId } }) : null,
  ]);
  const academicYearName = year?.name || '';
  return {
    academicYearName,
    meta: {
      schoolName: school?.name || 'École La RACINE',
      campusName: campus?.name || '',
      city: campus?.city || school?.city || '',
      district: campus?.district || school?.district || '',
      province: campus?.province || school?.province || '',
      country: campus?.country || school?.country || 'RWANDA',
      phone: school?.phone || campus?.phone || '',
      email: school?.email || '',
      website: school?.website || 'www.laracine.rw',
      academicYear: academicYearName,
      classTeacher: classTeacher || '',
      issuedAt,
    },
  };
}

/**
 * Competence-based nursery bulletin.
 * - term = Trimestre 1|2|3 → single-term bulletin
 * - term = Annuel → full-year sheet (T1 + T2 + T3 + Résultat Annuel)
 */
export async function buildNurseryBulletinReport(db, {
  classId,
  studentId,
  campusId,
  academicYearId,
  term = 'Trimestre 1',
}) {
  const view = resolveNurseryBulletinView(term);
  let cls = await db.class.findUnique({
    where: { id: classId },
    select: { id: true, grade: true, campusId: true, name: true, section: true, bulletinConfig: true },
  });
  if (!cls) throw new Error('Class not found');
  if (!isNurseryGrade(cls.grade)) {
    throw new Error('Class is not a nursery grade');
  }

  // Sync Excel template skills so every course from the bulletin appears
  await ensureNurseryCurriculum(db, campusId || cls.campusId, classId, cls.grade);

  cls = await db.class.findUnique({
    where: { id: classId },
    include: {
      students: {
        where: { id: studentId },
        take: 1,
        include: {
          documents: {
            where: { docType: 'PHOTO' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      subjects: { orderBy: [{ categoryOrder: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }] },
      teacher: { select: { name: true } },
    },
  });
  if (!cls) throw new Error('Class not found');
  const student = cls.students[0];
  if (!student) throw new Error('Student not found in this class');

  const config = resolveBulletinConfig(cls.bulletinConfig, cls.grade);
  const subjectIds = cls.subjects.map((s) => s.id);
  const marks = subjectIds.length
    ? await db.mark.findMany({
      where: {
        studentId,
        subjectId: { in: subjectIds },
        assessment: NURSERY_ASSESSMENT,
        term: { in: NURSERY_TERMS },
      },
    })
    : [];

  const markMap = new Map();
  for (const m of marks) {
    markMap.set(`${m.subjectId}:${m.term}`, m);
  }

  const letterFor = (sid, markTerm) => {
    const mark = markMap.get(`${sid}:${markTerm}`);
    return scoreToLetter(mark?.score) || null;
  };

  const grouped = groupCompetenceSubjects(cls.subjects);
  const domains = grouped.map((domain) => ({
    category: domain.category,
    categoryOrder: domain.categoryOrder,
    subdomains: domain.subdomains.map((sub) => ({
      name: sub.name,
      items: sub.items.map((subject) => ({
        id: subject.id,
        code: subject.code,
        name: subject.name,
        subcategory: subject.subcategory || sub.name || '',
        grades: {
          t1: letterFor(subject.id, 'Trimestre 1'),
          t2: letterFor(subject.id, 'Trimestre 2'),
          t3: letterFor(subject.id, 'Trimestre 3'),
          annual: letterFor(subject.id, 'Annuel'),
        },
      })),
    })),
  }));

  const columns = view.viewMode === 'FULL_YEAR'
    ? NURSERY_FULL_YEAR_COLUMNS
    : [{ key: view.gradeKey, label: view.label, term: view.value }];

  const issuedAt = new Date().toISOString();
  const { meta, academicYearName } = await buildMeta(db, {
    campusId,
    academicYearId,
    classTeacher: cls.teacher?.name || '',
    issuedAt,
  });

  const photoUrl = loadPhotoDataUrl(student.documents || []);
  const verificationToken = createBulletinVerificationToken({
    studentId: student.id,
    studentCode: student.studentId,
    classId: cls.id,
    term: view.value,
    percentage: null,
    place: null,
    totalStudents: null,
    academicYear: academicYearName,
    issuedAt,
  });

  return {
    mode: 'COMPETENCE',
    viewMode: view.viewMode,
    class: { id: cls.id, name: cls.name, grade: cls.grade, section: cls.section },
    student: {
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      postName: student.postName,
    },
    term: view.value,
    termLabel: view.label,
    columns,
    config: {
      preset: config.preset,
      label: config.label,
      mode: 'COMPETENCE',
      gradeScale: NURSERY_GRADE_LABELS,
    },
    domains,
    summary: null,
    rank: null,
    meta,
    photoUrl,
    verification: {
      token: verificationToken,
      verifyUrl: buildVerifyUrl(verificationToken),
    },
  };
}
