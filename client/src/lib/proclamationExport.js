import ExcelJS from 'exceljs';
import { reportSchoolTitle } from './reportSchoolTitle';

const FONT = 'Times New Roman';
const MEDIUM = { style: 'medium', color: { argb: 'FF000000' } };
const THIN = { style: 'thin', color: { argb: 'FF000000' } };

const TERM_LABELS = {
  'Trimestre 1': '1er Trimestre',
  'Trimestre 2': '2ème Trimestre',
  'Trimestre 3': '3ème Trimestre',
  Annuel: 'Annuel',
};

function clean(value) {
  return String(value ?? '').trim();
}

function font(size, extra = {}) {
  return { name: FONT, size, color: { argb: 'FF000000' }, ...extra };
}

function sheetName(name) {
  const cleaned = clean(name).replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').slice(0, 31);
  return cleaned || 'Proclamation';
}

function fileName(className, term) {
  const safe = clean(`${className}-${term}`)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'classe';
  return `fiche-de-proclamation-${safe}.xlsx`;
}

export function proclamationSchoolHeading(name, city) {
  const title = reportSchoolTitle(name);
  const cityUp = clean(city).toUpperCase();
  if (cityUp && !title.toUpperCase().includes(cityUp)) return `${title} DE ${cityUp}`;
  return title;
}

export function proclamationPlaceLine(meta) {
  const city = clean(meta?.city).toUpperCase();
  const district = clean(meta?.district).toUpperCase();
  if (city && district && city !== district) return `${city} - ${district}`;
  return city || district;
}

export function proclamationTermLabel(term) {
  return TERM_LABELS[term] || clean(term) || 'Trimestre';
}

export function proclamationIssuedLine(meta, date = new Date()) {
  const city = clean(meta?.city) || 'Gisenyi';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `Fait à ${city}, le ${day} / ${month} / ${date.getFullYear()}`;
}

function applyRangeBorder(sheet, row, startCol, endCol, border) {
  for (let col = startCol; col <= endCol; col += 1) {
    const cell = sheet.getCell(row, col);
    cell.border = {
      top: border.top,
      bottom: border.bottom,
      left: col === startCol ? border.left : border.innerLeft,
      right: col === endCol ? border.right : border.innerRight,
    };
  }
}

function paintMerged(sheet, row, startCol, endCol, value, style) {
  if (endCol > startCol) sheet.mergeCells(row, startCol, row, endCol);
  const cell = sheet.getCell(row, startCol);
  cell.value = value;
  cell.font = style.font;
  cell.alignment = style.alignment;
  applyRangeBorder(sheet, row, startCol, endCol, style.border || {});
  for (let col = startCol + 1; col <= endCol; col += 1) {
    const extra = sheet.getCell(row, col);
    extra.font = style.font;
    extra.alignment = style.alignment;
  }
}

function sideBox(top, bottom) {
  return {
    top,
    bottom,
    left: MEDIUM,
    right: MEDIUM,
  };
}

/**
 * Fiche de proclamation for one class.
 * One worksheet, one row per student, matching the school template.
 */
export async function buildClassProclamationWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = proclamationSchoolHeading(report?.meta?.schoolName, report?.meta?.city);
  const sheet = workbook.addWorksheet(sheetName(report?.class?.name), {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    views: [{ showGridLines: false }],
  });

  const widths = [8, 6, 12, 20, 26, 24, 24, 11, 12, 11, 12];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  const headingFont = font(12, { bold: true });
  const placeFont = font(12, { italic: true, color: { argb: 'FF0070C0' } });
  const center = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const leftIndent = { horizontal: 'left', vertical: 'middle', indent: 2 };

  sheet.getRow(6).height = 24;
  paintMerged(sheet, 2, 2, 11, proclamationSchoolHeading(report?.meta?.schoolName, report?.meta?.city), {
    font: headingFont,
    alignment: center,
    border: sideBox(MEDIUM, undefined),
  });
  paintMerged(sheet, 3, 2, 11, proclamationPlaceLine(report?.meta), {
    font: placeFont,
    alignment: center,
    border: sideBox(undefined, undefined),
  });
  paintMerged(sheet, 4, 2, 11, clean(report?.meta?.country || 'RWANDA').toUpperCase(), {
    font: headingFont,
    alignment: center,
    border: sideBox(undefined, undefined),
  });
  paintMerged(sheet, 6, 2, 11, 'FICHE DE PROCLAMATION', {
    font: font(18, { bold: true }),
    alignment: center,
    border: sideBox(undefined, undefined),
  });
  paintMerged(sheet, 8, 2, 11, `Classe : ${clean(report?.class?.name)}`, {
    font: font(12, { bold: true }),
    alignment: leftIndent,
    border: sideBox(undefined, undefined),
  });
  paintMerged(sheet, 9, 2, 11, `Année scolaire : ${clean(report?.meta?.academicYear)}`, {
    font: font(12, { bold: true }),
    alignment: leftIndent,
    border: sideBox(undefined, undefined),
  });
  paintMerged(sheet, 10, 2, 11, `Trimestre : ${proclamationTermLabel(report?.term)}`, {
    font: font(12, { bold: true }),
    alignment: leftIndent,
    border: sideBox(undefined, MEDIUM),
  });

  const headers = ['S/N', 'Place', "Id de l'élève", 'NOM', 'POST-NOM', 'PRENOM', 'Genre', 'Total', '%', 'échecs'];
  const headerRow = sheet.getRow(11);
  headerRow.height = 20;
  headers.forEach((label, index) => {
    const cell = headerRow.getCell(index + 2);
    cell.value = label;
    cell.font = font(12, { bold: true });
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: MEDIUM,
      bottom: THIN,
      left: index === 0 ? MEDIUM : THIN,
      right: index === headers.length - 1 ? MEDIUM : THIN,
    };
  });

  const rows = report?.rows || [];
  rows.forEach((student, index) => {
    const row = sheet.getRow(12 + index);
    row.height = 18;
    const place = student.place == null
      ? ''
      : (student.totalStudents ? `${student.place}/${student.totalStudents}` : String(student.place));
    const values = [
      index + 1,
      place,
      clean(student.studentId),
      clean(student.lastName).toUpperCase(),
      clean(student.postName).toUpperCase(),
      clean(student.firstName).toUpperCase(),
      clean(student.gender),
      student.total == null ? null : Number(student.total),
      student.percentage == null ? null : Number(student.percentage),
      student.failures == null ? null : Number(student.failures),
    ];
    values.forEach((value, col) => {
      const cell = row.getCell(col + 2);
      cell.value = value == null || value === '' ? null : value;
      cell.font = font(12);
      const numeric = col >= 7;
      cell.alignment = {
        horizontal: col === 0 || col === 1 || col === 6 || numeric ? 'center' : 'left',
        vertical: 'middle',
      };
      if (col === 7 || col === 8) cell.numFmt = Number.isInteger(Number(value)) ? '0' : '0.0';
      cell.border = {
        top: THIN,
        bottom: THIN,
        left: col === 0 ? MEDIUM : THIN,
        right: col === values.length - 1 ? MEDIUM : THIN,
      };
    });
  });

  const footer = 12 + Math.max(rows.length, 1);
  const dateText = proclamationIssuedLine(report?.meta);
  const teacher = clean(report?.meta?.classTeacher);
  const signature = teacher
    ? `${teacher}\nNoms et Signature de l'enseignant titulaire de la classe`
    : "Noms et Signature de l'enseignant titulaire de la classe";

  sheet.mergeCells(footer, 2, footer + 1, 5);
  const dateCell = sheet.getCell(footer, 2);
  dateCell.value = dateText;
  dateCell.font = font(12);
  dateCell.alignment = center;
  for (const rowNumber of [footer, footer + 1]) {
    for (let col = 2; col <= 5; col += 1) {
      sheet.getCell(rowNumber, col).border = {
        top: rowNumber === footer ? MEDIUM : undefined,
        left: col === 2 ? MEDIUM : undefined,
        right: col === 5 ? MEDIUM : undefined,
      };
      sheet.getCell(rowNumber, col).font = font(12);
      sheet.getCell(rowNumber, col).alignment = center;
    }
  }

  const summaryLabels = [
    [footer, 'Moyenne', report?.summary?.average],
    [footer + 1, 'Succès', report?.summary?.success],
    [footer + 4, 'échec', report?.summary?.failed],
  ];
  summaryLabels.forEach(([rowNumber, label, value]) => {
    const labelCell = sheet.getCell(rowNumber, 6);
    labelCell.value = label;
    labelCell.font = font(12, { bold: label === 'Moyenne' });
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
    labelCell.border = { top: MEDIUM, bottom: MEDIUM, left: MEDIUM, right: THIN };
    const valueCell = sheet.getCell(rowNumber, 7);
    valueCell.value = value == null ? null : Number(value);
    valueCell.font = font(12, { bold: true });
    valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (label === 'Moyenne') valueCell.numFmt = '0.0';
    valueCell.border = { top: MEDIUM, bottom: MEDIUM, left: THIN, right: MEDIUM };
  });

  sheet.mergeCells(footer + 2, 2, footer + 3, 5);
  const signCell = sheet.getCell(footer + 2, 2);
  signCell.value = signature;
  signCell.font = font(12);
  signCell.alignment = { ...center, wrapText: true };
  sheet.getRow(footer + 2).height = 22;
  sheet.getRow(footer + 3).height = 22;
  for (const rowNumber of [footer + 2, footer + 3]) {
    for (let col = 2; col <= 5; col += 1) {
      sheet.getCell(rowNumber, col).border = {
        top: rowNumber === footer + 2 ? MEDIUM : undefined,
        bottom: rowNumber === footer + 3 ? MEDIUM : undefined,
        left: col === 2 ? MEDIUM : undefined,
        right: col === 5 ? MEDIUM : undefined,
      };
      sheet.getCell(rowNumber, col).alignment = { ...center, wrapText: true };
      sheet.getCell(rowNumber, col).font = font(12);
    }
  }

  sheet.pageSetup.printArea = `A1:K${footer + 4}`;
  return workbook;
}

export async function downloadClassProclamation(report) {
  const workbook = await buildClassProclamationWorkbook(report);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(report?.class?.name, report?.term);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
