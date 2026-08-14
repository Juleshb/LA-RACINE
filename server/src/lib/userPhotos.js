import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveTeacherPhotoFile, removeTeacherPhotoFile } from './teacherPhotos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.join(__dirname, '../..');
export const USER_UPLOADS_DIR = path.join(SERVER_ROOT, 'uploads/users');

export const MAX_USER_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

function extensionFromFile(fileName, mimeType) {
  const fromName = path.extname(String(fileName || '')).toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '.jpg';
}

export function removeUserPhotoFile(filePathRel) {
  if (!filePathRel) return;
  const absPath = path.resolve(SERVER_ROOT, filePathRel);
  if (fs.existsSync(absPath)) {
    try {
      fs.unlinkSync(absPath);
    } catch {
      // ignore missing/locked files
    }
  }
}

export function extractPhotoPayload(body = {}) {
  const photo = body.photo;
  if (!photo || typeof photo !== 'object') return null;
  if (!photo.contentBase64 || !photo.fileName) return null;
  return {
    fileName: photo.fileName,
    contentBase64: photo.contentBase64,
    mimeType: photo.mimeType || null,
  };
}

export function saveUserPhotoFile({
  userId,
  fileName,
  contentBase64,
  mimeType = null,
  previousPhotoPath = null,
}) {
  if (!userId || !fileName || !contentBase64) {
    const err = new Error('Photo file is required');
    err.status = 400;
    throw err;
  }

  const mime = String(mimeType || '').toLowerCase() || 'image/jpeg';
  if (!ALLOWED_MIME.has(mime) && !/\.(jpe?g|png|webp|gif)$/i.test(fileName)) {
    const err = new Error('Photo must be an image (JPEG, PNG, WebP, or GIF)');
    err.status = 400;
    throw err;
  }

  const buffer = Buffer.from(contentBase64, 'base64');
  if (!buffer.length) {
    const err = new Error('Photo file is empty');
    err.status = 400;
    throw err;
  }
  if (buffer.length > MAX_USER_PHOTO_BYTES) {
    const err = new Error('Photo exceeds the 5 MB limit');
    err.status = 400;
    throw err;
  }

  const userDir = path.join(USER_UPLOADS_DIR, userId);
  fs.mkdirSync(userDir, { recursive: true });

  const ext = extensionFromFile(fileName, mime);
  const diskName = `profile${ext}`;
  const absPath = path.join(userDir, diskName);
  fs.writeFileSync(absPath, buffer);

  if (previousPhotoPath) {
    const prevAbs = path.resolve(SERVER_ROOT, previousPhotoPath);
    if (prevAbs !== absPath) removeUserPhotoFile(previousPhotoPath);
  }

  return {
    photoPath: path.relative(SERVER_ROOT, absPath).replace(/\\/g, '/'),
    photoMimeType: mime.startsWith('image/') ? mime : 'image/jpeg',
  };
}

export function resolveUserPhotoAbsPath(photoPath) {
  if (!photoPath) return null;
  const absPath = path.resolve(SERVER_ROOT, photoPath);
  if (!fs.existsSync(absPath)) return null;
  return absPath;
}

export function loadUserPhotoDataUrl(user) {
  const absPath = resolveUserPhotoAbsPath(user?.photoPath);
  if (!absPath) return null;
  try {
    const buffer = fs.readFileSync(absPath);
    const mime = user.photoMimeType || 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export function serializeUserPhoto(user, { includePhotoUrl = false } = {}) {
  if (!user) return user;
  const { photoPath, photoMimeType, ...rest } = user;
  const payload = {
    ...rest,
    hasPhoto: Boolean(photoPath),
  };
  if (includePhotoUrl) {
    payload.photoUrl = loadUserPhotoDataUrl({ photoPath, photoMimeType });
  }
  return payload;
}

export function removeUserPhotoDir(userId) {
  if (!userId) return;
  const userDir = path.join(USER_UPLOADS_DIR, userId);
  try {
    if (fs.existsSync(userDir)) fs.rmSync(userDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export async function syncPhotoToLinkedTeacher(prisma, { teacherId, photoPath, photoMimeType, clear = false }) {
  if (!teacherId) return;
  if (clear) {
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { photoPath: true } });
    if (teacher?.photoPath) removeTeacherPhotoFile(teacher.photoPath);
    await prisma.teacher.update({
      where: { id: teacherId },
      data: { photoPath: null, photoMimeType: null },
    }).catch(() => {});
    return;
  }
  const absPath = resolveUserPhotoAbsPath(photoPath);
  if (!absPath) return;
  const buffer = fs.readFileSync(absPath);
  const saved = saveTeacherPhotoFile({
    teacherId,
    fileName: path.basename(photoPath),
    contentBase64: buffer.toString('base64'),
    mimeType: photoMimeType,
  });
  await prisma.teacher.update({ where: { id: teacherId }, data: saved }).catch(() => {});
}
