import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from './prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '../../uploads/students');

/**
 * Next school student code for a campus + academic year.
 * Uses max existing numeric suffix (not row count) so deletions / gaps never collide.
 */
export async function generateStudentId(campusId, academicYearId) {
  const year = new Date().getFullYear();
  const prefix = `LRS-${year}-`;

  const existing = await prisma.student.findMany({
    where: {
      campusId,
      academicYearId,
      studentId: { startsWith: prefix },
    },
    select: { studentId: true },
  });

  let max = 0;
  for (const row of existing) {
    const match = String(row.studentId || '').match(/^LRS-\d{4}-(\d+)$/i);
    if (!match) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }

  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildStudentData(body, campusId, academicYearId, studentId) {
  const {
    documents: _docs,
    classId,
    ...fields
  } = body;

  const parentName = [fields.fatherName, fields.motherName].filter(Boolean).join(' & ') || null;
  const parentPhone = fields.fatherPhone || fields.motherPhone || null;

  return {
    campusId,
    academicYearId,
    studentId,
    classId: classId || null,
    firstName: fields.firstName,
    lastName: fields.lastName,
    postName: fields.postName || null,
    gender: fields.gender,
    dateOfBirth: parseDate(fields.dateOfBirth),
    nationality: fields.nationality || null,
    email: fields.email || null,
    phone: fields.phone || null,
    address: [fields.village, fields.cell, fields.sector, fields.district, fields.province].filter(Boolean).join(', ') || null,
    parentName,
    parentPhone,
    fatherName: fields.fatherName || null,
    fatherProfession: fields.fatherProfession || null,
    fatherPhone: fields.fatherPhone || null,
    fatherEmail: fields.fatherEmail || null,
    motherName: fields.motherName || null,
    motherProfession: fields.motherProfession || null,
    motherPhone: fields.motherPhone || null,
    motherEmail: fields.motherEmail || null,
    province: fields.province || null,
    district: fields.district || null,
    sector: fields.sector || null,
    cell: fields.cell || null,
    village: fields.village || null,
    emergencyContactName: fields.emergencyContactName || null,
    emergencyContactPhone: fields.emergencyContactPhone || null,
    previousSchoolName: fields.previousSchoolName || null,
    previousSchoolYear: fields.previousSchoolYear || null,
    previousClass: fields.previousClass || null,
    registrationYear: fields.registrationYear || null,
    registrationClass: fields.registrationClass || null,
    registrationDate: parseDate(fields.registrationDate) || new Date(),
    registrationStatus: fields.registrationStatus || 'PENDING',
    surgicalHistory: fields.surgicalHistory ?? null,
    heartMurmur: fields.heartMurmur ?? null,
    medicinalAllergies: fields.medicinalAllergies ?? null,
    generalAllergies: fields.generalAllergies || null,
    tuberculosis: fields.tuberculosis ?? null,
    treatment: fields.treatment || null,
    foodIntolerance: fields.foodIntolerance ?? null,
    diabetes: fields.diabetes ?? null,
    asthma: fields.asthma ?? null,
    visualDisturbances: fields.visualDisturbances ?? null,
    transportMode: fields.transportMode || null,
    busStop: fields.busStop || null,
    paymentMethod: fields.paymentMethod || null,
    additionalInfo: fields.additionalInfo || null,
  };
}

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const DOCUMENT_FILE_LABELS = {
  BIRTH_CERTIFICATE: 'BIRTH CERTIFICATE',
  PHOTO: 'PHOTO',
  REPORT_CARD: 'REPORT CARD',
  MEDICAL_CERTIFICATE: 'MEDICAL CERTIFICATE',
  OTHER: 'OTHER',
};

function extensionFromFile(originalFileName, mimeType) {
  const ext = path.extname(originalFileName || '');
  if (ext) return ext.toLowerCase();

  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg';
  if (mimeType?.startsWith('image/')) return '.jpg';
  return '';
}

export function buildAttachmentFileName(docType, studentCode, originalFileName, mimeType) {
  const label = DOCUMENT_FILE_LABELS[docType] || docType.replace(/_/g, ' ');
  const ext = extensionFromFile(originalFileName, mimeType);
  const fileName = `${label} ${studentCode}${ext}`;
  const diskName = fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  return { fileName, diskName };
}

export async function saveDocuments(studentUuid, studentCode, documents = []) {
  if (!documents.length) return [];

  const studentDir = path.join(UPLOADS_DIR, studentUuid);
  fs.mkdirSync(studentDir, { recursive: true });

  const saved = [];
  for (const doc of documents) {
    if (!doc.fileName || !doc.contentBase64 || !doc.docType) continue;

    const buffer = Buffer.from(doc.contentBase64, 'base64');
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File "${doc.fileName}" exceeds the 5 MB limit`);
    }

    const { fileName, diskName } = buildAttachmentFileName(
      doc.docType,
      studentCode,
      doc.fileName,
      doc.mimeType
    );
    const filePath = path.join(studentDir, diskName);
    fs.writeFileSync(filePath, buffer);

    const record = await prisma.studentDocument.create({
      data: {
        studentId: studentUuid,
        docType: doc.docType,
        fileName,
        filePath: path.relative(path.join(__dirname, '../..'), filePath),
        mimeType: doc.mimeType || null,
      },
    });
    saved.push(record);
  }
  return saved;
}

function removeDocumentFile(filePathRel) {
  if (!filePathRel) return;
  const absPath = path.resolve(path.join(__dirname, '../..'), filePathRel);
  if (fs.existsSync(absPath)) {
    try {
      fs.unlinkSync(absPath);
    } catch {
      // ignore missing/locked files
    }
  }
}

/** Delete one document record and its file from disk. */
export async function deleteStudentDocument(doc) {
  if (!doc) return;
  removeDocumentFile(doc.filePath);
  await prisma.studentDocument.delete({ where: { id: doc.id } }).catch(() => {});
}

/**
 * Replace existing document(s) of the same type (or a specific doc id) with a new upload.
 * Old file(s) are deleted from disk.
 */
export async function replaceStudentDocument({
  studentUuid,
  studentCode,
  docType,
  replaceDocId = null,
  fileName,
  contentBase64,
  mimeType = null,
}) {
  if (!docType || !fileName || !contentBase64) {
    const err = new Error('Document type and file are required');
    err.status = 400;
    throw err;
  }

  const raw = String(contentBase64).includes(',')
    ? String(contentBase64).split(',')[1]
    : String(contentBase64);
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) {
    const err = new Error('Invalid file data');
    err.status = 400;
    throw err;
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    const err = new Error(`File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit`);
    err.status = 400;
    throw err;
  }

  const toRemove = replaceDocId
    ? await prisma.studentDocument.findMany({ where: { id: replaceDocId, studentId: studentUuid } })
    : await prisma.studentDocument.findMany({ where: { studentId: studentUuid, docType } });

  for (const old of toRemove) {
    await deleteStudentDocument(old);
  }

  const studentDir = path.join(UPLOADS_DIR, studentUuid);
  fs.mkdirSync(studentDir, { recursive: true });

  const names = buildAttachmentFileName(docType, studentCode, fileName, mimeType);
  // Avoid overwrite collision if delete failed to remove same disk name
  const uniqueDisk = `${Date.now()}-${names.diskName}`;
  const absPath = path.join(studentDir, uniqueDisk);
  fs.writeFileSync(absPath, buffer);

  return prisma.studentDocument.create({
    data: {
      studentId: studentUuid,
      docType,
      fileName: names.fileName,
      filePath: path.relative(path.join(__dirname, '../..'), absPath),
      mimeType: mimeType || null,
    },
  });
}

export async function findClassForGrade(campusId, academicYearId, grade) {
  if (!grade) return null;
  const cls = await prisma.class.findFirst({
    where: { campusId, academicYearId, grade },
    orderBy: { section: 'asc' },
  });
  return cls?.id || null;
}

export function loadPhotoDataUrl(documents = []) {
  const photo = documents.find((d) => d.docType === 'PHOTO');
  if (!photo?.filePath) return null;

  const absPath = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'), photo.filePath);
  if (!fs.existsSync(absPath)) return null;

  const buffer = fs.readFileSync(absPath);
  const mime = photo.mimeType || 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}
