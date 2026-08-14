const GRADE_LADDER = ['CRECHE', 'M1', 'M2', 'M3', 'TOP', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

const LEGACY_GRADE = {
  N1: 'M1',
  N2: 'M2',
  N3: 'M3',
};

export const DELIBERATION_DECISIONS = ['PROMOTE', 'REPEAT', 'GRADUATE', 'REJECTED', 'LEAVE'];

export function normalizeDecision(decision) {
  const d = String(decision || '').toUpperCase();
  if (d === 'LEAVE') return 'REJECTED';
  return d;
}

export function isReturningDecision(decision) {
  const d = normalizeDecision(decision);
  return d === 'PROMOTE' || d === 'REPEAT';
}

export function normalizeGrade(grade) {
  const g = String(grade || '').trim().toUpperCase();
  return LEGACY_GRADE[g] || g;
}

export function nextGrade(grade) {
  const g = normalizeGrade(grade);
  const i = GRADE_LADDER.indexOf(g);
  if (i < 0) return null;
  return GRADE_LADDER[i + 1] || null;
}

export function isTerminalGrade(grade) {
  return normalizeGrade(grade) === 'P6';
}

export function suggestedDecision(grade) {
  return isTerminalGrade(grade) ? 'GRADUATE' : 'PROMOTE';
}

export function pickTargetClass(classes, { grade, section }) {
  const g = normalizeGrade(grade);
  const sec = section || 'A';
  const sameGrade = classes.filter((c) => normalizeGrade(c.grade) === g);
  if (!sameGrade.length) return null;
  return sameGrade.find((c) => (c.section || 'A') === sec) || sameGrade[0];
}

const STUDENT_COPY_FIELDS = [
  'studentId',
  'firstName',
  'lastName',
  'postName',
  'gender',
  'dateOfBirth',
  'nationality',
  'email',
  'phone',
  'address',
  'parentName',
  'parentPhone',
  'parentId',
  'fatherName',
  'fatherProfession',
  'fatherPhone',
  'fatherEmail',
  'motherName',
  'motherProfession',
  'motherPhone',
  'motherEmail',
  'province',
  'district',
  'sector',
  'cell',
  'village',
  'emergencyContactName',
  'emergencyContactPhone',
  'previousSchoolName',
  'previousSchoolYear',
  'previousClass',
  'registrationYear',
  'registrationClass',
  'registrationDate',
  'parentSubmitted',
  'studentAccountCreatedBy',
  'surgicalHistory',
  'heartMurmur',
  'medicinalAllergies',
  'generalAllergies',
  'tuberculosis',
  'treatment',
  'foodIntolerance',
  'diabetes',
  'asthma',
  'visualDisturbances',
  'transportMode',
  'busStop',
  'paymentMethod',
  'additionalInfo',
];

export function generateFeeReceiptNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `FEE-${year}${month}-${random}`;
}

export async function createConfirmationFee(tx, {
  studentId,
  amount,
  dueDate,
  paidNow = false,
  waiveFee = false,
}) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  let status = 'PENDING';
  if (waiveFee) status = 'WAIVED';
  else if (paidNow) status = 'PAID';

  return tx.feePayment.create({
    data: {
      receiptNumber: generateFeeReceiptNumber(),
      studentId,
      feeType: 'CONFIRMATION',
      amount: numeric,
      dueDate: dueDate ? new Date(dueDate) : new Date(),
      paidDate: status === 'PAID' ? new Date() : null,
      status,
      notes: 'Year-end continuation / frais de confirmation',
    },
  });
}

export function studentEnrollmentPayload(source, { campusId, academicYearId, classId, registrationStatus = 'APPROVED' }) {
  const data = {
    campusId,
    academicYearId,
    classId,
    registrationStatus,
  };
  for (const key of STUDENT_COPY_FIELDS) {
    if (source[key] !== undefined) data[key] = source[key];
  }
  return data;
}

export function buildSuggestion(sourceStudent, targetClasses) {
  const grade = sourceStudent.class?.grade || null;
  const section = sourceStudent.class?.section || 'A';
  const decision = suggestedDecision(grade);
  if (decision === 'GRADUATE' || !grade) {
    return { decision, targetGrade: null, suggestedClassId: null };
  }
  const targetGrade = nextGrade(grade);
  const cls = pickTargetClass(targetClasses, { grade: targetGrade, section });
  return {
    decision,
    targetGrade,
    suggestedClassId: cls?.id || null,
  };
}

export async function relinkStudentLogin(tx, campusId, sourceStudent, newStudentId) {
  if (sourceStudent.email) {
    const byEmail = await tx.user.updateMany({
      where: {
        campusId,
        role: 'STUDENT',
        email: sourceStudent.email.toLowerCase(),
      },
      data: { studentId: newStudentId },
    });
    if (byEmail.count) return byEmail.count;
  }

  const firstName = sourceStudent.firstName;
  const lastName = sourceStudent.lastName;
  if (!firstName || !lastName) return 0;

  const candidates = await tx.user.findMany({
    where: {
      campusId,
      role: 'STUDENT',
      studentId: null,
      firstName,
      lastName,
    },
    select: { id: true },
  });
  if (candidates.length !== 1) return 0;
  await tx.user.update({
    where: { id: candidates[0].id },
    data: { studentId: newStudentId },
  });
  return 1;
}

export async function enrollReturningStudents(tx, {
  campusId,
  sourceYearId,
  targetYearId,
  feeAmount = 0,
  feeDue = null,
}) {
  const stats = {
    promoted: 0,
    repeated: 0,
    confirmationFees: 0,
    awaitingConfirmation: 0,
    usersRelinked: 0,
    skipped: 0,
  };

  const targetClasses = await tx.class.findMany({
    where: { campusId, academicYearId: targetYearId },
    select: { id: true, name: true, grade: true, section: true },
  });
  const classById = new Map(targetClasses.map((c) => [c.id, c]));

  const sourceStudents = await tx.student.findMany({
    where: {
      campusId,
      academicYearId: sourceYearId,
      registrationStatus: 'APPROVED',
      deliberationDecision: { in: ['PROMOTE', 'REPEAT'] },
    },
    include: {
      class: { select: { grade: true, section: true } },
      documents: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const amount = Number(feeAmount) || 0;
  const needsFee = amount > 0;
  const registrationStatus = needsFee ? 'AWAITING_CONFIRMATION' : 'APPROVED';

  for (const sourceStudent of sourceStudents) {
    const existing = await tx.student.findFirst({
      where: {
        campusId,
        academicYearId: targetYearId,
        studentId: sourceStudent.studentId,
      },
    });
    if (existing) {
      stats.skipped += 1;
      continue;
    }

    const decision = normalizeDecision(sourceStudent.deliberationDecision);
    const grade = decision === 'REPEAT'
      ? sourceStudent.class?.grade
      : nextGrade(sourceStudent.class?.grade);
    const picked = pickTargetClass(targetClasses, {
      grade,
      section: sourceStudent.class?.section,
    });
    const classId = picked?.id || null;
    if (!classId || !classById.has(classId)) {
      const err = new Error(
        `No destination class for ${sourceStudent.firstName} ${sourceStudent.lastName} (${decision}). Copy classes into the new year.`,
      );
      err.status = 400;
      throw err;
    }

    const created = await tx.student.create({
      data: studentEnrollmentPayload(sourceStudent, {
        campusId,
        academicYearId: targetYearId,
        classId,
        registrationStatus,
      }),
    });

    if (sourceStudent.documents?.length) {
      await tx.studentDocument.createMany({
        data: sourceStudent.documents.map((d) => ({
          studentId: created.id,
          docType: d.docType,
          fileName: d.fileName,
          filePath: d.filePath,
          mimeType: d.mimeType,
        })),
      });
    }

    const fee = await createConfirmationFee(tx, {
      studentId: created.id,
      amount,
      dueDate: feeDue,
    });
    if (fee) stats.confirmationFees += 1;
    if (registrationStatus === 'AWAITING_CONFIRMATION') stats.awaitingConfirmation += 1;
    stats.usersRelinked += await relinkStudentLogin(tx, campusId, sourceStudent, created.id);
    if (decision === 'REPEAT') stats.repeated += 1;
    else stats.promoted += 1;
  }

  return stats;
}
