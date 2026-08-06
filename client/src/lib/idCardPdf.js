import { jsPDF } from 'jspdf';

/** CR80 ID card size in mm */
export const ID_CARD_WIDTH_MM = 85.6;
export const ID_CARD_HEIGHT_MM = 54;

/** Logical pixel size of the card design */
export const ID_CARD_WIDTH_PX = 406;
export const ID_CARD_HEIGHT_PX = 256;

const EXPORT_SCALE = 3;

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, fill) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawCoverImage(ctx, img, x, y, w, h) {
  if (!img) return;
  const ir = img.width / img.height;
  const br = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (ir > br) {
    sw = img.height * br;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / br;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawContainImage(ctx, img, x, y, w, h) {
  if (!img) return;
  const ir = img.width / img.height;
  const br = w / h;
  let dw = w;
  let dh = h;
  let dx = x;
  let dy = y;
  if (ir > br) {
    dh = w / ir;
    dy = y + (h - dh) / 2;
  } else {
    dw = h * ir;
    dx = x + (w - dw) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawText(ctx, text, x, y, {
  size = 12,
  weight = '700',
  color = '#0b2840',
  maxWidth,
  align = 'left',
  baseline = 'alphabetic',
  family = 'Arial, Helvetica, sans-serif',
} = {}) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  const value = String(text || '—');
  if (maxWidth) ctx.fillText(value, x, y, maxWidth);
  else ctx.fillText(value, x, y);
}

/**
 * Paint a complete CR80 ID card onto a high-res canvas (no html2canvas).
 * Matches the on-screen branded design for reliable PDF/JPEG export.
 */
export async function renderIdCardCanvas({
  kind = 'student',
  fields,
  photoUrl = null,
  schoolName = 'École La RACINE',
  campusName = '',
  academicYear = '',
} = {}) {
  const isStaff = kind === 'staff';
  const theme = isStaff
    ? {
      ink: '#14261a',
      muted: '#5c6b60',
      deep: '#14532d',
      panelTop: '#ffffff',
      panelMid: '#f3f7ee',
      panelEnd: '#eaf3df',
      topA: '#14532d',
      topB: '#3f6212',
      topC: '#84cc16',
      footA: '#14532d',
      footB: '#3f6212',
      factBorder: '#a3e635',
      photoEdge: '#84cc16',
      photoBg: '#ecfccb',
      kindLabel: 'PERSONNEL',
    }
    : {
      ink: '#0b2840',
      muted: '#5b6b78',
      deep: '#0c4a6e',
      panelTop: '#ffffff',
      panelMid: '#f3f8fc',
      panelEnd: '#eaf4fb',
      topA: '#0b3d5c',
      topB: '#0369a1',
      topC: '#38bdf8',
      footA: '#0b3d5c',
      footB: '#075985',
      factBorder: '#7dd3fc',
      photoEdge: '#0ea5e9',
      photoBg: '#e0f2fe',
      kindLabel: 'CARTE ÉLÈVE',
    };

  const [logo, photo, seal, signature] = await Promise.all([
    loadImage('/logo.png'),
    loadImage(photoUrl),
    loadImage('/bulletin/sceau-directeur.png'),
    loadImage('/bulletin/signature-directeur.png'),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = ID_CARD_WIDTH_PX * EXPORT_SCALE;
  canvas.height = ID_CARD_HEIGHT_PX * EXPORT_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const W = ID_CARD_WIDTH_PX;
  const H = ID_CARD_HEIGHT_PX;

  // Clip everything to rounded card
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 16);
  ctx.clip();

  // Card background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, theme.panelTop);
  bg.addColorStop(0.55, theme.panelMid);
  bg.addColorStop(1, theme.panelEnd);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft glow
  const glow = ctx.createRadialGradient(W - 40, 120, 10, W - 40, 120, 140);
  glow.addColorStop(0, isStaff ? 'rgba(101,163,13,0.16)' : 'rgba(2,132,199,0.16)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Watermark logo
  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    drawContainImage(ctx, logo, W - 138, 72, 120, 120);
    ctx.restore();
  }

  // Header band
  const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
  headerGrad.addColorStop(0, theme.topA);
  headerGrad.addColorStop(0.72, theme.topB);
  headerGrad.addColorStop(1, theme.topC);
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, W, 54);

  // Gold accent line under header
  const gold = ctx.createLinearGradient(0, 0, W, 0);
  gold.addColorStop(0, '#fbbf24');
  gold.addColorStop(0.5, '#fde68a');
  gold.addColorStop(1, '#fbbf24');
  ctx.fillStyle = gold;
  ctx.fillRect(0, 51, W, 3);

  // Logo tile
  fillRoundRect(ctx, 14, 10, 34, 34, 8, 'rgba(255,255,255,0.95)');
  if (logo) drawContainImage(ctx, logo, 17, 13, 28, 28);

  // School name + campus
  drawText(ctx, schoolName, 56, 24, {
    size: 14,
    weight: '700',
    color: '#ffffff',
    maxWidth: 230,
    family: 'Georgia, Times New Roman, serif',
  });
  const campusLine = [campusName, academicYear].filter(Boolean).join(' · ') || 'Rwanda';
  drawText(ctx, campusLine, 56, 40, {
    size: 10,
    weight: '500',
    color: 'rgba(255,255,255,0.85)',
    maxWidth: 230,
  });

  // Kind badge
  const badgeLabel = theme.kindLabel;
  ctx.font = '700 9px Arial, Helvetica, sans-serif';
  const badgeW = Math.ceil(ctx.measureText(badgeLabel).width) + 18;
  const badgeX = W - 14 - badgeW;
  fillRoundRect(ctx, badgeX, 16, badgeW, 22, 6, 'rgba(255,255,255,0.94)');
  drawText(ctx, badgeLabel, badgeX + badgeW / 2, 31, {
    size: 9,
    weight: '700',
    color: theme.deep,
    align: 'center',
  });

  // Photo frame
  const photoX = 14;
  const photoY = 66;
  const photoW = 86;
  const photoH = 104;
  fillRoundRect(ctx, photoX, photoY, photoW, photoH, 8, theme.photoBg);
  ctx.save();
  roundRect(ctx, photoX, photoY, photoW, photoH, 8);
  ctx.clip();
  if (photo) {
    drawCoverImage(ctx, photo, photoX, photoY, photoW, photoH);
  } else {
    // Placeholder person silhouette
    ctx.fillStyle = isStaff ? '#a3e635' : '#7dd3fc';
    ctx.beginPath();
    ctx.arc(photoX + photoW / 2, photoY + 38, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(photoX + photoW / 2, photoY + 84, 26, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = theme.deep;
  ctx.lineWidth = 2;
  roundRect(ctx, photoX, photoY, photoW, photoH, 8);
  ctx.stroke();

  // Photo accent corner
  ctx.strokeStyle = theme.photoEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(photoX - 2, photoY + photoH - 18);
  ctx.lineTo(photoX - 2, photoY + photoH + 2);
  ctx.lineTo(photoX + 18, photoY + photoH + 2);
  ctx.stroke();

  // Identity fields
  const fieldX = 114;
  drawText(ctx, fields?.name || '—', fieldX, 82, {
    size: 15,
    weight: '700',
    color: theme.ink,
    maxWidth: 270,
    family: 'Georgia, Times New Roman, serif',
  });

  const rows = fields?.rows || [];
  const colXs = [fieldX, 260];
  rows.forEach((row, index) => {
    const col = index % 2;
    const rowIndex = Math.floor(index / 2);
    const x = colXs[col];
    const y = 96 + rowIndex * 36;

    ctx.fillStyle = theme.factBorder;
    ctx.fillRect(x, y, 2, 28);

    drawText(ctx, row.label, x + 10, y + 10, {
      size: 8,
      weight: '700',
      color: theme.muted,
      maxWidth: 120,
    });
    drawText(ctx, row.value, x + 10, y + 24, {
      size: 12,
      weight: '700',
      color: theme.ink,
      maxWidth: 120,
    });
  });

  // Footer band
  const footGrad = ctx.createLinearGradient(0, 0, W, 0);
  footGrad.addColorStop(0, theme.footA);
  footGrad.addColorStop(1, theme.footB);
  ctx.fillStyle = footGrad;
  ctx.fillRect(0, H - 34, W, 34);

  drawText(ctx, 'Discipline · Intelligence · Innovation', 14, H - 14, {
    size: 9,
    weight: '600',
    color: 'rgba(255,255,255,0.9)',
    maxWidth: 220,
  });

  // Signature + seal (director authentication)
  const sealSize = 26;
  const sealX = W - 14 - sealSize;
  const sealY = H - 30;
  const sigW = 64;
  const sigH = 20;
  const sigX = sealX - 8 - sigW;
  const sigY = H - 28;

  if (signature) {
    ctx.save();
    // Light plate behind dark ink signatures so they read on green footer
    fillRoundRect(ctx, sigX - 4, sigY - 2, sigW + 8, sigH + 4, 4, 'rgba(255,255,255,0.9)');
    drawContainImage(ctx, signature, sigX, sigY, sigW, sigH);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(sealX + sealSize / 2, sealY + sealSize / 2, sealSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  if (seal) drawContainImage(ctx, seal, sealX + 2, sealY + 2, sealSize - 4, sealSize - 4);

  ctx.restore();
  return canvas;
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
 * Build export field payload from a student card.
 */
export function studentCardExportFields(student, academicYear) {
  const name = [student?.lastName, student?.postName, student?.firstName]
    .filter(Boolean)
    .join(' ')
    .toUpperCase() || '—';
  return {
    name,
    rows: [
      { label: 'MATRICULE', value: student?.studentId || '—' },
      { label: 'CLASSE', value: student?.class?.name || student?.registrationClass || '—' },
      { label: 'ANNÉE', value: academicYear || '—' },
      {
        label: 'SEXE',
        value: student?.gender === 'FEMALE' ? 'F' : student?.gender === 'MALE' ? 'M' : '—',
      },
    ],
  };
}

/**
 * Build export field payload from a staff card.
 */
export function staffCardExportFields(staff, academicYear, roleLabel = 'ENSEIGNANT') {
  const name = String(staff?.name || `${staff?.firstName || ''} ${staff?.lastName || ''}`)
    .trim()
    .toUpperCase() || '—';
  return {
    name,
    rows: [
      { label: 'FONCTION', value: roleLabel || '—' },
      { label: 'MATIÈRE', value: staff?.subject || '—' },
      { label: 'TÉL', value: staff?.phone || '—' },
      { label: 'ANNÉE', value: academicYear || '—' },
    ],
  };
}

/**
 * Download a single ID card as a CR80-sized PDF (landscape).
 */
export async function downloadIdCardPdf(options, filename = 'id-card.pdf') {
  // Back-compat: old signature (element, filename, fields)
  if (options instanceof HTMLElement) {
    const element = options;
    const fields = arguments[2];
    const isStaff = element.classList?.contains('id-card-staff')
      || element.querySelector?.('.id-card-staff');
    const canvas = await renderIdCardCanvas({
      kind: isStaff ? 'staff' : 'student',
      fields,
      photoUrl: element.querySelector?.('.id-card-photo')?.src || null,
      schoolName: element.querySelector?.('.id-card-school')?.textContent || 'École La RACINE',
      campusName: '',
      academicYear: '',
    });
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [ID_CARD_WIDTH_MM, ID_CARD_HEIGHT_MM],
    });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, ID_CARD_WIDTH_MM, ID_CARD_HEIGHT_MM, undefined, 'NONE');
    pdf.save(filename);
    return;
  }

  const canvas = await renderIdCardCanvas(options);
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [ID_CARD_WIDTH_MM, ID_CARD_HEIGHT_MM],
  });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, ID_CARD_WIDTH_MM, ID_CARD_HEIGHT_MM, undefined, 'NONE');
  pdf.save(filename || 'id-card.pdf');
}

/**
 * Download a single ID card as a high-quality JPEG.
 */
export async function downloadIdCardJpeg(options, filename = 'id-card.jpg') {
  if (options instanceof HTMLElement) {
    const element = options;
    const fields = arguments[2];
    const isStaff = element.classList?.contains('id-card-staff')
      || element.querySelector?.('.id-card-staff');
    const canvas = await renderIdCardCanvas({
      kind: isStaff ? 'staff' : 'student',
      fields,
      photoUrl: element.querySelector?.('.id-card-photo')?.src || null,
      schoolName: element.querySelector?.('.id-card-school')?.textContent || 'École La RACINE',
    });
    triggerDownload(canvas.toDataURL('image/jpeg', 0.95), filename);
    return;
  }

  const canvas = await renderIdCardCanvas(options);
  triggerDownload(canvas.toDataURL('image/jpeg', 0.95), filename || 'id-card.jpg');
}
