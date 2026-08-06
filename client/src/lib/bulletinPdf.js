import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const BREAKABLE_SELECTOR = [
  '.bulletin-table thead tr',
  '.bulletin-table tbody tr',
  '.nursery-bulletin-table thead tr',
  '.nursery-bulletin-table tbody tr',
  '.bulletin-header',
  '.bulletin-student-bar',
  '.bulletin-midterm-strip',
  '.bulletin-decisions',
  '.bulletin-signatures',
  '.bulletin-footer',
  '.nursery-bulletin-header',
  '.nursery-bulletin-info',
  '.nursery-bulletin-title',
  '.nursery-bulletin-contacts',
  '.nursery-bulletin-bottom',
  '.nursery-bulletin-decision',
  '.nursery-bulletin-legend',
  '.nursery-bulletin-comment',
  '.nursery-bulletin-signatures',
  '.nursery-bulletin-qr',
].join(', ');

async function captureBulletinCanvas(element) {
  if (!element) throw new Error('Bulletin element not found');

  element.classList.add('is-pdf-export');
  // Let layout settle with export paddings before rasterizing
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    return await html2canvas(element, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 20000,
      width: element.offsetWidth,
      height: Math.max(element.scrollHeight, element.offsetHeight),
      windowWidth: Math.max(element.scrollWidth, element.offsetWidth),
      windowHeight: Math.max(element.scrollHeight, element.offsetHeight),
    });
  } finally {
    element.classList.remove('is-pdf-export');
  }
}

function triggerDownload(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Map DOM block bottoms to canvas Y so we can break between rows, not through them.
 */
function collectSafeBreakYs(element, canvasHeight) {
  const sheetRect = element.getBoundingClientRect();
  const scaleY = canvasHeight / Math.max(element.offsetHeight, 1);
  const breaks = new Set([0, Math.round(canvasHeight)]);

  element.querySelectorAll(BREAKABLE_SELECTOR).forEach((node) => {
    const rect = node.getBoundingClientRect();
    const top = Math.round((rect.top - sheetRect.top) * scaleY);
    const bottom = Math.round((rect.bottom - sheetRect.top) * scaleY);
    if (top > 0) breaks.add(top);
    if (bottom > 0) breaks.add(bottom);
  });

  return [...breaks].sort((a, b) => a - b);
}

/**
 * Prefer the last safe break at or before idealEnd so table rows stay intact.
 */
function pickSliceEnd(sourceY, idealEnd, canvasHeight, safeYs) {
  const hardEnd = Math.min(Math.ceil(idealEnd), canvasHeight);
  if (hardEnd >= canvasHeight - 1) return canvasHeight;

  const minSlice = Math.max(48, Math.round((hardEnd - sourceY) * 0.15));
  let chosen = null;
  for (const y of safeYs) {
    if (y > sourceY + minSlice && y <= hardEnd) {
      chosen = y;
    }
  }
  if (chosen != null) return chosen;

  // Next safe break slightly past the page — shorten this page instead of cutting a row
  const overflowBreak = safeYs.find((y) => y > hardEnd && y < hardEnd + (hardEnd - sourceY) * 0.35);
  if (overflowBreak != null && overflowBreak - sourceY > minSlice) {
    // Stay on hardEnd; content continues cleanly on next page from a row boundary if possible
    const earlier = safeYs.filter((y) => y > sourceY + minSlice && y < hardEnd);
    if (earlier.length) return earlier[earlier.length - 1];
  }

  return hardEnd;
}

/**
 * Slice a full-width canvas into A4 portrait pages at readable scale.
 * Breaks between rows when possible so nothing is cropped mid-line.
 * Stamps "Page X / Y" on every page.
 */
function addCanvasAsPagedPdf(pdf, canvas, element, { marginMm = 6, footerMm = 8 } = {}) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginMm * 2;
  const maxHeight = pageHeight - marginMm * 2 - footerMm;

  const renderWidth = maxWidth;
  const pxPerMm = canvas.width / renderWidth;
  const pageHeightPx = maxHeight * pxPerMm;
  const safeYs = element
    ? collectSafeBreakYs(element, canvas.height)
    : [0, canvas.height];

  const slices = [];
  let sourceY = 0;
  while (sourceY < canvas.height - 0.5) {
    const idealEnd = sourceY + pageHeightPx;
    const endY = pickSliceEnd(sourceY, idealEnd, canvas.height, safeYs);
    const sliceHeightPx = Math.max(1, endY - sourceY);
    slices.push({ sourceY, sliceHeightPx });
    sourceY += sliceHeightPx;
    if (slices.length > 20) break;
  }

  const totalPages = slices.length;

  slices.forEach((slice, pageIndex) => {
    if (pageIndex > 0) pdf.addPage();

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.max(1, Math.ceil(slice.sliceHeightPx));

    const ctx = sliceCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      slice.sourceY,
      canvas.width,
      slice.sliceHeightPx,
      0,
      0,
      canvas.width,
      slice.sliceHeightPx,
    );

    const sliceHeightMm = slice.sliceHeightPx / pxPerMm;
    const imgData = sliceCanvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', marginMm, marginMm, renderWidth, sliceHeightMm, undefined, 'FAST');

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(80, 80, 80);
    const label = `Page ${pageIndex + 1} / ${totalPages}`;
    pdf.text(label, pageWidth / 2, pageHeight - marginMm * 0.55, { align: 'center' });
  });

  return totalPages;
}

/**
 * Capture a bulletin DOM node as a clear multi-page A4 portrait PDF.
 * Content keeps natural size; tall bulletins continue on page 2+ without cutting rows.
 */
export async function downloadBulletinPdf(element, filename = 'bulletin-scolaire.pdf') {
  const isNursery = element.classList?.contains('nursery-bulletin-sheet');
  const canvas = await captureBulletinCanvas(element);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addCanvasAsPagedPdf(pdf, canvas, element, {
    marginMm: isNursery ? 6 : 7,
    footerMm: isNursery ? 8 : 7,
  });
  pdf.save(filename);
}

/**
 * Capture a bulletin DOM node as a high-quality JPEG download.
 */
export async function downloadBulletinJpeg(element, filename = 'bulletin-scolaire.jpg') {
  const canvas = await captureBulletinCanvas(element);
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  triggerDownload(imgData, filename);
}
