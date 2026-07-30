import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from './prisma.js';
import { getClientBaseUrl, sendMail } from './mailer.js';
import { generateTemporaryPassword } from './passwordPolicy.js';

function buildResetEmail({ firstName, email, temporaryPassword, resetUrl, expiresAt }) {
  const name = firstName || 'User';
  const expiresLabel = expiresAt.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const subject = 'École La RACINE — Password reset';
  const text = [
    `Hello ${name},`,
    '',
    'A password reset was requested for your École La RACINE account.',
    '',
    `Email: ${email}`,
    `Temporary password: ${temporaryPassword}`,
    '',
    'Sign in with this temporary password, then you will be asked to choose a new strong password.',
    'Or open this secure link to set a new password now:',
    resetUrl,
    '',
    `This temporary password and link expire on ${expiresLabel}.`,
    '',
    'If you did not request this, contact the school office.',
    '',
    '— École La RACINE',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:560px">
      <h2 style="margin:0 0 12px;color:#3f6212">École La RACINE</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>A password reset was requested for your account.</p>
      <p style="margin:16px 0;padding:12px 16px;background:#f7fee7;border:1px solid #d9f99d;border-radius:8px">
        <strong>Temporary password:</strong><br/>
        <code style="font-size:16px;letter-spacing:0.04em">${temporaryPassword}</code>
      </p>
      <p>Sign in with this temporary password, then choose a new strong password.<br/>
      Or set a new password now:</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#65a30d;color:#fff;text-decoration:none;border-radius:8px">Set new password</a></p>
      <p style="font-size:13px;color:#555">Link: ${resetUrl}</p>
      <p style="font-size:13px;color:#555">Expires: ${expiresLabel}</p>
      <p style="font-size:13px;color:#777">If you did not request this, contact the school office.</p>
    </div>
  `;

  return { subject, text, html };
}

export function buildResetPreview(user, resetRecord) {
  const temporaryPassword = resetRecord.temporaryPassword;
  const resetUrl = `${getClientBaseUrl()}/reset-password?token=${resetRecord.token}`;
  const emailContent = buildResetEmail({
    firstName: user.firstName,
    email: user.email,
    temporaryPassword,
    resetUrl,
    expiresAt: resetRecord.expiresAt,
  });

  return {
    emailSent: Boolean(resetRecord.emailSent),
    expiresAt: resetRecord.expiresAt,
    temporaryPassword,
    resetUrl,
    emailPreview: {
      to: user.email,
      subject: emailContent.subject,
      body: emailContent.text,
    },
  };
}

/**
 * Issue a temporary password + reset token, email the user, and return preview for admins.
 */
export async function issuePasswordReset(user, { initiatedBy = 'user' } = {}) {
  const temporaryPassword = generateTemporaryPassword(12);
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const hashed = await bcrypt.hash(temporaryPassword, 10);
  const resetUrl = `${getClientBaseUrl()}/reset-password?token=${token}`;

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        temporaryPassword,
        emailSent: false,
        expiresAt,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        mustChangePassword: true,
      },
    }),
  ]);

  const emailContent = buildResetEmail({
    firstName: user.firstName,
    email: user.email,
    temporaryPassword,
    resetUrl,
    expiresAt,
  });

  let emailSent = false;
  let emailError = null;
  try {
    await sendMail({
      to: user.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
    emailSent = true;
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, token },
      data: { emailSent: true },
    });
  } catch (err) {
    emailError = err.message || 'Failed to send email';
  }

  return {
    emailSent,
    emailError,
    expiresAt,
    resetToken: token,
    temporaryPassword,
    resetUrl,
    emailPreview: {
      to: user.email,
      subject: emailContent.subject,
      body: emailContent.text,
      initiatedBy,
    },
  };
}

/** Clear stored temporary password after the user sets a permanent one. */
export async function clearPasswordReset(userId) {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
}
