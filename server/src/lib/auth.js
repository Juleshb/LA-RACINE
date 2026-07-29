import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'laracine-school-dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  campusId: true,
  teacherId: true,
  studentId: true,
  parentId: true,
  preferredLanguage: true,
  createdAt: true,
  campus: { select: { id: true, name: true, code: true, city: true } },
};
