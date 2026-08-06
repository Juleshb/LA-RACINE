import * as XLSX from 'xlsx';

const MARKS_HEADERS = [
  'studentId',
  'firstName',
  'lastName',
  'score',
  'maxScore',
  'notes',
];

const HEADER_ALIASES = {
  studentid: 'studentId',
  'student id': 'studentId',
  'id eleve': 'studentId',
  'id élève': 'studentId',
  ideleve: 'studentId',
  matricule: 'studentId',
  firstname: 'firstName',
  'first name': 'firstName',
  prenom: 'firstName',
  prénom: 'firstName',
  lastname: 'lastName',
  'last name': 'lastName',
  nom: 'lastName',
  score: 'score',
  note: 'score',
  marks: 'score',
  mark: 'score',
  points: 'score',
  maxscore: 'maxScore',
  'max score': 'maxScore',
  maximum: 'maxScore',
  maxima: 'maxScore',
  notes: 'notes',
  comment: 'notes',
  commentaire: 'notes',
};

function sanitizeFilename(name) {
  return String(name || 'marks')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'marks';
}

function sanitizeSheetName(name) {
  const cleaned = String(name || 'Marks')
    .replace(/[:\\/?*[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31);
  return cleaned || 'Marks';
}

function downloadBlob(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function mapHeaders(rawHeaders) {
  const map = {};
  rawHeaders.forEach((header, index) => {
    const key = HEADER_ALIASES[normalizeHeader(header)];
    if (key && map[key] == null) map[key] = index;
  });
  return map;
}

function cell(row, index) {
  if (index == null || !row) return '';
  const value = row[index];
  if (value == null) return '';
  return String(value).trim();
}

function parseScore(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).trim().replace(',', '.');
  if (!cleaned) return '';
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return num;
}

/**
 * Download a marks import template pre-filled with the current class roster.
 */
export function downloadMarksImportTemplate({
  className,
  subjectName,
  term,
  assessmentLabel,
  assessmentKey,
  maxScore,
  assessedOn,
  students = [],
  records = {},
}) {
  const marksRows = [
    MARKS_HEADERS,
    ...students.map((s) => [
      s.studentId || '',
      s.firstName || '',
      s.lastName || '',
      records[s.id]?.score ?? '',
      maxScore ?? '',
      records[s.id]?.notes ?? '',
    ]),
  ];

  const infoRows = [
    ['Field', 'Value'],
    ['Class', className || ''],
    ['Subject', subjectName || ''],
    ['Term', term || ''],
    ['Assessment', assessmentLabel || ''],
    ['AssessmentKey', assessmentKey || ''],
    ['MaxScore', maxScore ?? ''],
    ['AssessmentDate', assessedOn || ''],
    ['Students', students.length],
    ['GeneratedAt', new Date().toISOString()],
  ];

  const instructions = [
    ['Marks import template — École La RACINE'],
    [''],
    ['1. Keep the "Marks" sheet headers unchanged (studentId, firstName, lastName, score, maxScore, notes).'],
    ['2. Fill the "score" column for each student (numbers only). Leave blank to skip a student.'],
    ['3. Do not change studentId values — they are used to match students.'],
    ['4. maxScore is optional; the page max is used when blank.'],
    ['5. Save the file and use Import Excel on the Marks page.'],
    [''],
    ['1. Gardez les en-têtes de la feuille « Marks ».'],
    ['2. Remplissez la colonne « score » (nombres uniquement). Laissez vide pour ignorer un élève.'],
    ['3. Ne modifiez pas les studentId — ils servent au rapprochement.'],
    ['4. Enregistrez le fichier puis importez-le sur la page Notes.'],
  ];

  const wb = XLSX.utils.book_new();
  const marksSheet = XLSX.utils.aoa_to_sheet(marksRows);
  marksSheet['!cols'] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 10 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, marksSheet, 'Marks');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(infoRows), 'Info');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), 'Instructions');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const filename = sanitizeFilename(
    `marks_${className || 'class'}_${subjectName || 'subject'}_${assessmentLabel || 'assessment'}`,
  );
  downloadBlob(buffer, `${filename}.xlsx`);
}

/**
 * Parse an uploaded marks Excel file.
 */
export async function parseMarksImportFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const preferred = ['Marks', 'marks', 'Notes', 'notes', 'Scores', 'scores'];
  const sheetName = preferred.find((n) => wb.SheetNames.includes(n)) || wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ row: 0, error: 'Empty workbook' }], meta: {} };
  }

  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (!data.length) {
    return { rows: [], errors: [{ row: 0, error: 'Empty sheet' }], meta: {} };
  }

  const headerRowIndex = data.findIndex((row) =>
    Array.isArray(row) && row.some((cellValue) => HEADER_ALIASES[normalizeHeader(cellValue)]),
  );
  if (headerRowIndex < 0) {
    return {
      rows: [],
      errors: [{ row: 1, error: 'Could not find headers (need studentId and score columns)' }],
      meta: {},
    };
  }

  const col = mapHeaders(data[headerRowIndex]);
  if (col.studentId == null && col.firstName == null && col.lastName == null) {
    return {
      rows: [],
      errors: [{ row: headerRowIndex + 1, error: 'Missing studentId (or name) column' }],
      meta: {},
    };
  }
  if (col.score == null) {
    return {
      rows: [],
      errors: [{ row: headerRowIndex + 1, error: 'Missing score column' }],
      meta: {},
    };
  }

  const errors = [];
  const rows = [];

  for (let i = headerRowIndex + 1; i < data.length; i += 1) {
    const rowArr = data[i];
    if (!rowArr || rowArr.every((v) => v == null || String(v).trim() === '')) continue;

    const excelRow = i + 1;
    const studentId = cell(rowArr, col.studentId);
    const firstName = cell(rowArr, col.firstName);
    const lastName = cell(rowArr, col.lastName);
    const notes = cell(rowArr, col.notes);
    const rawScore = col.score != null ? rowArr[col.score] : '';
    const score = parseScore(rawScore);
    const maxScore = parseScore(col.maxScore != null ? rowArr[col.maxScore] : '');

    if (!studentId && !firstName && !lastName) {
      errors.push({ row: excelRow, error: 'Missing student identity' });
      continue;
    }

    if (rawScore !== '' && rawScore != null && score === null) {
      errors.push({ row: excelRow, error: `Invalid score: ${rawScore}` });
      continue;
    }

    if (score === '') continue; // blank score = skip

    rows.push({
      __row: excelRow,
      studentId,
      firstName,
      lastName,
      score,
      maxScore: maxScore === '' || maxScore == null ? null : maxScore,
      notes: notes || '',
    });
  }

  // Optional Info sheet
  const meta = {};
  const infoSheetName = wb.SheetNames.find((n) => /^info$/i.test(n));
  if (infoSheetName) {
    const infoData = XLSX.utils.sheet_to_json(wb.Sheets[infoSheetName], { header: 1, defval: '' });
    for (const row of infoData.slice(1)) {
      const key = String(row[0] || '').trim();
      const value = row[1];
      if (key) meta[key] = value;
    }
  }

  return { rows, errors, meta, sheetName };
}

/**
 * Match parsed Excel rows to loaded class students.
 */
export function matchMarksImportRows(parsedRows, students, defaultMaxScore) {
  const byStudentId = new Map();
  const byName = new Map();

  for (const s of students) {
    const sid = String(s.studentId || '').trim().toLowerCase();
    if (sid) byStudentId.set(sid, s);
    const nameKey = `${String(s.firstName || '').trim().toLowerCase()}|${String(s.lastName || '').trim().toLowerCase()}`;
    if (nameKey !== '|') {
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey).push(s);
    }
  }

  const matched = [];
  const unmatched = [];
  const errors = [];
  const used = new Set();

  for (const row of parsedRows) {
    let student = null;
    const sid = String(row.studentId || '').trim().toLowerCase();
    if (sid && byStudentId.has(sid)) {
      student = byStudentId.get(sid);
    } else {
      const nameKey = `${String(row.firstName || '').trim().toLowerCase()}|${String(row.lastName || '').trim().toLowerCase()}`;
      const candidates = byName.get(nameKey) || [];
      if (candidates.length === 1) student = candidates[0];
      else if (candidates.length > 1) {
        errors.push({
          row: row.__row,
          error: `Ambiguous name match for ${row.firstName} ${row.lastName}`,
        });
        continue;
      }
    }

    if (!student) {
      unmatched.push(row);
      continue;
    }
    if (used.has(student.id)) {
      errors.push({
        row: row.__row,
        error: `Duplicate row for ${student.studentId || student.firstName}`,
      });
      continue;
    }

    const max = row.maxScore != null ? Number(row.maxScore) : Number(defaultMaxScore);
    const score = Number(row.score);
    if (Number.isNaN(score)) {
      errors.push({ row: row.__row, error: 'Invalid score' });
      continue;
    }
    if (score < 0) {
      errors.push({ row: row.__row, error: 'Score cannot be negative' });
      continue;
    }
    if (max > 0 && score > max) {
      errors.push({
        row: row.__row,
        error: `Score ${score} exceeds max ${max}`,
        warning: true,
      });
    }

    used.add(student.id);
    matched.push({
      studentId: student.id,
      studentCode: student.studentId,
      name: `${student.firstName} ${student.lastName}`,
      score,
      maxScore: max || defaultMaxScore,
      notes: row.notes || '',
      excelRow: row.__row,
      overMax: max > 0 && score > max,
    });
  }

  return { matched, unmatched, errors };
}

export { sanitizeSheetName, MARKS_HEADERS };
