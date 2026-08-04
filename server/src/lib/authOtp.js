import crypto from 'crypto';
import prisma from './prisma.js';
import { sendMail } from './mailer.js';

export const OTP_PURPOSE = {
  LOGIN: 'LOGIN',
  DELETE_STUDENT: 'DELETE_STUDENT',
};

const OTP_TTL_MS = 10 * 60 * 1000;

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 999999));
}

export function maskEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  const at = value.indexOf('@');
  if (at < 1) return '***';
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

async function invalidateOpenChallenges(userId, purpose, metaFilter = null) {
  const open = await prisma.authOtpChallenge.findMany({
    where: {
      userId,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  const ids = open
    .filter((row) => {
      if (!metaFilter) return true;
      const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
      return Object.entries(metaFilter).every(([k, v]) => meta[k] === v);
    })
    .map((row) => row.id);
  if (ids.length) {
    await prisma.authOtpChallenge.updateMany({
      where: { id: { in: ids } },
      data: { usedAt: new Date() },
    });
  }
}

/**
 * Create OTP challenge and email the code.
 * @returns {{ challengeId, emailMasked, expiresAt }}
 */
export async function createAndSendOtp({
  userId,
  email,
  purpose,
  subject,
  introHtml,
  meta = null,
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('No email address available to send OTP');
  }

  await invalidateOpenChallenges(
    userId,
    purpose,
    purpose === OTP_PURPOSE.DELETE_STUDENT && meta?.studentId
      ? { studentId: meta.studentId }
      : null
  );

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const challenge = await prisma.authOtpChallenge.create({
    data: {
      userId,
      email: normalizedEmail,
      purpose,
      code,
      meta: meta || undefined,
      expiresAt,
    },
  });

  await sendMail({
    to: normalizedEmail,
    subject,
    text: `${introHtml.replace(/<[^>]+>/g, '')}\n\nYour verification code: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <p>${introHtml}</p>
        <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:20px 0">${code}</p>
        <p style="color:#64748b;font-size:13px">This code expires in 10 minutes. If you did not request it, ignore this email.</p>
        <p style="color:#94a3b8;font-size:12px">École La RACINE</p>
      </div>
    `,
  });

  return {
    challengeId: challenge.id,
    emailMasked: maskEmail(normalizedEmail),
    expiresAt: challenge.expiresAt,
  };
}

/**
 * Verify OTP. Marks challenge used on success.
 * @returns {challenge} prisma row
 */
export async function verifyOtpChallenge({ challengeId, code, purpose, userId = null, metaMatch = null }) {
  const challenge = await prisma.authOtpChallenge.findUnique({
    where: { id: String(challengeId || '') },
  });
  if (!challenge || challenge.purpose !== purpose) {
    const err = new Error('Invalid or expired verification code');
    err.status = 400;
    throw err;
  }
  if (userId && challenge.userId !== userId) {
    const err = new Error('Invalid or expired verification code');
    err.status = 400;
    throw err;
  }
  if (challenge.usedAt || challenge.expiresAt.getTime() < Date.now()) {
    const err = new Error('Verification code expired. Request a new one.');
    err.status = 400;
    throw err;
  }
  if (String(challenge.code) !== String(code || '').trim()) {
    const err = new Error('Incorrect verification code');
    err.status = 400;
    throw err;
  }
  if (metaMatch) {
    const meta = challenge.meta && typeof challenge.meta === 'object' ? challenge.meta : {};
    for (const [k, v] of Object.entries(metaMatch)) {
      if (meta[k] !== v) {
        const err = new Error('Invalid or expired verification code');
        err.status = 400;
        throw err;
      }
    }
  }

  await prisma.authOtpChallenge.update({
    where: { id: challenge.id },
    data: { usedAt: new Date() },
  });

  return challenge;
}
