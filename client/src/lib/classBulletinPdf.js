import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import BulletinScolaireSheet from '../components/bulletin/BulletinScolaireSheet';
import NurseryBulletinSheet from '../components/bulletin/NurseryBulletinSheet';
import { addBulletinPage, captureBulletinCanvas, createBulletinPdf } from './bulletinPdf';

function studentSortName(report) {
  const student = report?.student || {};
  return [student.lastName, student.postName, student.firstName].filter(Boolean).join(' ');
}

export function sortBulletinsByPlace(reports) {
  return [...reports].sort((a, b) => {
    const left = a?.rank?.place ?? 9999;
    const right = b?.rank?.place ?? 9999;
    if (left !== right) return left - right;
    return studentSortName(a).localeCompare(studentSortName(b), 'fr', { sensitivity: 'base' });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBulletin(host) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const images = [...host.querySelectorAll('img')];
    const imagesReady = images.every((img) => img.complete);
    const qrPending = Boolean(host.querySelector('.bulletin-qr-placeholder'));
    if (imagesReady && !qrPending && host.querySelector('.bulletin-scolaire-sheet, .nursery-bulletin-sheet')) {
      return;
    }
    await wait(40);
  }
}

/**
 * One PDF, one page per student, in class-place order.
 * onProgress receives { done, total } while each page is drawn.
 */
export async function downloadClassBulletinsPdf(reports, filename, onProgress) {
  const ready = sortBulletinsByPlace(reports).filter(Boolean);
  if (!ready.length) throw new Error('No bulletins to download');

  const annual = Boolean(ready[0].annual);
  const pdf = createBulletinPdf(annual);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;width:max-content;background:#ffffff;';
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    for (let index = 0; index < ready.length; index += 1) {
      const report = ready[index];
      const Sheet = report.mode === 'COMPETENCE' ? NurseryBulletinSheet : BulletinScolaireSheet;
      root.render(createElement(Sheet, { report, id: `class-bulletin-${index}` }));
      await wait(30);
      await waitForBulletin(host);
      const element = host.querySelector('.bulletin-scolaire-sheet, .nursery-bulletin-sheet');
      if (!element) throw new Error('Bulletin could not be drawn');
      const canvas = await captureBulletinCanvas(element);
      addBulletinPage(pdf, canvas, { first: index === 0, isAnnual: Boolean(report.annual) });
      onProgress?.({ done: index + 1, total: ready.length });
    }
  } finally {
    root.unmount();
    host.remove();
  }

  pdf.save(filename);
}
