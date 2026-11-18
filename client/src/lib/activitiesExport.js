import ExcelJS from 'exceljs';
import fileSaver from 'file-saver';

const saveAs = fileSaver.saveAs || fileSaver;

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };

function genderLabel(gender, labels) {
  if (gender === 'MALE') return labels.boy;
  if (gender === 'FEMALE') return labels.girl;
  return '';
}

function paintHeader(sheet, columns, { filter = false } = {}) {
  const row = sheet.addRow(columns);
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle' };
  });
  row.height = 22;
  if (filter) {
    sheet.views = [{ state: 'frozen', ySplit: sheet.rowCount }];
    sheet.autoFilter = {
      from: { row: sheet.rowCount, column: 1 },
      to: { row: sheet.rowCount, column: columns.length },
    };
  }
}

function personCells(person, labels) {
  return [
    person.studentId || '',
    person.lastName || '',
    person.postName || '',
    person.firstName || '',
    genderLabel(person.gender, labels),
  ];
}

function addPeopleSheet(workbook, name, leadColumns, people, labels, title) {
  const sheet = workbook.addWorksheet(String(name || 'List').slice(0, 31), {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const columns = [
    labels.sn,
    ...leadColumns,
    labels.studentId,
    labels.lastName,
    labels.postName,
    labels.firstName,
    labels.gender,
  ];
  sheet.addRow([title]);
  sheet.getRow(1).font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF0B2840' } };
  sheet.mergeCells(1, 1, 1, columns.length);
  paintHeader(sheet, columns, { filter: true });
  people.forEach((person, index) => {
    sheet.addRow([index + 1, ...person.lead, ...personCells(person, labels)]);
  });
  sheet.columns.forEach((column, index) => {
    column.width = index === 0 ? 8 : 22;
  });
  return sheet;
}

function addSummarySheet(workbook, { activitySummary, classSummary, crossSummary, labels }) {
  const sheet = workbook.addWorksheet(String(labels.summary).slice(0, 31));
  const writeBlock = (title, headers, rows) => {
    const titleRow = sheet.addRow([title]);
    titleRow.font = { name: 'Calibri', bold: true, size: 13, color: { argb: 'FF0B2840' } };
    paintHeader(sheet, headers);
    rows.forEach((row) => sheet.addRow(row));
    sheet.addRow([]);
  };
  writeBlock(labels.perActivity, [labels.activity, labels.boys, labels.girls, labels.total], activitySummary);
  writeBlock(labels.perClass, [labels.className, labels.boys, labels.girls, labels.total], classSummary);
  writeBlock(
    labels.perActivityClass,
    [labels.activity, labels.className, labels.boys, labels.girls, labels.total],
    crossSummary,
  );
  sheet.columns.forEach((column) => { column.width = 28; });
}

export async function downloadActivitiesWorkbook({
  peopleByActivity = [],
  peopleByClass = [],
  activitySummary = [],
  classSummary = [],
  crossSummary = [],
  yearName = '',
  labels,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'École La RACINE';
  workbook.title = labels.title;
  const title = `${labels.title}${yearName ? ` — ${yearName}` : ''}`;
  addPeopleSheet(
    workbook,
    labels.perActivity,
    [labels.activity, labels.category, labels.className],
    peopleByActivity,
    labels,
    title,
  );
  addPeopleSheet(
    workbook,
    labels.perClass,
    [labels.className, labels.activity, labels.category],
    peopleByClass,
    labels,
    title,
  );
  addSummarySheet(workbook, { activitySummary, classSummary, crossSummary, labels });
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'activities-joined.xlsx',
  );
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function downloadActivitiesCsv({ people = [], labels }) {
  const headers = [
    labels.sn,
    labels.activity,
    labels.category,
    labels.className,
    labels.studentId,
    labels.lastName,
    labels.postName,
    labels.firstName,
    labels.gender,
  ];
  const lines = [
    headers.map(csvCell).join(','),
    ...people.map((person, index) => [
      index + 1,
      person.activityName,
      person.category,
      person.className,
      person.studentId,
      person.lastName,
      person.postName,
      person.firstName,
      genderLabel(person.gender, labels),
    ].map(csvCell).join(',')),
  ];
  saveAs(new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }), 'activities-joined.csv');
}
