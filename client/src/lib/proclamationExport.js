import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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

function fileName(className, term, periodScope) {
  const scope = periodScope === 'period1' ? '-periode-1' : periodScope === 'period2' ? '-periode-2' : '';
  const safe = clean(`${className}-${term}${scope}`)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'classe';
  return `fiche-de-proclamation-${safe}`;
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

export function proclamationSheetTitle(term) {
  if (/^(annuel|annual|ann[eé]e)$/i.test(clean(term))) return 'FICHE DE PROCLAMATION ANNUELLE';
  return 'FICHE DE PROCLAMATION TRIMESTIELLE';
}

export function proclamationContextLine(report) {
  const term = proclamationTermLabel(report?.term);
  if (report?.periodScope === 'period1') return `Trimestre : ${term} · Période 1`;
  if (report?.periodScope === 'period2') return `Trimestre : ${term} · Période 2`;
  return `Trimestre : ${term}`;
}

const IDENTITY_COLUMNS = [
  { key: 'sn', label: 'S/N', kind: 'sn' },
  { key: 'studentId', label: "Id de l'élève", kind: 'text' },
  { key: 'lastName', label: 'NOM', kind: 'name' },
  { key: 'postName', label: 'POST-NOM', kind: 'name' },
  { key: 'firstName', label: 'PRENOM', kind: 'name' },
  { key: 'gender', label: 'Genre', kind: 'gender' },
];

const SCORE_COLUMNS = {
  period1: { key: 'period1', label: 'Tot. (1eP)', kind: 'score', width: 12 },
  period2: { key: 'period2', label: 'Tot. (2eP)', kind: 'score', width: 12 },
  exam: { key: 'exam', label: 'Tot. (Exam)', kind: 'score', width: 13 },
  total: { key: 'total', label: 'Tot. Trim', kind: 'score', width: 11 },
  percentage: { key: 'percentage', label: '%', kind: 'score', width: 9 },
  failures: { key: 'failures', label: 'échecs', kind: 'count', width: 12 },
};

export function proclamationColumns(report) {
  const scope = report?.periodScope;
  if (scope === 'period1') {
    return [...IDENTITY_COLUMNS, SCORE_COLUMNS.period1, SCORE_COLUMNS.percentage, SCORE_COLUMNS.failures];
  }
  if (scope === 'period2') {
    return [...IDENTITY_COLUMNS, SCORE_COLUMNS.period2, SCORE_COLUMNS.percentage, SCORE_COLUMNS.failures];
  }
  return [
    ...IDENTITY_COLUMNS,
    SCORE_COLUMNS.period1,
    SCORE_COLUMNS.period2,
    SCORE_COLUMNS.exam,
    SCORE_COLUMNS.total,
    SCORE_COLUMNS.percentage,
    SCORE_COLUMNS.failures,
  ];
}

const IDENTITY_WIDTHS = [6, 25, 30, 29, 30, 8];

function sheetCellValue(student, index, column) {
  if (column.kind === 'sn') return index + 1;
  if (column.kind === 'text') return clean(student.studentId);
  if (column.kind === 'name') return clean(student[column.key]).toUpperCase();
  if (column.kind === 'gender') return clean(student.gender);
  const value = student?.[column.key];
  return value == null || value === '' ? null : Number(value);
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

  const columns = proclamationColumns(report);
  const lastCol = columns.length + 1;
  sheet.getColumn(1).width = 8;
  columns.forEach((column, index) => {
    sheet.getColumn(index + 2).width = column.width || IDENTITY_WIDTHS[index] || 12;
  });

  const headingFont = font(12, { bold: true });
  const placeFont = font(12, { italic: true, color: { argb: 'FF0070C0' } });
  const center = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const leftIndent = { horizontal: 'left', vertical: 'middle', indent: 2 };

  sheet.getRow(6).height = 24;
  paintMerged(sheet, 2, 2, lastCol, proclamationSchoolHeading(report?.meta?.schoolName, report?.meta?.city), {
    font: headingFont,
    alignment: center,
    border: sideBox(MEDIUM, undefined),
  });
  paintMerged(sheet, 3, 2, lastCol, proclamationPlaceLine(report?.meta), {
    font: placeFont,
    alignment: center,
    border: sideBox(undefined, undefined),
  });
  paintMerged(sheet, 4, 2, lastCol, clean(report?.meta?.country || 'RWANDA').toUpperCase(), {
    font: headingFont,
    alignment: center,
    border: sideBox(undefined, undefined),
  });
  paintMerged(sheet, 6, 2, lastCol, proclamationSheetTitle(report?.term), {
    font: font(18, { bold: true }),
    alignment: center,
    border: sideBox(undefined, undefined),
  });
  paintMerged(sheet, 8, 2, lastCol, `Classe : ${clean(report?.class?.name)}`, {
    font: font(12, { bold: true }),
    alignment: leftIndent,
    border: sideBox(undefined, undefined),
  });
  paintMerged(sheet, 9, 2, lastCol, `Année scolaire : ${clean(report?.meta?.academicYear)}`, {
    font: font(12, { bold: true }),
    alignment: leftIndent,
    border: sideBox(undefined, undefined),
  });
  paintMerged(sheet, 10, 2, lastCol, proclamationContextLine(report), {
    font: font(12, { bold: true }),
    alignment: leftIndent,
    border: sideBox(undefined, MEDIUM),
  });

  const headerRow = sheet.getRow(11);
  headerRow.height = 22;
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 2);
    cell.value = column.label;
    cell.font = font(12, { bold: true });
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: MEDIUM,
      bottom: THIN,
      left: index === 0 ? MEDIUM : THIN,
      right: index === columns.length - 1 ? MEDIUM : THIN,
    };
  });

  const rows = report?.rows || [];
  rows.forEach((student, index) => {
    const row = sheet.getRow(12 + index);
    row.height = 18;
    const values = columns.map((column) => sheetCellValue(student, index, column));
    values.forEach((value, col) => {
      const cell = row.getCell(col + 2);
      cell.value = value == null || value === '' ? null : value;
      cell.font = font(12);
      const numeric = col === 0 || col >= 5;
      cell.alignment = {
        horizontal: numeric ? 'center' : 'left',
        vertical: 'middle',
      };
      const column = columns[col];
      if ((column?.kind === 'score' || column?.kind === 'count') && value != null) {
        cell.numFmt = column.kind === 'count' || Number.isInteger(Number(value)) ? '0' : '0.0';
      }
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
  const boxBorder = (rowNumber, topRow, bottomRow) => ({
    top: rowNumber === topRow ? MEDIUM : undefined,
    bottom: rowNumber === bottomRow ? MEDIUM : undefined,
    left: MEDIUM,
    right: MEDIUM,
  });

  sheet.mergeCells(footer, 2, footer + 1, 5);
  for (const rowNumber of [footer, footer + 1]) {
    for (let col = 2; col <= 5; col += 1) {
      const cell = sheet.getCell(rowNumber, col);
      cell.border = {
        top: rowNumber === footer ? MEDIUM : undefined,
        left: col === 2 ? MEDIUM : undefined,
        right: col === 5 ? MEDIUM : undefined,
      };
      cell.font = font(12, { bold: true });
      cell.alignment = center;
    }
  }
  const dateCell = sheet.getCell(footer, 2);
  dateCell.value = dateText;

  sheet.mergeCells(footer + 2, 2, footer + 5, 5);
  for (const rowNumber of [footer + 2, footer + 3, footer + 4, footer + 5]) {
    sheet.getRow(rowNumber).height = 18;
    for (let col = 2; col <= 5; col += 1) {
      const cell = sheet.getCell(rowNumber, col);
      cell.border = {
        top: rowNumber === footer + 2 ? MEDIUM : undefined,
        bottom: rowNumber === footer + 5 ? MEDIUM : undefined,
        left: col === 2 ? MEDIUM : undefined,
        right: col === 5 ? MEDIUM : undefined,
      };
      cell.font = font(12, { bold: true });
      cell.alignment = { ...center, wrapText: true };
    }
  }
  sheet.getCell(footer + 2, 2).value = signature;

  const countOf = (group, key) => {
    const value = group?.[key];
    return value == null ? null : Number(value);
  };
  const summaryRows = [
    ['Moyenne', null, report?.summary?.average == null ? null : Number(report.summary.average)],
    ['Succès', 'F', countOf(report?.summary?.success, 'F')],
    ['Succès', 'M', countOf(report?.summary?.success, 'M')],
    ['Succès', 'Total', countOf(report?.summary?.success, 'total')],
    ['échec', 'F', countOf(report?.summary?.failed, 'F')],
    ['échec', 'M', countOf(report?.summary?.failed, 'M')],
    ['échec', 'Total', countOf(report?.summary?.failed, 'total')],
    ['Non classés', 'F', countOf(report?.summary?.unclassified, 'F')],
    ['Non classés', 'M', countOf(report?.summary?.unclassified, 'M')],
    ['Non classés', 'Total', countOf(report?.summary?.unclassified, 'total')],
  ];
  summaryRows.forEach(([label, gender, value], index) => {
    const rowNumber = footer + index;
    const labelCell = sheet.getCell(rowNumber, 6);
    const genderCell = sheet.getCell(rowNumber, 7);
    const valueCell = sheet.getCell(rowNumber, 8);
    const showLabel = index === 0 || summaryRows[index - 1][0] !== label;
    labelCell.value = showLabel ? label : null;
    labelCell.font = font(12, { bold: true });
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
    genderCell.value = label === 'Moyenne' ? value : gender;
    genderCell.font = font(12, { bold: label === 'Moyenne' });
    genderCell.alignment = center;
    valueCell.value = label === 'Moyenne' ? null : value;
    valueCell.font = font(12, { bold: true });
    valueCell.alignment = center;
    if (label === 'Moyenne' && value != null) valueCell.numFmt = '0.0';
    [labelCell, genderCell, valueCell].forEach((cell) => {
      cell.border = {
        top: MEDIUM,
        bottom: index === summaryRows.length - 1 || summaryRows[index + 1]?.[0] !== label ? MEDIUM : THIN,
        left: MEDIUM,
        right: MEDIUM,
      };
    });
  });
  sheet.mergeCells(footer + 1, 6, footer + 3, 6);
  sheet.mergeCells(footer + 4, 6, footer + 6, 6);
  sheet.mergeCells(footer + 7, 6, footer + 9, 6);
  sheet.getCell(footer, 7).border = boxBorder(footer, footer, footer);
  sheet.mergeCells(footer, 7, footer, 8);

  const endColumn = String.fromCharCode(64 + lastCol);
  sheet.pageSetup.printArea = `A1:${endColumn}${footer + summaryRows.length}`;
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
  link.download = `${fileName(report?.class?.name, report?.term, report?.periodScope)}.xlsx`;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Download the on-screen fiche as a landscape A4 PDF.
 * The sheet is fitted to the page width and continues on the next page when the class is long.
 */
export async function downloadProclamationPdf(element, report) {
  if (!element) throw new Error('Proclamation sheet not found');
  const wrap = element.querySelector('.proclamation-table-wrap');
  const table = wrap?.querySelector('table');
  const previousWidth = element.style.width;
  const previousOverflow = wrap?.style.overflow || '';
  element.classList.add('is-pdf-export');
  if (wrap) wrap.style.overflow = 'visible';
  const contentWidth = Math.max(element.scrollWidth, (table?.scrollWidth || 0) + 48, 1100);
  element.style.width = `${contentWidth}px`;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: element.scrollWidth,
      height: Math.max(element.scrollHeight, element.offsetHeight),
      windowWidth: element.scrollWidth,
      windowHeight: Math.max(element.scrollHeight, element.offsetHeight),
    });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margin = 6;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;
    const imgHeight = (canvas.height * printableWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    let offset = 0;
    let remaining = imgHeight;
    while (remaining > 1) {
      if (offset > 0) pdf.addPage('a4', 'landscape');
      pdf.addImage(imgData, 'JPEG', margin, margin - offset, printableWidth, imgHeight, undefined, 'SLOW');
      remaining -= printableHeight;
      offset += printableHeight;
    }
    pdf.save(`${fileName(report?.class?.name, report?.term, report?.periodScope)}.pdf`);
  } finally {
    element.style.width = previousWidth;
    if (wrap) wrap.style.overflow = previousOverflow;
    element.classList.remove('is-pdf-export');
  }
}
