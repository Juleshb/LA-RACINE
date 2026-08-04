import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

async function captureBulletinCanvas(element) {
  if (!element) throw new Error('Bulletin element not found');

  // Watermark muddies small competence text in the raster export
  const watermark = element.querySelector('.nursery-bulletin-watermark');
  const prevWatermarkDisplay = watermark?.style.display;
  if (watermark) watermark.style.display = 'none';

  try {
    return await html2canvas(element, {
      scale: 4,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 20000,
      width: element.offsetWidth,
      height: element.offsetHeight,
      windowWidth: Math.max(element.scrollWidth, element.offsetWidth),
      windowHeight: Math.max(element.scrollHeight, element.offsetHeight),
    });
  } finally {
    if (watermark) watermark.style.display = prevWatermarkDisplay || '';
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
 * Capture a bulletin DOM node as one clear A4 portrait PDF.
 * High-DPI PNG inside the PDF keeps text sharp when fitted to the page.
 */
export async function downloadBulletinPdf(element, filename = 'bulletin-scolaire.pdf') {
  const isNursery = element.classList?.contains('nursery-bulletin-sheet');
  const canvas = await captureBulletinCanvas(element);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgData = canvas.toDataURL('image/png');

  const margin = isNursery ? 3 : 6;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;

  let renderWidth = maxWidth;
  let renderHeight = (canvas.height / canvas.width) * renderWidth;
  if (renderHeight > maxHeight) {
    renderHeight = maxHeight;
    renderWidth = (canvas.width / canvas.height) * renderHeight;
  }

  const offsetX = margin + (maxWidth - renderWidth) / 2;
  const offsetY = margin;

  pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'NONE');
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
