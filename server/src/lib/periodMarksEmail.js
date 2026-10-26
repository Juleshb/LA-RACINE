import prisma from './prisma.js';
import { isMailConfigured, getMailSkipReason, sendMail } from './mailer.js';
import { isPrimaryGrade } from '../config/grades.js';
import { buildBulletinPdfUrl, createBulletinPdfToken } from './bulletinVerification.js';

const LANGS = [
  {
    name: 'English',
    heading: 'Period marks',
    student: 'Student',
    classLabel: 'Class',
    period: 'Period',
    term: 'Term',
    subject: 'Subject',
    score: 'Score',
    outOf: 'Out of',
    total: 'Total',
    rank: 'Rank',
    of: 'of',
    none: 'No marks recorded for this period.',
    pdf: 'Download the report card (PDF)',
  },
  {
    name: 'Français',
    heading: 'Notes de la période',
    student: 'Élève',
    classLabel: 'Classe',
    period: 'Période',
    term: 'Trimestre',
    subject: 'Matière',
    score: 'Note',
    outOf: 'Sur',
    total: 'Total',
    rank: 'Rang',
    of: 'sur',
    none: 'Aucune note enregistrée pour cette période.',
    pdf: 'Télécharger le bulletin (PDF)',
  },
  {
    name: 'Ikinyarwanda',
    heading: 'Amanota y’igihe',
    student: 'Umunyeshuri',
    classLabel: 'Icyiciro',
    period: 'Igihe',
    term: 'Igihembwe',
    subject: 'Isomo',
    score: 'Amanota',
    outOf: 'Ku',
    total: 'Igiteranyo',
    rank: 'Umwanya',
    of: 'mu',
    none: 'Nta manota yanditswe muri iki gihe.',
    pdf: 'Kuramo buletin (PDF)',
  },
  {
    name: 'Kiswahili',
    heading: 'Alama za kipindi',
    student: 'Mwanafunzi',
    classLabel: 'Darasa',
    period: 'Kipindi',
    term: 'Muhula',
    subject: 'Somo',
    score: 'Alama',
    outOf: 'Kati ya',
    total: 'Jumla',
    rank: 'Nafasi',
    of: 'kati ya',
    none: 'Hakuna alama zilizorekodiwa kwa kipindi hiki.',
    pdf: 'Pakua ripoti (PDF)',
  },
];

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtNum(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  const n = Math.round(Number(value) * 10) / 10;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function normalizeEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function parentEmailsForStudent(student) {
  const seen = new Set();
  const emails = [];
  const candidates = [
    student.fatherEmail,
    student.motherEmail,
    student.parent?.user?.role === 'PARENT' && student.parent?.user?.isActive
      ? student.parent.user.email
      : null,
  ];
  for (const raw of candidates) {
    const email = normalizeEmail(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

function studentName(student) {
  return [student.lastName, student.postName, student.firstName].filter(Boolean).join(' ');
}

function languageBlockText(lang, ctx) {
  const lines = [
    lang.heading,
    `${lang.student}: ${ctx.name}`,
    `${lang.classLabel}: ${ctx.className}`,
    `${lang.period}: ${ctx.periodTitle}`,
    `${lang.term}: ${ctx.term}`,
    '',
  ];
  if (!ctx.subjects.length) {
    lines.push(lang.none);
    return lines.join('\n');
  }
  lines.push(`${lang.subject} — ${lang.score} / ${lang.outOf}`);
  for (const subject of ctx.subjects) {
    lines.push(`${subject.name}: ${fmtNum(subject.obtained)} / ${fmtNum(subject.maxScore)} (${fmtNum(subject.pct)}%)`);
  }
  if (ctx.standing) {
    lines.push('');
    lines.push(`${lang.total}: ${fmtNum(ctx.standing.obtained)} / ${fmtNum(ctx.standing.maxScore)} (${fmtNum(ctx.standing.pct)}%)`);
    if (ctx.standing.place != null) {
      lines.push(`${lang.rank}: ${ctx.standing.place} ${lang.of} ${ctx.standing.totalStudents}`);
    }
  }
  if (ctx.pdfUrl) {
    lines.push('');
    lines.push(`${lang.pdf}: ${ctx.pdfUrl}`);
  }
  return lines.join('\n');
}

function languageBlockHtml(lang, ctx) {
  const rows = ctx.subjects.map((subject) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${esc(subject.name)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${esc(fmtNum(subject.obtained))}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${esc(fmtNum(subject.maxScore))}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${esc(fmtNum(subject.pct))}%</td>
    </tr>
  `).join('');

  const table = ctx.subjects.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #cbd5e1;">${esc(lang.subject)}</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #cbd5e1;">${esc(lang.score)}</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #cbd5e1;">${esc(lang.outOf)}</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #cbd5e1;">%</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
    : `<p style="margin:0;color:#64748b;">${esc(lang.none)}</p>`;

  const total = ctx.standing
    ? `<p style="margin:12px 0 0;font-size:14px;"><strong>${esc(lang.total)}:</strong> ${esc(fmtNum(ctx.standing.obtained))} / ${esc(fmtNum(ctx.standing.maxScore))} (${esc(fmtNum(ctx.standing.pct))}%)`
      + (ctx.standing.place != null
        ? `<br/><strong>${esc(lang.rank)}:</strong> ${esc(ctx.standing.place)} ${esc(lang.of)} ${esc(ctx.standing.totalStudents)}`
        : '')
      + '</p>'
    : '';

  return `
    <section style="margin:0 0 28px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#0284c7;">${esc(lang.name)}</p>
      <h2 style="margin:0 0 8px;font-size:18px;">${esc(lang.heading)}</h2>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#334155;">
        <strong>${esc(lang.student)}:</strong> ${esc(ctx.name)}<br/>
        <strong>${esc(lang.classLabel)}:</strong> ${esc(ctx.className)}<br/>
        <strong>${esc(lang.period)}:</strong> ${esc(ctx.periodTitle)}<br/>
        <strong>${esc(lang.term)}:</strong> ${esc(ctx.term)}
      </p>
      ${table}
      ${total}
      ${ctx.pdfUrl ? `<p style="margin:14px 0 0;"><a href="${esc(ctx.pdfUrl)}" style="color:#0284c7;font-weight:700;">${esc(lang.pdf)}</a></p>` : ''}
    </section>
  `;
}

function buildMessages(ctx) {
  const text = [
    'École La RACINE',
    ctx.name,
    `${ctx.className} · ${ctx.term} · ${ctx.periodTitle}`,
    '',
    ...LANGS.map((lang) => languageBlockText(lang, ctx)),
  ].join('\n\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0284c7;">École La RACINE</p>
      <h1 style="margin:0 0 4px;font-size:22px;">${esc(ctx.name)}</h1>
      <p style="margin:0 0 20px;color:#64748b;">${esc(ctx.className)} · ${esc(ctx.term)} · ${esc(ctx.periodTitle)}</p>
      ${LANGS.map((lang) => languageBlockHtml(lang, ctx)).join('')}
    </div>
  `;

  return { text, html };
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

const emptySend = (error) => ({
  students: 0,
  sent: 0,
  failed: 0,
  studentsWithoutEmail: 0,
  studentsWithoutMarks: 0,
  error,
});

function bulletinPdfUrl(student, term) {
  if (!student.classId) return '';
  const token = createBulletinPdfToken({
    studentId: student.id,
    classId: student.classId,
    term,
  });
  return buildBulletinPdfUrl(token);
}

export function parentContactsFromStudent(student) {
  const name = studentName(student);
  const contacts = [];
  const add = (role, personName, rawEmail) => {
    const email = normalizeEmail(rawEmail);
    if (!email) return;
    contacts.push({
      key: `${student.id}:${role}:${email}`,
      studentId: student.id,
      studentName: name,
      role,
      name: String(personName || '').trim(),
      email,
    });
  };
  add('father', student.fatherName, student.fatherEmail);
  add('mother', student.motherName, student.motherEmail);
  const portal = student.parent?.user;
  if (portal?.role === 'PARENT' && portal.isActive) {
    add('portal', `${portal.firstName || ''} ${portal.lastName || ''}`, portal.email);
  }
  return contacts;
}

const studentContactSelect = {
  id: true,
  classId: true,
  firstName: true,
  lastName: true,
  postName: true,
  fatherName: true,
  fatherEmail: true,
  motherName: true,
  motherEmail: true,
  class: { select: { name: true, grade: true } },
  parent: {
    select: {
      user: {
        select: { email: true, isActive: true, role: true, firstName: true, lastName: true },
      },
    },
  },
};

export async function listClassParentContacts({ campusId, academicYearId, classId }) {
  const cls = await prisma.class.findFirst({
    where: { id: classId, campusId, academicYearId },
    select: { id: true, name: true, grade: true },
  });
  if (!cls) return { error: 'Classe introuvable', status: 404 };
  if (!isPrimaryGrade(cls.grade)) {
    return { error: 'Les périodes concernent uniquement le primaire', status: 400 };
  }
  const students = await prisma.student.findMany({
    where: {
      classId: cls.id,
      campusId,
      academicYearId,
      registrationStatus: 'APPROVED',
    },
    select: studentContactSelect,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
  return {
    class: { id: cls.id, name: cls.name },
    contacts: students.flatMap(parentContactsFromStudent),
  };
}

export async function emailPeriodMarksToParents(window, { classId = null, recipients = null } = {}) {
  if (!isMailConfigured()) {
    return emptySend(getMailSkipReason() || 'Email not configured');
  }

  const classes = await prisma.class.findMany({
    where: { campusId: window.campusId, academicYearId: window.academicYearId },
    select: { id: true, name: true, grade: true },
  });
  const primaryIds = classes.filter((cls) => isPrimaryGrade(cls.grade)).map((cls) => cls.id);
  if (classId && !primaryIds.includes(classId)) {
    return emptySend('Choisissez une classe primaire');
  }
  const classIds = classId ? [classId] : primaryIds;
  if (!classIds.length) {
    return emptySend('Aucune classe primaire pour cette année');
  }

  const allowedRecipients = Array.isArray(recipients)
    ? new Set(recipients
      .map((row) => {
        const email = normalizeEmail(row?.email);
        const studentId = String(row?.studentId || '');
        return email && studentId ? `${studentId}:${email}` : '';
      })
      .filter(Boolean))
    : null;
  if (allowedRecipients && !allowedRecipients.size) {
    return emptySend('Choisissez au moins un parent');
  }

  const students = await prisma.student.findMany({
    where: {
      campusId: window.campusId,
      academicYearId: window.academicYearId,
      classId: { in: classIds },
      registrationStatus: 'APPROVED',
    },
    select: studentContactSelect,
  });

  const [results, standings] = await Promise.all([
    prisma.midtermResult.findMany({
      where: { windowId: window.id, studentId: { in: students.map((s) => s.id) } },
      include: { subject: { select: { name: true, sortOrder: true } } },
    }),
    prisma.midtermStanding.findMany({
      where: { windowId: window.id, studentId: { in: students.map((s) => s.id) } },
    }),
  ]);

  const resultsByStudent = new Map();
  for (const row of results) {
    if (!resultsByStudent.has(row.studentId)) resultsByStudent.set(row.studentId, []);
    resultsByStudent.get(row.studentId).push(row);
  }
  const standingByStudent = new Map(standings.map((row) => [row.studentId, row]));

  const jobs = [];
  let studentsWithoutEmail = 0;
  let studentsWithoutMarks = 0;

  for (const student of students) {
    const subjectRows = (resultsByStudent.get(student.id) || [])
      .filter((row) => row.obtained != null)
      .sort((a, b) => (a.subject?.sortOrder ?? 0) - (b.subject?.sortOrder ?? 0))
      .map((row) => ({
        name: row.subject?.name || '—',
        obtained: row.obtained,
        maxScore: row.maxScore,
        pct: row.pct,
      }));
    const standing = standingByStudent.get(student.id) || null;
    if (!subjectRows.length && !standing) {
      const targeted = !allowedRecipients || parentEmailsForStudent(student).some((email) => (
        allowedRecipients.has(`${student.id}:${email}`)
      ));
      if (targeted) studentsWithoutMarks += 1;
      continue;
    }
    let emails = parentEmailsForStudent(student);
    if (allowedRecipients) {
      emails = emails.filter((email) => allowedRecipients.has(`${student.id}:${email}`));
      if (!emails.length) continue;
    } else if (!emails.length) {
      studentsWithoutEmail += 1;
      continue;
    }
    const ctx = {
      name: studentName(student),
      className: student.class?.name || '—',
      periodTitle: window.title,
      term: window.term,
      pdfUrl: bulletinPdfUrl(student, window.term),
      subjects: subjectRows,
      standing: standing
        ? {
          obtained: standing.obtained,
          maxScore: standing.maxScore,
          pct: standing.pct,
          place: standing.place,
          totalStudents: standing.totalStudents,
        }
        : null,
    };
    const { text, html } = buildMessages(ctx);
    const subject = `La RACINE: ${ctx.name} — ${window.title} (${window.term})`;
    for (const to of emails) {
      jobs.push({ to, subject, text, html });
    }
  }

  let sent = 0;
  let failed = 0;
  let firstError = '';
  await mapPool(jobs, 4, async (job) => {
    try {
      await sendMail(job);
      sent += 1;
    } catch (err) {
      failed += 1;
      if (!firstError) firstError = err.message || 'Send failed';
    }
  });

  return {
    students: students.length,
    sent,
    failed,
    studentsWithoutEmail,
    studentsWithoutMarks,
    error: failed ? firstError : undefined,
  };
}
