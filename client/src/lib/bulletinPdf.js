import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
 * Place the whole bulletin on one A4 page.
 * The layout is unchanged; only the zoom shrinks so width and height both fit.
 */
function addCanvasOnSingleA4(pdf, canvas, { marginMm = 5 } = {}) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginMm * 2;
  const maxHeight = pageHeight - marginMm * 2;

  const widthScale = maxWidth / canvas.width;
  const heightScale = maxHeight / canvas.height;
  const scale = Math.min(widthScale, heightScale);
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  const x = marginMm + (maxWidth - width) / 2;
  const y = marginMm;

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', x, y, width, height, undefined, 'SLOW');
}

/**
 * Capture a bulletin DOM node as one A4 page.
 * Tall bulletins are zoomed out so the full sheet stays on a single page.
 */
export async function downloadBulletinPdf(element, filename = 'bulletin-scolaire.pdf') {
  const isAnnual = Boolean(element.querySelector?.('.bulletin-is-annual') || element.classList?.contains('bulletin-is-annual'));
  const canvas = await captureBulletinCanvas(element);

  const pdf = new jsPDF({
    orientation: isAnnual ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  addCanvasOnSingleA4(pdf, canvas, { marginMm: 5 });
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
