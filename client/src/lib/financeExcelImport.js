import ExcelJS from 'exceljs';
import fileSaver from 'file-saver';
import { studentFullName } from './studentName.js';

const saveAs = fileSaver.saveAs || fileSaver;

const NURSERY_GRADES = new Set(['M1', 'M2', 'M3', 'TOP', 'CRECHE', 'N1', 'N2', 'N3']);
const PRIMARY_GRADES = new Set(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);

const THIN = { style: 'thin', color: { argb: 'FF94A3B8' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

const FILL = {
  id: 'FFF8FAFC',
  money: 'FFECFDF5',
  prior: 'FFFFF7ED',
  t1: 'FFE0F2FE',
  t2: 'FFE0E7FF',
  t3: 'FFFCE7F3',
  group: 'FF0B2840',
  sub: 'FF0369A1',
};

function shiftYearLabel(name, delta) {
  const match = String(name || '').match(/(\d{4})\s*[-–]\s*(\d{4})/);
  if (!match) return String(name || '').trim();
  return `${Number(match[1]) + delta}-${Number(match[2]) + delta}`;
}

function levelOf(student) {
  const grade = String(student?.class?.grade || '').trim().toUpperCase();
  if (PRIMARY_GRADES.has(grade)) return 'primary';
  if (NURSERY_GRADES.has(grade)) return 'nursery';
  const label = String(student?.class?.name || '').toUpperCase();
  if (/^P[1-6]\b/.test(label) || label.includes('PRIM')) return 'primary';
  return 'nursery';
}

function paint(cell, { fill, bold = false, color = 'FF0F172A', align = 'center' } = {}) {
  cell.alignment = { vertical: 'middle', horizontal: align, wrapText: true };
  cell.border = BORDER;
  cell.font = { name: 'Calibri', size: 10, bold, color: { argb: color } };
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
}

function writeMerged(sheet, range, value, style) {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(':')[0]);
  cell.value = value;
  paint(cell, style);
  return cell;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildMaternelleSheet(workbook, students, yearLabel, priorLabel) {
  const sheet = workbook.addWorksheet('MATERNELLE', {
    views: [{ state: 'frozen', ySplit: 6, xSplit: 3 }],
  });
  sheet.columns = [
    { width: 16 }, { width: 8 }, { width: 28 }, { width: 16 },
    { width: 16 }, { width: 22 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 },
  ];
  sheet.getColumn(1).hidden = true;

  writeMerged(sheet, 'A4:A6', 'Student ID', { fill: FILL.id, bold: true });
  writeMerged(sheet, 'B4:B6', 'S/N', { fill: FILL.id, bold: true });
  writeMerged(sheet, 'C4:C6', 'Names', { fill: FILL.id, bold: true });
  writeMerged(sheet, 'D4:D6', 'Branche', { fill: FILL.id, bold: true });
  writeMerged(sheet, 'E4:E6', 'Inscription', { fill: FILL.money, bold: true });
  writeMerged(sheet, 'F4:F6', `Balance of Third Trimester ${priorLabel}`.trim(), { fill: FILL.prior, bold: true });

  const groups = [
    ['G', 'J', 'FIRST TRIMESTER', `Balance of first trimester ${yearLabel}`.trim()],
    ['K', 'N', 'SECOND TRIMESTER', `Balance of Second Trimester ${yearLabel}`.trim()],
    ['O', 'R', 'THIRD TRIMESTER', `Balance of Third Trimester ${yearLabel}`.trim()],
  ];
  groups.forEach(([start, end, title, balance]) => {
    writeMerged(sheet, `${start}4:${end}4`, title, { fill: FILL.group, bold: true, color: 'FFFFFFFF' });
    writeMerged(sheet, `${start}5:${end}5`, 'SCHOOL FEES', { fill: FILL.sub, bold: true, color: 'FFFFFFFF' });
    const leaves = ['Amount to be paid', 'First Installment', 'Second Installment', balance];
    leaves.forEach((label, index) => {
      const col = start.charCodeAt(0) + index;
      const cell = sheet.getCell(6, col - 64);
      cell.value = label;
      paint(cell, { fill: index === 3 ? FILL.prior : FILL.t1, bold: true });
    });
  });
  // Recolor trimester leaf groups
  [11, 12, 13, 14].forEach((col) => paint(sheet.getCell(6, col), { fill: col === 14 ? FILL.prior : FILL.t2, bold: true }));
  [15, 16, 17, 18].forEach((col) => paint(sheet.getCell(6, col), { fill: col === 18 ? FILL.prior : FILL.t3, bold: true }));

  sheet.getRow(4).height = 22;
  sheet.getRow(5).height = 20;
  sheet.getRow(6).height = 36;

  students.forEach((student, index) => {
    const row = sheet.getRow(7 + index);
    row.getCell(1).value = student.studentId || '';
    row.getCell(2).value = index + 1;
    row.getCell(3).value = studentFullName(student);
    row.getCell(4).value = student.class?.name || '';
    for (let col = 1; col <= 18; col += 1) {
      paint(row.getCell(col), { align: col === 3 ? 'left' : 'center' });
    }
  });
}

function buildPrimaireSheet(workbook, students, yearLabel, priorLabel) {
  const sheet = workbook.addWorksheet('PRIMAIRE', {
    views: [{ state: 'frozen', ySplit: 5, xSplit: 2 }],
  });
  const widths = [8, 28, 16, 14, 16, 14, 14, 14, 22];
  for (let i = 0; i < 3; i += 1) widths.push(16, 16, 16, 18);
  widths.push(16);
  sheet.columns = widths.map((width) => ({ width }));
  sheet.getColumn(22).hidden = true;

  writeMerged(sheet, 'A2:A5', 'S/N', { fill: FILL.id, bold: true });
  writeMerged(sheet, 'B2:B5', 'Names', { fill: FILL.id, bold: true });
  writeMerged(sheet, 'C2:C5', 'Branche', { fill: FILL.id, bold: true });
  writeMerged(sheet, 'D2:D5', 'Uniforms', { fill: FILL.money, bold: true });
  writeMerged(sheet, 'E2:E5', 'Inscription', { fill: FILL.money, bold: true });
  writeMerged(sheet, 'F2:H2', 'Activites Parascolaire', { fill: FILL.money, bold: true });
  writeMerged(sheet, 'F3:H4', 'Activites Parascolaire', { fill: FILL.money, bold: true });
  ['First trim', 'Second Trim', 'Third Trim'].forEach((label, index) => {
    const cell = sheet.getCell(5, 6 + index);
    cell.value = label;
    paint(cell, { fill: FILL.money, bold: true });
  });
  writeMerged(sheet, 'I2:I5', `Balance of Third Trimester ${priorLabel}`.trim(), { fill: FILL.prior, bold: true });

  const groups = [
    [10, 'FIRST TRIMESTER', FILL.t1, `Balance of First Trimester ${yearLabel}`.trim()],
    [14, 'SECOND TRIMESTER', FILL.t2, `Balance of Second Trimester ${yearLabel}`.trim()],
    [18, 'THIRD TRIMESTER', FILL.t3, `Balance of Third Trimester ${yearLabel}`.trim()],
  ];
  groups.forEach(([start, title, fill, balance]) => {
    const end = start + 3;
    writeMerged(sheet, `${colLetter(start)}2:${colLetter(end)}2`, title, { fill: FILL.group, bold: true, color: 'FFFFFFFF' });
    writeMerged(sheet, `${colLetter(start)}3:${colLetter(end)}3`, 'SCHOOL FEES', { fill: FILL.sub, bold: true, color: 'FFFFFFFF' });
    ['Amount to be paid', 'First Installment', 'Second Installment', balance].forEach((label, index) => {
      const cell = sheet.getCell(4, start + index);
      cell.value = label;
      sheet.mergeCells(4, start + index, 5, start + index);
      paint(cell, { fill: index === 3 ? FILL.prior : fill, bold: true });
    });
  });

  writeMerged(sheet, 'V2:V5', 'Student ID', { fill: FILL.id, bold: true });

  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 20;
  sheet.getRow(4).height = 32;
  sheet.getRow(5).height = 22;

  students.forEach((student, index) => {
    const row = sheet.getRow(6 + index);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = studentFullName(student);
    row.getCell(3).value = student.class?.name || '';
    row.getCell(22).value = student.studentId || '';
    for (let col = 1; col <= 22; col += 1) {
      paint(row.getCell(col), { align: col === 2 ? 'left' : 'center' });
    }
  });
}

function colLetter(index) {
  let n = index;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export async function createFinanceWorkbook({ students = [], academicYearName = '' } = {}) {
  const yearLabel = String(academicYearName || '').trim();
  const priorLabel = shiftYearLabel(yearLabel, -1);
  const nursery = [];
  const primary = [];
  students.forEach((student) => {
    if (levelOf(student) === 'primary') primary.push(student);
    else nursery.push(student);
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'École La RACINE';
  buildMaternelleSheet(workbook, nursery, yearLabel, priorLabel);
  buildPrimaireSheet(workbook, primary, yearLabel, priorLabel);
  return workbook;
}

export async function downloadFinanceImportTemplate(options = {}) {
  const workbook = await createFinanceWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'school-tuition-workings.xlsx',
  );
}

function cellText(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
    if (value.text) return String(value.text);
    if (value.result != null) return cellText(value.result);
    if (value.formula) return '';
  }
  return String(value).trim();
}

function money(value) {
  const text = cellText(value).replace(/\s/g, '');
  if (!text) return null;
  const numeric = Number(text.replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function norm(value) {
  return cellText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function sheetMatrix(sheet) {
  const rows = [];
  const last = Math.max(sheet.rowCount, sheet.actualRowCount || 0);
  for (let r = 1; r <= last; r += 1) {
    const row = sheet.getRow(r);
    const cells = [];
    const width = Math.max(sheet.columnCount || 0, row.cellCount || 0, 22);
    for (let c = 1; c <= width; c += 1) cells.push(row.getCell(c).value);
    rows.push(cells);
  }
  return rows;
}

function findTuitionHeader(grid) {
  let namesRow = -1;
  grid.slice(0, 12).forEach((row, index) => {
    const labels = row.map(norm);
    if (namesRow < 0 && labels.some((label) => label === 'names' || label === 'noms')) namesRow = index;
  });
  if (namesRow < 0) return null;
  let end = namesRow;
  for (let index = namesRow; index < Math.min(grid.length, namesRow + 5); index += 1) {
    const blob = grid[index].map(norm).join(' ');
    if (
      blob.includes('amount to be paid')
      || blob.includes('installment')
      || blob.includes('school fees')
      || blob.includes('first trim')
      || blob.includes('inscription')
    ) end = index;
  }
  const columns = [];
  const width = Math.max(...grid.slice(namesRow, end + 1).map((row) => row.length), 0);
  for (let col = 0; col < width; col += 1) {
    const labels = [];
    for (let r = namesRow; r <= end; r += 1) {
      const label = norm(grid[r][col]);
      if (label) labels.push(label);
    }
    columns.push(labels.join(' | '));
  }
  return { headerEnd: end, columns };
}

function columnRole(label, index, columns) {
  if (!label) return '';
  const tokens = label.split('|').map((part) => part.trim()).filter(Boolean);
  const has = (...needles) => needles.some((needle) => tokens.includes(needle) || label.includes(needle));
  if (has('student id', 'matricule')) return 'studentCode';
  if (tokens.includes('s/n') || tokens.includes('sn')) return 'sn';
  if (tokens.includes('names') || tokens.includes('noms')) return 'name';
  if (tokens.includes('branche') || tokens.includes('classe')) return 'branche';
  if (has('uniform')) return 'uniforms';
  if (has('inscription', 'registration')) return 'inscription';
  if (tokens.includes('first trim')) return 'activity1';
  if (tokens.includes('second trim')) return 'activity2';
  if (tokens.includes('third trim')) return 'activity3';
  const amountAt = columns.findIndex((item) => item.includes('amount to be paid'));
  if (tokens.some((token) => token.startsWith('balance of third')) && (amountAt < 0 || index < amountAt)) {
    return 'carryOver';
  }
  return '';
}

function trimesterRoles(columns) {
  const roles = columns.map(() => '');
  const amountIndexes = columns
    .map((label, index) => (label.includes('amount to be paid') || label.includes('montant a payer') ? index : -1))
    .filter((index) => index >= 0);
  const terms = ['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'];
  amountIndexes.forEach((start, group) => {
    const term = terms[group] || `TRIMESTRE_${group + 1}`;
    roles[start] = `due:${term}`;
    for (let col = start + 1; col < Math.min(start + 4, columns.length); col += 1) {
      const label = columns[col];
      if (label.includes('first installment') || label.includes('1st') || label.includes('premiere')) roles[col] = `inst1:${term}`;
      else if (label.includes('second installment') || label.includes('2nd') || label.includes('deuxieme')) roles[col] = `inst2:${term}`;
      else if (label.includes('balance')) roles[col] = 'ignore';
    }
  });
  return roles;
}

function pushFee(rows, base, extra) {
  if (extra.amount == null || extra.amount === '' || Number(extra.amount) === 0) return;
  rows.push({
    ...base,
    ...extra,
    amount: Number(extra.amount),
    dueDate: todayIso(),
  });
}

function feesFromTuitionRow(base, values, roles) {
  const rows = [];
  const byTerm = {};
  roles.forEach((role, index) => {
    if (!role || role === 'ignore') return;
    const amount = money(values[index]);
    if (role === 'inscription') {
      pushFee(rows, base, { feeType: 'REGISTRATION', term: null, amount, status: 'PENDING', label: 'Inscription' });
    } else if (role === 'uniforms') {
      pushFee(rows, base, { feeType: 'UNIFORM', term: null, amount, status: 'PENDING', label: 'Uniforms' });
    } else if (role === 'carryOver') {
      pushFee(rows, base, { feeType: 'CARRY_OVER', term: 'PRIOR_YEAR', amount, status: 'PENDING', label: 'Prior balance' });
    } else if (role.startsWith('activity')) {
      const term = role === 'activity1' ? 'TRIMESTRE_1' : role === 'activity2' ? 'TRIMESTRE_2' : 'TRIMESTRE_3';
      pushFee(rows, base, { feeType: 'EXTRACURRICULAR', term, amount, status: 'PENDING', label: `Activities ${term.slice(-1)}` });
    } else if (role.startsWith('due:') || role.startsWith('inst1:') || role.startsWith('inst2:')) {
      const [kind, term] = role.split(':');
      if (!byTerm[term]) byTerm[term] = {};
      byTerm[term][kind] = amount;
    }
  });

  Object.entries(byTerm).forEach(([term, parts]) => {
    const due = parts.due;
    const paid1 = parts.inst1;
    const paid2 = parts.inst2;
    const paidSum = (paid1 || 0) + (paid2 || 0);
    const label = term.replace('TRIMESTRE_', 'T');
    if (paid1 > 0) {
      pushFee(rows, base, {
        feeType: 'TUITION', term, amount: paid1, status: 'PAID', installmentIndex: 1, installmentTotal: 2, label: `${label} installment 1`,
      });
    }
    if (paid2 > 0) {
      pushFee(rows, base, {
        feeType: 'TUITION', term, amount: paid2, status: 'PAID', installmentIndex: 2, installmentTotal: 2, label: `${label} installment 2`,
      });
    }
    if (due != null && due > paidSum) {
      const rest = due - paidSum;
      if (!(paid1 > 0) && !(paid2 > 0)) {
        const first = Math.floor(rest / 2);
        pushFee(rows, base, {
          feeType: 'TUITION', term, amount: first, status: 'PENDING', installmentIndex: 1, installmentTotal: 2, label: `${label} installment 1`,
        });
        pushFee(rows, base, {
          feeType: 'TUITION', term, amount: rest - first, status: 'PENDING', installmentIndex: 2, installmentTotal: 2, label: `${label} installment 2`,
        });
      } else if (!(paid2 > 0)) {
        pushFee(rows, base, {
          feeType: 'TUITION', term, amount: rest, status: 'PENDING', installmentIndex: 2, installmentTotal: 2, label: `${label} balance`,
        });
      } else if (!(paid1 > 0)) {
        pushFee(rows, base, {
          feeType: 'TUITION', term, amount: rest, status: 'PENDING', installmentIndex: 1, installmentTotal: 2, label: `${label} balance`,
        });
      }
    }
  });
  return rows;
}

function parseTuitionSheet(sheet) {
  const grid = sheetMatrix(sheet);
  const header = findTuitionHeader(grid);
  if (!header) return null;
  const roles = header.columns.map((label, index) => columnRole(label, index, header.columns));
  trimesterRoles(header.columns).forEach((role, index) => {
    if (role) roles[index] = role;
  });
  if (!roles.includes('name') && !roles.includes('inscription')) return null;

  const rows = [];
  const errors = [];
  for (let r = header.headerEnd + 1; r < grid.length; r += 1) {
    const values = grid[r];
    const name = cellText(values[roles.indexOf('name')]);
    const studentCode = cellText(values[roles.indexOf('studentCode')]);
    const hasMoney = roles.some((role, index) => role && role !== 'name' && role !== 'branche' && role !== 'sn' && role !== 'studentCode' && role !== 'ignore' && money(values[index]) > 0);
    if (!name && !studentCode && !hasMoney) continue;
    if (!hasMoney) continue;
    if (!name && !studentCode) {
      errors.push({ row: `${sheet.name} row ${r + 1}`, error: 'Student name is missing' });
      continue;
    }
    const base = {
      row: r + 1,
      sheet: sheet.name,
      studentCode,
      fullName: name,
      lastName: '',
      postName: '',
      firstName: '',
    };
    rows.push(...feesFromTuitionRow(base, values, roles));
  }
  return { rows, errors };
}

const SIMPLE_ALIASES = {
  'student id': 'studentCode',
  matricule: 'studentCode',
  'last name': 'lastName',
  nom: 'lastName',
  'post name': 'postName',
  'post-nom': 'postName',
  'first name': 'firstName',
  prenom: 'firstName',
  'fee type': 'feeType',
  'type de frais': 'feeType',
  term: 'term',
  trimestre: 'term',
  amount: 'amount',
  montant: 'amount',
  'due date': 'dueDate',
  echeance: 'dueDate',
  status: 'status',
  statut: 'status',
  installment: 'installment',
  tranche: 'installment',
  notes: 'notes',
};

function parseSimpleSheet(sheet) {
  const grid = sheetMatrix(sheet);
  let headerIndex = -1;
  let columns = [];
  for (let i = 0; i < Math.min(grid.length, 6); i += 1) {
    const mapped = grid[i].map((cell) => SIMPLE_ALIASES[norm(cell)] || '');
    if (mapped.includes('studentCode') && mapped.includes('amount')) {
      headerIndex = i;
      columns = mapped;
      break;
    }
  }
  if (headerIndex < 0) return null;
  const rows = [];
  const errors = [];
  const feeMap = {
    tuition: 'TUITION', inscription: 'REGISTRATION', registration: 'REGISTRATION', uniform: 'UNIFORM',
    uniforms: 'UNIFORM', extracurricular: 'EXTRACURRICULAR', activities: 'EXTRACURRICULAR',
    'carry over': 'CARRY_OVER', 'carry-over': 'CARRY_OVER', other: 'OTHER',
  };
  for (let i = headerIndex + 1; i < grid.length; i += 1) {
    const record = {};
    columns.forEach((key, index) => { if (key) record[key] = grid[i][index]; });
    const amount = money(record.amount);
    if (amount == null) continue;
    const feeType = feeMap[norm(record.feeType)] || String(cellText(record.feeType) || '').toUpperCase();
    if (!feeType) {
      errors.push({ row: `${sheet.name} row ${i + 1}`, error: 'Fee type is missing' });
      continue;
    }
    rows.push({
      row: i + 1,
      sheet: sheet.name,
      studentCode: cellText(record.studentCode),
      lastName: cellText(record.lastName),
      postName: cellText(record.postName),
      firstName: cellText(record.firstName),
      fullName: [record.lastName, record.postName, record.firstName].map(cellText).filter(Boolean).join(' '),
      feeType,
      term: cellText(record.term) || null,
      amount,
      dueDate: cellText(record.dueDate) || todayIso(),
      status: cellText(record.status) || 'PENDING',
      installmentIndex: money(record.installment),
      label: feeType,
    });
  }
  return { rows, errors };
}

export async function parseFinanceImportFile(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const rows = [];
  const errors = [];
  let recognized = false;
  workbook.worksheets.forEach((sheet) => {
    const tuition = parseTuitionSheet(sheet);
    const simple = tuition ? null : parseSimpleSheet(sheet);
    const parsed = tuition || simple;
    if (!parsed) return;
    recognized = true;
    rows.push(...parsed.rows);
    errors.push(...parsed.errors);
  });
  if (!recognized) {
    return { rows: [], errors: [{ row: '1', error: 'Use the school tuition workbook with MATERNELLE and PRIMAIRE sheets.' }] };
  }
  return { rows, errors };
}
