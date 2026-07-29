import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'laracine-school-dev-secret';

export function createBulletinVerificationToken(payload) {
  return jwt.sign(
    { type: 'bulletin', ...payload },
    SECRET,
    { expiresIn: '10y' },
  );
}

export function verifyBulletinToken(token) {
  const decoded = jwt.verify(token, SECRET);
  if (decoded.type !== 'bulletin') {
    throw new Error('Invalid bulletin token');
  }
  return decoded;
}

export function buildVerifyUrl(token) {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${clientUrl}/verify/bulletin/${token}`;
}
