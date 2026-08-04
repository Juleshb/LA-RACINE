import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CALENDAR_UPLOADS_DIR = path.join(__dirname, '../../uploads/calendar');

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

export function ensureCalendarUploadsDir() {
  fs.mkdirSync(CALENDAR_UPLOADS_DIR, { recursive: true });
}

export function saveCalendarPdf({ fileName, contentBase64 }) {
  if (!contentBase64) {
    const err = new Error('PDF content is required');
    err.status = 400;
    throw err;
  }

  const raw = String(contentBase64).includes(',')
    ? String(contentBase64).split(',')[1]
    : String(contentBase64);
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) {
    const err = new Error('Invalid PDF data');
    err.status = 400;
    throw err;
  }
  if (buffer.length > MAX_BYTES) {
    const err = new Error('PDF is too large (max 12 MB)');
    err.status = 400;
    throw err;
  }

  // Basic PDF magic check
  const header = buffer.subarray(0, 5).toString('utf8');
  if (!header.startsWith('%PDF')) {
    const err = new Error('File must be a PDF');
    err.status = 400;
    throw err;
  }

  ensureCalendarUploadsDir();
  const safeBase = String(fileName || 'calendar')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 60) || 'calendar';
  const diskName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeBase}.pdf`;
  const fullPath = path.join(CALENDAR_UPLOADS_DIR, diskName);
  fs.writeFileSync(fullPath, buffer);

  return {
    fileName: `${safeBase}.pdf`,
    fileUrl: `/uploads/calendar/${diskName}`,
    size: buffer.length,
  };
}
