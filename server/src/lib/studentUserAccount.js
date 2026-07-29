import bcrypt from 'bcryptjs';
import prisma from './prisma.js';

const userPublicSelect = {
  id: true,
  email: true,
  isActive: true,
  firstName: true,
  lastName: true,
  createdAt: true,
};

export async function findParentApprovedChild(parentId, studentId, campusId) {
  if (!parentId) return null;
  return prisma.student.findFirst({
    where: {
      id: studentId,
      parentId,
      campusId,
      registrationStatus: 'APPROVED',
    },
    include: {
      class: { select: { id: true, name: true, grade: true, section: true } },
      user: { select: userPublicSelect },
    },
  });
}

export function formatStudentAccount(student) {
  return {
    id: student.id,
    studentCode: student.studentId,
    firstName: student.firstName,
    lastName: student.lastName,
    class: student.class || null,
    registrationStatus: student.registrationStatus,
    hasLogin: Boolean(student.user),
    login: student.user
      ? {
        id: student.user.id,
        email: student.user.email,
        isActive: student.user.isActive,
        createdAt: student.user.createdAt,
      }
      : null,
    managedBy: student.studentAccountCreatedBy || null,
    canCreateLogin: student.registrationStatus === 'APPROVED' && !student.user,
    canManageLogin: student.registrationStatus === 'APPROVED' && Boolean(student.user),
  };
}

export async function createStudentPortalAccount({ student, email, password, createdBy }) {
  if (student.registrationStatus !== 'APPROVED') {
    const err = new Error('Student enrollment must be approved before creating a portal account');
    err.status = 400;
    throw err;
  }
  if (student.user) {
    const err = new Error('This student already has a login account');
    err.status = 400;
    throw err;
  }

  const normalized = email?.toLowerCase().trim();
  if (!normalized) {
    const err = new Error('Email is required');
    err.status = 400;
    throw err;
  }
  if (!password || password.length < 6) {
    const err = new Error('Password must be at least 6 characters');
    err.status = 400;
    throw err;
  }

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    const err = new Error('Email already in use');
    err.status = 400;
    throw err;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: normalized,
        password: hashed,
        firstName: student.firstName,
        lastName: student.lastName,
        role: 'STUDENT',
        campusId: student.campusId,
        studentId: student.id,
      },
      select: userPublicSelect,
    });
    await tx.student.update({
      where: { id: student.id },
      data: { studentAccountCreatedBy: createdBy },
    });
    return created;
  });

  return user;
}

export async function resetStudentPortalPassword(userId, password) {
  if (!password || password.length < 6) {
    const err = new Error('Password must be at least 6 characters');
    err.status = 400;
    throw err;
  }
  const hashed = await bcrypt.hash(password, 10);
  return prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
    select: userPublicSelect,
  });
}

export async function setStudentPortalActive(userId, isActive) {
  return prisma.user.update({
    where: { id: userId },
    data: { isActive: Boolean(isActive) },
    select: userPublicSelect,
  });
}

const EMAIL_DOMAIN = 'laracineschool.rw';

function slugFromStudentCode(studentCode) {
  return String(studentCode || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseGuardianName(fullName, fallbackLastName) {
  const trimmed = fullName?.trim();
  if (!trimmed) {
    return { firstName: 'Parent', lastName: fallbackLastName || 'Family' };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: fallbackLastName || parts[0] };
  }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

async function ensureEmailAvailable(email) {
  const normalized = email?.toLowerCase().trim();
  if (!normalized) {
    const err = new Error('Email is required');
    err.status = 400;
    throw err;
  }
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    const err = new Error('Email already in use');
    err.status = 400;
    throw err;
  }
  return normalized;
}

function validatePassword(password) {
  if (!password || password.length < 6) {
    const err = new Error('Password must be at least 6 characters');
    err.status = 400;
    throw err;
  }
}

export function suggestFamilyAccountEmails(student) {
  const slug = slugFromStudentCode(student.studentId);
  const guardianEmails = [student.fatherEmail, student.motherEmail]
    .filter(Boolean)
    .map((e) => e.toLowerCase().trim());

  const parentName = parseGuardianName(student.fatherName || student.motherName, student.lastName);

  return {
    parent: {
      suggestedEmail: guardianEmails[0] || `parent.${slug}@${EMAIL_DOMAIN}`,
      alternativeEmails: guardianEmails.slice(1),
      suggestedFirstName: parentName.firstName,
      suggestedLastName: parentName.lastName,
    },
    student: {
      suggestedEmail: `student.${slug}@${EMAIL_DOMAIN}`,
      suggestedFirstName: student.firstName,
      suggestedLastName: student.lastName,
    },
  };
}

export async function createParentPortalAccount({
  parent,
  campusId,
  email,
  password,
  firstName,
  lastName,
}) {
  if (!parent) {
    const err = new Error('No parent record linked to this student');
    err.status = 400;
    throw err;
  }
  if (parent.user) {
    const err = new Error('This family already has a parent login account');
    err.status = 400;
    throw err;
  }

  validatePassword(password);
  const normalized = await ensureEmailAvailable(email);
  const hashed = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      email: normalized,
      password: hashed,
      firstName: firstName?.trim() || 'Parent',
      lastName: lastName?.trim() || 'Family',
      role: 'PARENT',
      campusId,
      parentId: parent.id,
    },
    select: userPublicSelect,
  });
}

export async function provisionFamilyAccounts(student, body) {
  const {
    createParent = true,
    createStudent = true,
    parentEmail,
    parentPassword,
    parentFirstName,
    parentLastName,
    studentEmail,
    studentPassword,
  } = body;

  const result = {
    parent: null,
    student: null,
    messages: [],
  };

  if (createParent) {
    if (!student.parent) {
      const err = new Error('No parent record linked to this student');
      err.status = 400;
      throw err;
    }
    if (student.parent.user) {
      result.parent = student.parent.user;
      result.messages.push('Parent login already exists — skipped.');
    } else {
      result.parent = await createParentPortalAccount({
        parent: student.parent,
        campusId: student.campusId,
        email: parentEmail,
        password: parentPassword,
        firstName: parentFirstName,
        lastName: parentLastName,
      });
      result.messages.push('Parent login created and linked to this family.');
    }
  }

  if (createStudent) {
    if (student.user) {
      result.student = student.user;
      result.messages.push('Student login already exists — skipped.');
    } else {
      result.student = await createStudentPortalAccount({
        student,
        email: studentEmail,
        password: studentPassword,
        createdBy: 'STAFF',
      });
      result.messages.push('Student login created.');
    }
  }

  return result;
}
