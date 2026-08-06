import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.join(__dirname, '../..');
export const TEACHER_UPLOADS_DIR = path.join(SERVER_ROOT, 'uploads/teachers');

export const MAX_TEACHER_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

function extensionFromFile(fileName, mimeType) {
  const fromName = path.extname(String(fileName || '')).toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '.jpg';
}

export function removeTeacherPhotoFile(filePathRel) {
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

/**
 * Save (or replace) a teacher profile photo on disk.
 * Returns { photoPath, photoMimeType } relative to server root.
 */
export function saveTeacherPhotoFile({
  teacherId,
  fileName,
  contentBase64,
  mimeType = null,
  previousPhotoPath = null,
}) {
  if (!teacherId || !fileName || !contentBase64) {
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
  if (buffer.length > MAX_TEACHER_PHOTO_BYTES) {
    const err = new Error('Photo exceeds the 5 MB limit');
    err.status = 400;
    throw err;
  }

  const teacherDir = path.join(TEACHER_UPLOADS_DIR, teacherId);
  fs.mkdirSync(teacherDir, { recursive: true });

  const ext = extensionFromFile(fileName, mime);
  const diskName = `profile${ext}`;
  const absPath = path.join(teacherDir, diskName);
  fs.writeFileSync(absPath, buffer);

  if (previousPhotoPath) {
    const prevAbs = path.resolve(SERVER_ROOT, previousPhotoPath);
    if (prevAbs !== absPath) removeTeacherPhotoFile(previousPhotoPath);
  }

  return {
    photoPath: path.relative(SERVER_ROOT, absPath).replace(/\\/g, '/'),
    photoMimeType: mime.startsWith('image/') ? mime : 'image/jpeg',
  };
}

export function resolveTeacherPhotoAbsPath(photoPath) {
  if (!photoPath) return null;
  const absPath = path.resolve(SERVER_ROOT, photoPath);
  if (!fs.existsSync(absPath)) return null;
  return absPath;
}

/** Load teacher photo as a data URL for JSON responses / ID cards. */
export function loadTeacherPhotoDataUrl(teacher) {
  const absPath = resolveTeacherPhotoAbsPath(teacher?.photoPath);
  if (!absPath) return null;
  try {
    const buffer = fs.readFileSync(absPath);
    const mime = teacher.photoMimeType || 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export function serializeTeacher(teacher, { includePhotoUrl = false } = {}) {
  if (!teacher) return teacher;
  const { photoPath, photoMimeType, ...rest } = teacher;
  const payload = {
    ...rest,
    hasPhoto: Boolean(photoPath),
  };
  if (includePhotoUrl) {
    payload.photoUrl = loadTeacherPhotoDataUrl({ photoPath, photoMimeType });
  }
  return payload;
}
