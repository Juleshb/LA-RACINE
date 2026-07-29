import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '../../uploads/homework');

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_BYTES = 5 * 1024 * 1024;

export function validateHomeworkFile({ mimeType, contentBase64, fileName }) {
  if (!mimeType || !ALLOWED_MIME.has(mimeType)) {
    return 'Only JPG, PNG, WEBP images and PDF files are allowed';
  }
  if (!contentBase64) return 'File content is required';
  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.length > MAX_BYTES) {
    return `File "${fileName || 'upload'}" is too large (max 5 MB)`;
  }
  return null;
}

export function saveHomeworkAttachment(homeworkId, { fileName, mimeType, contentBase64 }) {
  const err = validateHomeworkFile({ mimeType, contentBase64, fileName });
  if (err) throw new Error(err);

  const dir = path.join(UPLOADS_DIR, homeworkId);
  fs.mkdirSync(dir, { recursive: true });

  const ext = path.extname(fileName) || (mimeType === 'application/pdf' ? '.pdf' : '.bin');
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const fullPath = path.join(dir, safeName);
  fs.writeFileSync(fullPath, Buffer.from(contentBase64, 'base64'));

  return path.relative(UPLOADS_DIR, fullPath).replace(/\\/g, '/');
}

export function loadHomeworkAttachment(storagePath) {
  const fullPath = path.join(UPLOADS_DIR, storagePath);
  if (!fullPath.startsWith(UPLOADS_DIR) || !fs.existsSync(fullPath)) {
    return null;
  }
  const buffer = fs.readFileSync(fullPath);
  return buffer;
}

export function deleteHomeworkDir(homeworkId) {
  const dir = path.join(UPLOADS_DIR, homeworkId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
