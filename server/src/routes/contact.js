import { Router } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { authorizePermission, PERMISSIONS } from '../config/permissions.js';
import { emitInquiryCreated, emitInquiryUpdate } from '../lib/realtime.js';

const router = Router();

function getTransporter() {
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');

  if (!user || !pass) {
    throw new Error('SMTP credentials are missing. Set SMTP_USER and SMTP_PASS in server/.env');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function emailMask(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return email;
  const safeName = name.length <= 2 ? `${name[0] || '*'}*` : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

const OTP_I18N = {
  en: {
    subject: 'Your OTP for support chat',
    title: 'Support Chat OTP',
    body: 'Use this code to open your support chat:',
    expiry: 'Code expires in 10 minutes.',
    sent: 'OTP sent to',
    noChats: 'No support chats found for this email. Start a new chat first.',
    startSuccess: 'Support chat started. Check your email for the OTP to continue chatting.',
  },
  fr: {
    subject: 'Votre OTP pour le chat de support',
    title: 'OTP du chat de support',
    body: 'Utilisez ce code pour ouvrir votre chat de support :',
    expiry: 'Le code expire dans 10 minutes.',
    sent: 'OTP envoyé à',
    noChats: 'Aucun chat de support trouvé pour cet e-mail. Commencez un nouveau chat d’abord.',
    startSuccess: 'Chat démarré. Vérifiez votre e-mail pour l’OTP afin de continuer.',
  },
  sw: {
    subject: 'OTP yako ya mazungumzo ya msaada',
    title: 'OTP ya mazungumzo ya msaada',
    body: 'Tumia nambari hii kufungua mazungumzo yako:',
    expiry: 'Nambari inaisha baada ya dakika 10.',
    sent: 'OTP imetumwa kwa',
    noChats: 'Hakuna mazungumzo ya msaada kwa barua pepe hii. Anza mazungumzo mapya kwanza.',
    startSuccess: 'Mazungumzo yameanza. Angalia barua pepe yako kwa OTP ili kuendelea.',
  },
  rw: {
    subject: 'OTP yawe y’ikiganiro cy’ubufasha',
    title: 'OTP y’ikiganiro cy’ubufasha',
    body: 'Koresha iyi kode kugira ngo ufungure ikiganiro cyawe:',
    expiry: 'Kode izarangira mu minota 10.',
    sent: 'OTP yoherejwe kuri',
    noChats: 'Nta kiganiro cy’ubufasha kibonetse kuri iyi meri. Tangira ikiganiro gishya mbere.',
    startSuccess: 'Ikiganiro cyatangiye. Reba imeri yawe urebe OTP kugira ngo ukomeze.',
  },
};

function otpT(locale) {
  return OTP_I18N[locale] || OTP_I18N.en;
}

function otpEmailHtml(code, locale) {
  const t = otpT(locale);
  return `
    <div style="font-family:Arial,sans-serif;background:#f4f8f5;padding:24px;">
      <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dbe7de;border-radius:12px;padding:20px;">
        <h2 style="margin:0 0 8px;color:#14231a;">${t.title}</h2>
        <p style="margin:0 0 14px;color:#41574a;">${t.body}</p>
        <div style="font-size:28px;letter-spacing:6px;font-weight:700;color:#65a30d;margin:8px 0 14px;">${code}</div>
        <p style="margin:0;color:#6b7f73;font-size:13px;">${t.expiry}</p>
      </div>
    </div>
  `;
}

function mapReply(r, visitorName) {
  if (r.isVisitor) {
    return {
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      isVisitor: true,
      byName: visitorName || 'You',
      byRole: 'You',
      by: visitorName || 'Visitor',
    };
  }
  const byName = r.repliedBy
    ? `${r.repliedBy.firstName} ${r.repliedBy.lastName}`.trim()
    : 'School staff';
  const byRole = r.repliedBy?.role ? r.repliedBy.role.replace(/_/g, ' ') : 'Support';
  return {
    id: r.id,
    body: r.body,
    createdAt: r.createdAt,
    isVisitor: false,
    byName,
    byRole,
    by: `${byName} (${byRole})`,
    repliedBy: r.repliedBy || null,
  };
}

function mapInquiry(item) {
  return {
    id: item.id,
    name: item.name,
    email: item.email,
    subject: item.subject,
    message: item.message,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    campus: item.campus || null,
    replies: (item.replies || []).map((r) => mapReply(r, item.name)),
  };
}

async function createChatSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await prisma.contactChatSession.create({
    data: { email, token, expiresAt },
  });
  return token;
}

async function requireChatSession(token) {
  const session = await prisma.contactChatSession.findFirst({
    where: {
      token: String(token || ''),
      expiresAt: { gt: new Date() },
    },
  });
  return session;
}

async function loadInquiriesForEmail(email) {
  return prisma.contactInquiry.findMany({
    where: { email },
    orderBy: { updatedAt: 'desc' },
    include: {
      campus: { select: { name: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: { repliedBy: { select: { firstName: true, lastName: true, role: true } } },
      },
    },
  });
}

// POST /api/contact - send message to campus email
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message, campusId } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    // Get campus email or school email
    let recipientEmail = process.env.SMTP_USER; // fallback
    let campusName = 'General';

    if (campusId) {
      const campus = await prisma.campus.findUnique({ where: { id: campusId } });
      if (campus?.email) {
        recipientEmail = campus.email;
        campusName = campus.name;
      }
    }

    // If no campus selected, try school profile email
    if (!campusId) {
      const school = await prisma.schoolProfile.findFirst();
      if (school?.email) recipientEmail = school.email;
    }

    const now = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const inquiry = await prisma.contactInquiry.create({
      data: {
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        subject: subject ? String(subject).trim() : null,
        message: String(message).trim(),
        campusId: campusId || null,
      },
    });

    emitInquiryCreated(mapInquiry({
      ...inquiry,
      campus: null,
      replies: [],
    }));

    // Emails are best-effort — message is already saved for admin inbox
    try {
      const transporter = getTransporter();
      const smtpUser = String(process.env.SMTP_USER || '').trim();

      await transporter.sendMail({
        from: `"${name}" <${smtpUser}>`,
        replyTo: email,
        to: recipientEmail,
        subject: `[Contact Form] ${subject || 'New message from website'}`,
        html: `
          <div style="margin:0;padding:24px;background:#f4f8f5;font-family:Arial,sans-serif;color:#1b2b22;">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe7de;border-radius:14px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#14231a 0%,#264532 100%);padding:20px 24px;color:#ffffff;">
                <h1 style="margin:0;font-size:20px;line-height:1.3;">École La RACINE</h1>
                <p style="margin:6px 0 0;font-size:13px;opacity:.9;">New message from public website</p>
              </div>
              <div style="padding:22px 24px;">
                <p style="margin:0 0 14px;font-size:14px;color:#3b5144;">
                  You received a new contact message.
                </p>
                <div style="background:#f8fbf9;border:1px solid #e3eee6;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
                  <p style="margin:0 0 8px;font-size:13px;"><strong>Name:</strong> ${name}</p>
                  <p style="margin:0 0 8px;font-size:13px;"><strong>Email:</strong> <a href="mailto:${email}" style="color:#2f6a4f;text-decoration:none;">${email}</a></p>
                  ${campusId ? `<p style="margin:0 0 8px;font-size:13px;"><strong>Campus:</strong> ${campusName}</p>` : ''}
                  ${subject ? `<p style="margin:0 0 8px;font-size:13px;"><strong>Subject:</strong> ${subject}</p>` : ''}
                  <p style="margin:0 0 8px;font-size:13px;"><strong>Reference:</strong> #${inquiry.id.slice(0, 8).toUpperCase()}</p>
                  <p style="margin:0;font-size:13px;"><strong>Received:</strong> ${now}</p>
                </div>
                <h3 style="margin:0 0 8px;font-size:14px;color:#234033;">Message</h3>
                <div style="background:#ffffff;border:1px solid #e3eee6;border-left:4px solid #65a30d;border-radius:8px;padding:14px 14px;font-size:14px;line-height:1.65;white-space:pre-wrap;color:#25372d;">
                  ${message}
                </div>
                <div style="margin-top:18px;">
                  <a href="mailto:${email}" style="display:inline-block;background:#65a30d;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;">
                    Reply to sender
                  </a>
                </div>
              </div>
              <div style="padding:14px 24px;background:#f8fbf9;border-top:1px solid #e3eee6;color:#5a6f63;font-size:12px;">
                École La RACINE Contact Desk
              </div>
            </div>
          </div>
        `,
      });

      await transporter.sendMail({
        from: `"École La RACINE" <${smtpUser}>`,
        to: email,
        subject: 'We received your message - École La RACINE',
        html: `
          <div style="margin:0;padding:24px;background:#f4f8f5;font-family:Arial,sans-serif;color:#1b2b22;">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe7de;border-radius:14px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#65a30d 0%,#4d7c0f 100%);padding:20px 24px;color:#ffffff;">
                <h1 style="margin:0;font-size:20px;line-height:1.3;">Thank you, ${name}!</h1>
                <p style="margin:6px 0 0;font-size:13px;opacity:.95;">Your message has been received by École La RACINE.</p>
              </div>
              <div style="padding:22px 24px;">
                <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#31483b;">
                  We appreciate your message. Our team will review it and get back to you as soon as possible.
                </p>
                <div style="background:#f8fbf9;border:1px solid #e3eee6;border-radius:10px;padding:14px 16px;margin:14px 0;">
                  <p style="margin:0 0 8px;font-size:12px;color:#4f6658;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">Message summary</p>
                  ${subject ? `<p style="margin:0 0 8px;font-size:13px;"><strong>Subject:</strong> ${subject}</p>` : ''}
                  <p style="margin:0;font-size:13px;"><strong>Date:</strong> ${now}</p>
                </div>
                <div style="background:#ffffff;border:1px solid #e3eee6;border-left:4px solid #65a30d;border-radius:8px;padding:14px 14px;font-size:14px;line-height:1.65;color:#25372d;">
                  ${message.replace(/\n/g, '<br>')}
                </div>
              </div>
              <div style="padding:14px 24px;background:#f8fbf9;border-top:1px solid #e3eee6;color:#5a6f63;font-size:12px;">
                École La RACINE · This is an automated confirmation email.
              </div>
            </div>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error('Contact email send failed (message still saved):', mailErr);
    }

    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({
      error: err?.message?.includes('SMTP credentials are missing')
        ? err.message
        : 'Failed to send message. Please try again later.',
    });
  }
});

router.post('/replies/request-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const locale = String(req.body?.locale || 'en').trim();
    const t = otpT(locale);
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const inquiryCount = await prisma.contactInquiry.count({ where: { email } });
    if (!inquiryCount) {
      return res.status(404).json({ error: t.noChats });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.contactOtpCode.create({
      data: { email, code, expiresAt },
    });

    try {
      const transporter = getTransporter();
      const smtpUser = String(process.env.SMTP_USER || '').trim();
      await transporter.sendMail({
        from: `"École La RACINE" <${smtpUser}>`,
        to: email,
        subject: t.subject,
        html: otpEmailHtml(code, locale),
      });
    } catch (mailErr) {
      console.error('OTP email failed:', mailErr);
      return res.status(500).json({ error: 'Failed to send OTP email. Check SMTP settings.' });
    }

    res.json({ message: `${t.sent} ${emailMask(email)}` });
  } catch (err) {
    console.error('OTP request error:', err);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

router.post('/replies/verify-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    if (!email || !code) return res.status(400).json({ error: 'Email and OTP are required.' });

    const otp = await prisma.contactOtpCode.findFirst({
      where: {
        email,
        code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) return res.status(400).json({ error: 'Invalid or expired OTP.' });

    await prisma.contactOtpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
    const sessionToken = await createChatSession(email);
    const inquiries = await loadInquiriesForEmail(email);

    res.json({
      visitorEmail: email,
      sessionToken,
      inquiries: inquiries.map(mapInquiry),
    });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'Failed to verify OTP.' });
  }
});

// Start a new support chat from the help widget
router.post('/chat/start', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const subject = String(req.body?.subject || 'Support chat').trim();
    const message = String(req.body?.message || '').trim();
    const locale = String(req.body?.locale || 'en').trim();
    const t = otpT(locale);

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    const inquiry = await prisma.contactInquiry.create({
      data: {
        name,
        email,
        subject: subject || 'Support chat',
        message,
        campusId: null,
      },
    });

    try {
      const transporter = getTransporter();
      const smtpUser = String(process.env.SMTP_USER || '').trim();
      let recipientEmail = smtpUser;
      const school = await prisma.schoolProfile.findFirst();
      if (school?.email) recipientEmail = school.email;

      await transporter.sendMail({
        from: `"${name}" <${smtpUser}>`,
        replyTo: email,
        to: recipientEmail,
        subject: `[Support Chat] ${subject || 'New support message'}`,
        html: `<p><strong>${name}</strong> (${email}) started a support chat:</p><p>${message}</p>`,
      });
    } catch (mailErr) {
      console.error('Support chat notify failed (saved anyway):', mailErr);
    }

    emitInquiryCreated(mapInquiry({
      ...inquiry,
      campus: null,
      replies: [],
    }));

    // Create OTP immediately so user can continue chatting
    const code = generateOtpCode();
    await prisma.contactOtpCode.create({
      data: {
        email,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    try {
      const transporter = getTransporter();
      const smtpUser = String(process.env.SMTP_USER || '').trim();
      await transporter.sendMail({
        from: `"École La RACINE" <${smtpUser}>`,
        to: email,
        subject: t.subject,
        html: otpEmailHtml(code, locale),
      });
    } catch (mailErr) {
      console.error('Start-chat OTP email failed:', mailErr);
    }

    res.status(201).json({
      success: true,
      inquiryId: inquiry.id,
      message: t.startSuccess,
    });
  } catch (err) {
    console.error('Start chat error:', err);
    res.status(500).json({ error: 'Failed to start support chat.' });
  }
});

// Visitor sends a follow-up message in an existing chat
router.post('/chat/message', async (req, res) => {
  try {
    const sessionToken = String(req.body?.sessionToken || '');
    const inquiryId = String(req.body?.inquiryId || '');
    const body = String(req.body?.body || '').trim();

    if (!sessionToken || !inquiryId || !body) {
      return res.status(400).json({ error: 'sessionToken, inquiryId, and message are required.' });
    }

    const session = await requireChatSession(sessionToken);
    if (!session) return res.status(401).json({ error: 'Chat session expired. Verify OTP again.' });

    const inquiry = await prisma.contactInquiry.findFirst({
      where: { id: inquiryId, email: session.email },
    });
    if (!inquiry) return res.status(404).json({ error: 'Conversation not found.' });

    await prisma.contactInquiryReply.create({
      data: {
        inquiryId: inquiry.id,
        body,
        isVisitor: true,
        repliedById: null,
      },
    });

    await prisma.contactInquiry.update({
      where: { id: inquiry.id },
      data: { status: 'OPEN', updatedAt: new Date() },
    });

    try {
      const transporter = getTransporter();
      const smtpUser = String(process.env.SMTP_USER || '').trim();
      let recipientEmail = smtpUser;
      const school = await prisma.schoolProfile.findFirst();
      if (school?.email) recipientEmail = school.email;
      await transporter.sendMail({
        from: `"${inquiry.name}" <${smtpUser}>`,
        replyTo: inquiry.email,
        to: recipientEmail,
        subject: `[Support Chat] New message from ${inquiry.name}`,
        html: `<p><strong>${inquiry.name}</strong> sent a new support message:</p><p>${body}</p>`,
      });
    } catch (mailErr) {
      console.error('Visitor message notify failed:', mailErr);
    }

    const refreshed = await prisma.contactInquiry.findUnique({
      where: { id: inquiry.id },
      include: {
        campus: { select: { name: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { repliedBy: { select: { firstName: true, lastName: true, role: true } } },
        },
      },
    });

    const mapped = mapInquiry(refreshed);
    emitInquiryUpdate(mapped);
    res.status(201).json(mapped);
  } catch (err) {
    console.error('Visitor chat message error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

router.get('/chat/session', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    const session = await requireChatSession(token);
    if (!session) return res.status(401).json({ error: 'Invalid or expired session.' });
    const inquiries = await loadInquiriesForEmail(session.email);
    res.json({
      visitorEmail: session.email,
      sessionToken: token,
      inquiries: inquiries.map(mapInquiry),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use('/admin', authenticate, authorizePermission(PERMISSIONS.COMMUNICATION));

router.get('/admin/inquiries', async (req, res) => {
  try {
    // Show all website contact messages (general + any campus)
    const inquiries = await prisma.contactInquiry.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        campus: { select: { name: true } },
        _count: { select: { replies: true } },
      },
      take: 200,
    });
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/inquiries/:id', async (req, res) => {
  try {
    const inquiry = await prisma.contactInquiry.findUnique({
      where: { id: req.params.id },
      include: {
        campus: { select: { name: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { repliedBy: { select: { firstName: true, lastName: true, role: true } } },
        },
      },
    });
    if (!inquiry) return res.status(404).json({ error: 'Message not found.' });
    res.json(inquiry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/inquiries/:id/reply', async (req, res) => {
  try {
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Reply message is required.' });

    const inquiry = await prisma.contactInquiry.findUnique({ where: { id: req.params.id } });
    if (!inquiry) return res.status(404).json({ error: 'Message not found.' });

    const reply = await prisma.contactInquiryReply.create({
      data: {
        inquiryId: inquiry.id,
        body,
        isVisitor: false,
        repliedById: req.user.id,
      },
      include: { repliedBy: { select: { firstName: true, lastName: true, role: true } } },
    });

    await prisma.contactInquiry.update({
      where: { id: inquiry.id },
      data: { status: 'REPLIED' },
    });

    try {
      const transporter = getTransporter();
      const smtpUser = String(process.env.SMTP_USER || '').trim();
      await transporter.sendMail({
        from: `"École La RACINE" <${smtpUser}>`,
        to: inquiry.email,
        subject: `Reply to your message${inquiry.subject ? `: ${inquiry.subject}` : ''}`,
        html: `
          <div style="font-family:Arial,sans-serif;background:#f4f8f5;padding:24px;">
            <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #dbe7de;border-radius:12px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#14231a 0%,#264532 100%);color:#fff;padding:18px 20px;">
                <h2 style="margin:0;">École La RACINE Reply</h2>
              </div>
              <div style="padding:20px;">
                <p style="margin:0 0 12px;color:#334a3d;">We replied to your inquiry. To view this and future replies in the website system, open Contact page and use your email + OTP.</p>
                <div style="border:1px solid #e3eee6;border-left:4px solid #65a30d;background:#fff;padding:12px;border-radius:8px;white-space:pre-wrap;">${body}</div>
              </div>
            </div>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error('Reply email failed (reply still saved):', mailErr);
    }

    const refreshed = await prisma.contactInquiry.findUnique({
      where: { id: inquiry.id },
      include: {
        campus: { select: { name: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { repliedBy: { select: { firstName: true, lastName: true, role: true } } },
        },
      },
    });
    const mapped = mapInquiry(refreshed);
    emitInquiryUpdate(mapped);
    res.status(201).json(reply);
  } catch (err) {
    console.error('Admin reply error:', err);
    res.status(500).json({ error: 'Failed to send reply.' });
  }
});

router.patch('/admin/inquiries/:id/status', async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim();
    if (!['OPEN', 'REPLIED', 'CLOSED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const updated = await prisma.contactInquiry.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
