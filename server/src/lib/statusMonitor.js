import prisma from './prisma.js';
import { getClientBaseUrl, getMailSkipReason, sendMail } from './mailer.js';

const CHECK_EVERY_MS = 5 * 60 * 1000;
const NOTIFY_RETRY_MS = 15 * 60 * 1000;
const SLOW_MS = 1200;

const STATUS_SERVICES = [
  { id: 'website', group: 'website', en: 'School website', fr: 'Site de l’école', run: () => prisma.websiteContent.count() },
  { id: 'portal', group: 'portal', en: 'Portal sign-in', fr: 'Connexion au portail', run: () => prisma.user.count() },
  { id: 'students', group: 'portal', en: 'Student records', fr: 'Dossiers des élèves', run: () => prisma.student.count() },
  { id: 'fees', group: 'portal', en: 'Fees and payments', fr: 'Frais et paiements', run: () => prisma.feePayment.count() },
  { id: 'library', group: 'portal', en: 'Library', fr: 'Bibliothèque', run: () => prisma.book.count() },
  { id: 'database', group: 'platform', en: 'School database', fr: 'Base de données', run: () => prisma.$queryRaw`SELECT 1` },
];

const RANK = { up: 0, degraded: 1, down: 2 };
const LABEL = {
  up: { en: 'Operational', fr: 'Opérationnel' },
  degraded: { en: 'Slow', fr: 'Ralenti' },
  down: { en: 'Outage', fr: 'Panne' },
};

let currentRun = null;
let lastNotifyFailureAt = 0;

export function dayKey(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function isoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function checkService(service) {
  const started = Date.now();
  try {
    await service.run();
    const latencyMs = Date.now() - started;
    return { status: latencyMs > SLOW_MS ? 'degraded' : 'up', latencyMs };
  } catch {
    return { status: 'down', latencyMs: Date.now() - started };
  }
}

function statusLabel(status) {
  return LABEL[status] || { en: status, fr: status };
}

async function sendStatusChangeEmail(emails, changes) {
  const url = `${getClientBaseUrl()}/status`;
  const lines = changes.map((item) => {
    const from = statusLabel(item.from);
    const to = statusLabel(item.to);
    return `${item.en}: ${from.en} → ${to.en}\n${item.fr} : ${from.fr} → ${to.fr}`;
  });
  const text = [
    'École La RACINE — a service status changed.',
    'École La RACINE — l’état d’un service a changé.',
    '',
    ...lines,
    '',
    `Status page / Page d’état : ${url}`,
    '',
    'This address is subscribed to school status updates.',
    'Cette adresse est inscrite aux alertes d’état de l’école.',
  ].join('\n');
  const items = lines.map((line) => `<li>${line.replace(/\n/g, '<br>')}</li>`).join('');
  const html = `<p><strong>École La RACINE</strong></p><ul>${items}</ul><p><a href="${url}">${url}</a></p><p>This address is subscribed to school status updates.<br>Cette adresse est inscrite aux alertes d’état de l’école.</p>`;
  const from = String(process.env.SMTP_USER || '').trim();
  await sendMail({
    to: from,
    bcc: emails,
    subject: 'École La RACINE — status changed',
    text,
    html,
  });
}

async function performStatusCheck() {
  const today = dayKey(new Date());
  const checks = await Promise.all(STATUS_SERVICES.map(async (service) => ({
    id: service.id,
    group: service.group,
    en: service.en,
    fr: service.fr,
    ...(await checkService(service)),
  })));

  const states = await prisma.statusServiceState.findMany();
  const known = new Map(states.map((row) => [row.service, row.notifiedStatus]));
  const changes = checks
    .filter((item) => known.get(item.id) && known.get(item.id) !== item.status)
    .map((item) => ({ ...item, from: known.get(item.id), to: item.status }));

  for (const item of checks) {
    const existing = await prisma.statusSample.findUnique({
      where: { service_day: { service: item.id, day: today } },
    });
    const barStatus = existing && (RANK[existing.status] ?? 0) > (RANK[item.status] ?? 0)
      ? existing.status
      : item.status;
    await prisma.statusSample.upsert({
      where: { service_day: { service: item.id, day: today } },
      update: { status: barStatus, latencyMs: item.latencyMs, checkedAt: new Date() },
      create: { service: item.id, day: today, status: item.status, latencyMs: item.latencyMs },
    });
  }

  let toldSubscribers = changes.length === 0;
  if (changes.length) {
    const subscribers = await prisma.statusSubscriber.findMany({ select: { email: true } });
    if (!subscribers.length) {
      toldSubscribers = true;
    } else if (Date.now() - lastNotifyFailureAt < NOTIFY_RETRY_MS) {
      toldSubscribers = false;
    } else {
      const skip = getMailSkipReason();
      if (skip) {
        lastNotifyFailureAt = Date.now();
        console.error(`Status change email was not sent: ${skip}`);
      } else {
        try {
          await sendStatusChangeEmail(subscribers.map((row) => row.email), changes);
          toldSubscribers = true;
          console.log(`Status change email sent to ${subscribers.length} subscriber(s).`);
        } catch (error) {
          lastNotifyFailureAt = Date.now();
          console.error(`Status change email was not sent: ${error.message}`);
        }
      }
    }
  }

  for (const item of checks) {
    await prisma.statusServiceState.upsert({
      where: { service: item.id },
      update: {
        status: item.status,
        ...(toldSubscribers ? { notifiedStatus: item.status } : {}),
      },
      create: {
        service: item.id,
        status: item.status,
        notifiedStatus: toldSubscribers ? item.status : null,
      },
    });
  }

  return checks;
}

export async function emailStatusSubscription(email) {
  const checks = await runStatusCheck();
  const url = `${getClientBaseUrl()}/status`;
  const lines = checks.map((item) => {
    const label = statusLabel(item.status);
    return `${item.en}: ${label.en}\n${item.fr} : ${label.fr}`;
  });
  const text = [
    'You are subscribed to École La RACINE status updates.',
    'Vous êtes inscrit aux alertes d’état de l’École La RACINE.',
    '',
    'Current status / État actuel',
    ...lines,
    '',
    `Status page / Page d’état : ${url}`,
    '',
    'Another email is sent only when a service changes.',
    'Un autre e-mail part seulement quand un service change.',
  ].join('\n');
  const items = lines.map((line) => `<li>${line.replace(/\n/g, '<br>')}</li>`).join('');
  const html = `<p>You are subscribed to <strong>École La RACINE</strong> status updates.<br>Vous êtes inscrit aux alertes d’état de l’École La RACINE.</p><ul>${items}</ul><p><a href="${url}">${url}</a></p><p>Another email is sent only when a service changes.<br>Un autre e-mail part seulement quand un service change.</p>`;
  await sendMail({
    to: email,
    subject: 'École La RACINE — status subscription',
    text,
    html,
  });
}

export function runStatusCheck() {
  if (!currentRun) {
    currentRun = performStatusCheck().finally(() => {
      currentRun = null;
    });
  }
  return currentRun;
}

export function startStatusMonitor() {
  const tick = () => {
    runStatusCheck().catch((error) => {
      console.error(`Status check failed: ${error.message}`);
    });
  };
  setTimeout(tick, 15_000);
  setInterval(tick, CHECK_EVERY_MS);
}
