import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { sendMail, isMailConfigured } from '../lib/mailer.js';
import { updatesForRole } from '../data/productUpdates.js';

const router = Router();

const SUPPORT_EMAILS = ['info@hblab.rw', 'hblabltd@gmail.com'];

const ROLE_LABELS = {
  SCHOOL_MANAGER: 'School manager',
  SCHOOL_ADMIN: 'School admin',
  TEACHER: 'Teacher',
  PARENT: 'Parent',
  STUDENT: 'Student',
  HEAD_OF_STUDIES: 'Head of studies',
  HEAD_OF_DISCIPLINE: 'Head of discipline',
  SECRETARY: 'Secretary',
  ACCOUNTANT: 'Accountant',
  ACTIVITIES_MANAGER: 'Activities manager',
  LIBRARIAN: 'Librarian',
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

router.get('/', async (req, res) => {
  try {
    const role = req.user.role;
    const updates = updatesForRole(role).map((item) => ({
      id: item.id,
      date: item.date,
      commit: item.commit,
      roles: item.roles,
      en: item.en,
      fr: item.fr,
    }));
    res.json({
      updates,
      canSeeAll: role === 'SCHOOL_MANAGER' || role === 'SCHOOL_ADMIN',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/requests', async (req, res) => {
  try {
    const kind = req.body.kind === 'support' ? 'support' : 'change';
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();
    if (!subject) return res.status(400).json({ error: 'Subject is required' });
    if (message.length < 10) {
      return res.status(400).json({ error: 'Write a short message of at least 10 characters' });
    }
    if (!isMailConfigured()) {
      return res.status(503).json({ error: 'Email is not configured, so the request cannot be sent' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        phone: true,
      },
    });
    if (!user) return res.status(401).json({ error: 'Account not found' });

    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    const roleLabel = ROLE_LABELS[user.role] || user.role;
    const campusName = req.campus?.name || 'Not linked to a campus';
    const kindLabel = kind === 'support' ? 'Support message' : 'Change request';

    const saved = await prisma.changeRequest.create({
      data: {
        userId: user.id,
        campusId: req.campusId || null,
        kind,
        subject,
        message,
      },
    });

    const text = [
      `${kindLabel} from the École La RACINE portal`,
      '',
      `Name: ${name}`,
      `Role: ${roleLabel}`,
      `Email: ${user.email}`,
      `Phone: ${user.phone || '—'}`,
      `Campus: ${campusName}`,
      `Subject: ${subject}`,
      '',
      message,
      '',
      'Reply to this person at the email address above.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;color:#0b2840;line-height:1.5">
        <h2 style="margin:0 0 12px">${esc(kindLabel)}</h2>
        <p style="margin:0 0 12px">Sent from the École La RACINE portal.</p>
        <table style="border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0"><strong>Name</strong></td><td>${esc(name)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><strong>Role</strong></td><td>${esc(roleLabel)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><strong>Email</strong></td><td>${esc(user.email)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><strong>Phone</strong></td><td>${esc(user.phone || '—')}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><strong>Campus</strong></td><td>${esc(campusName)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><strong>Subject</strong></td><td>${esc(subject)}</td></tr>
        </table>
        <p style="margin:16px 0 8px"><strong>Message</strong></p>
        <p style="white-space:pre-wrap;margin:0">${esc(message)}</p>
      </div>
    `;

    try {
      await sendMail({
        to: SUPPORT_EMAILS,
        replyTo: user.email,
        subject: `[La RACINE] ${kindLabel} from ${name}`,
        text,
        html,
      });
    } catch (mailError) {
      return res.status(502).json({
        error: 'The message was saved, but email to support could not be sent. Try again in a moment.',
      });
    }

    await prisma.changeRequest.update({
      where: { id: saved.id },
      data: { emailed: true },
    });

    res.status(201).json({ sent: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
