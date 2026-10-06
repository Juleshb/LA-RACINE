import ExcelJS from 'exceljs';

const THIN = { style: 'thin', color: { argb: 'FF94A3B8' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function clean(value) {
  return String(value ?? '').trim();
}

function unique(values) {
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const text = clean(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out;
}

function schoolTitle(school) {
  return clean(school?.name || 'École La RACINE').toUpperCase();
}

function campusTitle(campus) {
  const district = clean(campus?.district);
  const city = clean(campus?.city);
  if (district && city) return `${district} - ${city}`.toUpperCase();
  return clean(campus?.name).toUpperCase();
}

function yearTitle(academicYear) {
  return clean(academicYear?.name).replace(/\s*[-–]\s*/g, ' - ').toUpperCase();
}

function sheetName(name) {
  const cleaned = clean(name).replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').slice(0, 31);
  return cleaned || 'Eleves';
}

function fileName(name) {
  const safe = clean(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'classe';
  return `liste-eleves-${safe}.xlsx`;
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function sortedStudents(students) {
  return [...(students || [])].sort((a, b) => {
    const left = [a.lastName, a.postName, a.firstName].map(clean).join(' ');
    const right = [b.lastName, b.postName, b.firstName].map(clean).join(' ');
    return left.localeCompare(right, 'fr', { sensitivity: 'base' });
  });
}

function paintHeader(sheet, row, value, { size = 12, bold = true } = {}) {
  sheet.mergeCells(row, 2, row, 6);
  const cell = sheet.getCell(row, 2);
  cell.value = value;
  cell.font = { name: 'Calibri', size, bold, color: { argb: 'FF0B2840' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
}

/**
 * Class student list workbook matching the school list:
 * letterhead, logo on the left and right, then S/N, ID, last name, surname, first name.
 */
export async function buildClassStudentListWorkbook({
  cls,
  students,
  school,
  campus,
  academicYear,
  logoBuffer,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = schoolTitle(school);
  const sheet = workbook.addWorksheet(sheetName(cls?.name), {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
    },
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { width: 3 },
    { width: 8 },
    { width: 18 },
    { width: 24 },
    { width: 24 },
    { width: 26 },
  ];

  sheet.getRow(3).height = 12;
  sheet.getRow(4).height = 22;
  sheet.getRow(5).height = 18;
  sheet.getRow(6).height = 16;
  sheet.getRow(7).height = 16;
  sheet.getRow(8).height = 10;
  sheet.getRow(9).height = 20;
  sheet.getRow(10).height = 18;
  sheet.getRow(11).height = 10;
  sheet.getRow(12).height = 20;

  paintHeader(sheet, 4, schoolTitle(school), { size: 16 });
  const place = campusTitle(campus);
  if (place) paintHeader(sheet, 5, place, { size: 12 });

  const phones = unique([school?.phone1, school?.phone2, campus?.phone]);
  if (phones.length) paintHeader(sheet, 6, `Tel: ${phones.join(', ')}`, { size: 11, bold: false });

  const emails = unique([school?.email, campus?.email]);
  if (emails.length) paintHeader(sheet, 7, `E-mail: ${emails.join(', ')}`, { size: 11, bold: false });

  const year = yearTitle(academicYear);
  paintHeader(sheet, 9, year ? `LISTE DES ELEVES ${year}` : 'LISTE DES ELEVES', { size: 13 });
  paintHeader(sheet, 10, `CLASSE : ${clean(cls?.name || '—').toUpperCase()}`, { size: 12 });

  const headers = ['S/N', 'STUDENT ID', 'LAST NAME', 'SURNAME', 'FIRST NAME'];
  headers.forEach((label, index) => {
    const cell = sheet.getCell(12, index + 2);
    cell.value = label;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3D5C' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER;
  });

  sortedStudents(students).forEach((student, index) => {
    const rowNumber = 13 + index;
    const values = [
      index + 1,
      clean(student.studentId),
      clean(student.lastName),
      clean(student.postName),
      clean(student.firstName),
    ];
    const row = sheet.getRow(rowNumber);
    row.height = 18;
    values.forEach((value, col) => {
      const cell = row.getCell(col + 2);
      cell.value = value;
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0B2840' } };
      cell.alignment = {
        horizontal: col === 0 ? 'center' : 'left',
        vertical: 'middle',
      };
      cell.border = BORDER;
    });
  });

  if (logoBuffer) {
    const imageId = workbook.addImage({
      base64: bufferToBase64(logoBuffer),
      extension: 'png',
    });
    const logo = { width: 78, height: 78 };
    sheet.addImage(imageId, { tl: { col: 1.05, row: 2.15 }, ext: logo, editAs: 'oneCell' });
    sheet.addImage(imageId, { tl: { col: 5.15, row: 2.15 }, ext: logo, editAs: 'oneCell' });
  }

  const lastRow = Math.max(12, 12 + (students?.length || 0));
  sheet.pageSetup.printArea = `A1:F${lastRow}`;
  return workbook;
}

export async function downloadClassStudentList(options) {
  let logoBuffer = options.logoBuffer || null;
  if (!logoBuffer) {
    try {
      const res = await fetch('/logo.png');
      if (res.ok) logoBuffer = await res.arrayBuffer();
    } catch {
      logoBuffer = null;
    }
  }

  const workbook = await buildClassStudentListWorkbook({ ...options, logoBuffer });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(options.cls?.name);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
