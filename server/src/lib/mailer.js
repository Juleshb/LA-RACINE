import nodemailer from 'nodemailer';

export function getMailTransporter() {
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');

  if (!user || !pass) {
    throw new Error('SMTP credentials are missing. Set SMTP_USER and SMTP_PASS in server/.env');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

export function getClientBaseUrl() {
  return String(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function sendMail({ to, subject, text, html }) {
  const transporter = getMailTransporter();
  const from = String(process.env.SMTP_USER || '').trim();
  await transporter.sendMail({
    from: `"École La RACINE" <${from}>`,
    to,
    subject,
    text,
    html: html || undefined,
  });
}
