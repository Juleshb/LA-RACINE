import prisma from './prisma.js';
import {
  generateStudentId,
  buildStudentData,
  saveDocuments,
} from './studentRegistration.js';
import { resolveOrCreateClass } from './defaultClasses.js';
import { resolveAcademicYearForCampus } from './resolveAcademicYear.js';

export function validateRegistrationPayload(body, { requireDocuments = true } = {}) {
  const {
    documents,
    classId,
    academicYearId: bodyAcademicYearId,
    ...rest
  } = body;

  if (!rest.lastName || !rest.postName || !rest.gender || !rest.dateOfBirth || !rest.nationality) {
    return { error: 'Child details (name, sex, date of birth, nationality) are required' };
  }
  if (!rest.fatherName || !rest.fatherPhone || !rest.motherName || !rest.motherPhone) {
    return { error: 'Father and mother names and phone numbers are required' };
  }
  if (!rest.province || !rest.district || !rest.sector || !rest.cell || !rest.village) {
    return { error: 'Address (province, district, sector, cell, village) is required' };
  }
  if (!rest.emergencyContactName || !rest.emergencyContactPhone) {
    return { error: 'Emergency contact is required' };
  }
  if (!bodyAcademicYearId) {
    return { error: 'Registration academic year and class are required' };
  }
  if (!classId && !rest.classGrade) {
    return { error: 'Registration academic year and class are required' };
  }
  if (!rest.registrationDate) {
    return { error: 'Registration date is required' };
  }
  if (!rest.paymentMethod) {
    return { error: 'Payment method is required' };
  }

  if (requireDocuments) {
    const requiredDocs = ['BIRTH_CERTIFICATE', 'PHOTO'];
    const uploadedTypes = (documents || []).map((d) => d.docType);
    const missingDocs = requiredDocs.filter((t) => !uploadedTypes.includes(t));
    if (missingDocs.length) {
      return { error: 'Birth certificate and photo are required attachments' };
    }
  }

  return {
    documents,
    classId,
    academicYearId: bodyAcademicYearId,
    rest,
  };
}

export async function createStudentRegistration({
  campusId,
  body,
  parentId = null,
  parentSubmitted = false,
  requireDocuments = parentSubmitted,
  studentInclude,
}) {
  const validated = validateRegistrationPayload(body, { requireDocuments });
  if (validated.error) {
    const err = new Error(validated.error);
    err.status = 400;
    throw err;
  }

  const { documents, academicYearId, rest } = validated;
  let { classId } = validated;

  const academicYear = await resolveAcademicYearForCampus(prisma, campusId, academicYearId);
  if (!academicYear) {
    const err = new Error('Selected academic year not found for this campus');
    err.status = 400;
    throw err;
  }

  // Class ids from another campus (Excel import A→B) must not be reused
  let selectedClass = classId
    ? await prisma.class.findFirst({
      where: { id: classId, campusId, academicYearId: academicYear.id },
    })
    : null;
  if (classId && !selectedClass) {
    classId = null;
  }

  if (!selectedClass && rest.classGrade) {
    selectedClass = await resolveOrCreateClass(
      prisma,
      campusId,
      academicYear.id,
      rest.classGrade,
      rest.classSection || 'A',
      rest.classLabel || '',
    );
    classId = selectedClass?.id || null;
  }

  if (!selectedClass) {
    const err = new Error('Selected class not found for this academic year');
    err.status = 400;
    throw err;
  }

  const {
    classGrade: _cg,
    classSection: _cs,
    classLabel: _cl,
    __row: _row,
    campusId: _campusId,
    campusCode: _campusCode,
    campusName: _campusName,
    campusLetter: _campusLetter,
    inscritA: _inscritA,
    ...studentFields
  } = rest;

  const registrationFields = {
    ...studentFields,
    classId,
    registrationYear: academicYear.name,
    registrationClass: selectedClass.name,
    registrationStatus: ['PENDING', 'APPROVED', 'REJECTED'].includes(rest.registrationStatus)
      ? rest.registrationStatus
      : 'PENDING',
  };

  let student;
  let studentId;
  const maxAttempts = 6;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    studentId = await generateStudentId(campusId, academicYear.id);
    const data = buildStudentData(
      registrationFields,
      campusId,
      academicYear.id,
      studentId,
    );

    try {
      student = await prisma.student.create({
        data: {
          ...data,
          parentId,
          parentSubmitted,
        },
        include: studentInclude,
      });
      break;
    } catch (error) {
      const target = error?.meta?.target;
      const hitsStudentId = Array.isArray(target)
        ? target.includes('studentId')
        : String(target || '').includes('studentId');
      const isUnique = error?.code === 'P2002' && hitsStudentId;
      if (!isUnique || attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }

  const savedDocs = await saveDocuments(student.id, studentId, documents);

  let linkedParentId = parentId;
  if (!linkedParentId) {
    const parentPhone = rest.fatherPhone || rest.motherPhone;
    let parentRecord = await prisma.parent.findFirst({ where: { phone: parentPhone } });
    if (!parentRecord) {
      parentRecord = await prisma.parent.create({ data: { phone: parentPhone } });
    }
    linkedParentId = parentRecord.id;
    await prisma.student.update({
      where: { id: student.id },
      data: { parentId: linkedParentId },
    });
  }

  const result = await prisma.student.findUnique({
    where: { id: student.id },
    include: { ...studentInclude, documents: { orderBy: { createdAt: 'desc' } } },
  });

  return {
    student: result,
    documents: savedDocs.length ? savedDocs : result.documents,
    parentRecordId: linkedParentId,
  };
}
