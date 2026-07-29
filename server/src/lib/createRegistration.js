import prisma from './prisma.js';
import {
  generateStudentId,
  buildStudentData,
  saveDocuments,
} from './studentRegistration.js';

export function validateRegistrationPayload(body) {
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
  if (!bodyAcademicYearId || !classId) {
    return { error: 'Registration academic year and class are required' };
  }
  if (!rest.registrationDate) {
    return { error: 'Registration date is required' };
  }
  if (!rest.paymentMethod) {
    return { error: 'Payment method is required' };
  }

  const requiredDocs = ['BIRTH_CERTIFICATE', 'PHOTO'];
  const uploadedTypes = (documents || []).map((d) => d.docType);
  const missingDocs = requiredDocs.filter((t) => !uploadedTypes.includes(t));
  if (missingDocs.length) {
    return { error: 'Birth certificate and photo are required attachments' };
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
  studentInclude,
}) {
  const validated = validateRegistrationPayload(body);
  if (validated.error) {
    const err = new Error(validated.error);
    err.status = 400;
    throw err;
  }

  const { documents, classId, academicYearId, rest } = validated;

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: academicYearId, campusId },
  });
  if (!academicYear) {
    const err = new Error('Selected academic year not found for this campus');
    err.status = 400;
    throw err;
  }

  const selectedClass = await prisma.class.findFirst({
    where: { id: classId, campusId, academicYearId: academicYear.id },
  });
  if (!selectedClass) {
    const err = new Error('Selected class not found for this academic year');
    err.status = 400;
    throw err;
  }

  const studentId = await generateStudentId(campusId, academicYear.id);
  const registrationFields = {
    ...rest,
    classId,
    registrationYear: academicYear.name,
    registrationClass: selectedClass.name,
    registrationStatus: 'PENDING',
  };

  const data = buildStudentData(
    registrationFields,
    campusId,
    academicYear.id,
    studentId,
  );

  const student = await prisma.student.create({
    data: {
      ...data,
      parentId,
      parentSubmitted,
    },
    include: studentInclude,
  });

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
