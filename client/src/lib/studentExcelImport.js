import * as XLSX from 'xlsx';
import fileSaver from 'file-saver';

const saveAs = fileSaver.saveAs || fileSaver;

/**
 * Column map for Google Forms export:
 * "FICHE D'INSCRIPTION SCOLAIRE … (réponses).xlsx"
 * Headers are matched loosely (accents / spacing / * ignored).
 */
const COLUMN_ALIASES = [
  { key: 'lastName', aliases: ['nom/ name / izina', 'nom / name / izina', 'nom'] },
  { key: 'postName', aliases: ['post-nom / post name', 'post-nom', 'post name'] },
  { key: 'firstName', aliases: ['prénom / surname', 'prenom / surname', 'prénom', 'prenom'] },
  { key: 'gender', aliases: ['sexe / sex / igitsina', 'sexe / sex', 'sexe'] },
  { key: 'dateOfBirth', aliases: ['date de naissance / date of birth / itariki yavutseho', 'date de naissance / date of birth', 'date de naissance'] },
  { key: 'nationality', aliases: ['nationalité / nationality / ubwenegihugu', 'nationalite / nationality', 'nationalité'] },
  { key: 'fatherName', aliases: ["nom – prénom du père / father's name / amazina ya se", "nom - prenom du pere / father's name", 'nom – prénom du père', "father's name"] },
  { key: 'fatherProfession', aliases: ['profession / akazi akora'] },
  { key: 'fatherPhone', aliases: ['numéro de téléphone / phone number / nimero ya telefoni', 'numero de telephone / phone number / nimero ya telefoni'] },
  { key: 'fatherEmail', aliases: ['e-mail / imeri'] },
  { key: 'motherName', aliases: ["nom – prénom de la mère / mother's name / amazina ya nyina", "nom - prenom de la mere / mother's name", 'nom – prénom de la mère'] },
  // Mother profession/phone/email often get "2" suffixes in Google Forms exports
  { key: 'motherProfession', aliases: ['profession /  akazi akora', 'profession / akazi akora 2'] },
  { key: 'motherPhone', aliases: ['numéro de téléphone / phone number / nimero ya telefoni 2', 'numero de telephone / phone number / nimero ya telefoni 2'] },
  { key: 'motherEmail', aliases: ['e-mail / imeri 2'] },
  { key: 'district', aliases: ['district / akarere', 'district'] },
  { key: 'sector', aliases: ['secteur / sector / umurenge', 'secteur / sector', 'secteur'] },
  { key: 'cell', aliases: ['cellules / cells / akagari', 'cellule / cells / akagari', 'cellules'] },
  { key: 'village', aliases: ['village / umudugudu', 'village'] },
  { key: 'emergencyContactName', aliases: ['nom, post-nom', 'nom post-nom'] },
  { key: 'emergencyContactPhone', aliases: ['numéro de téléphone / phone number / nimero ya telefoni 3', 'numero de telephone / phone number / nimero ya telefoni 3'] },
  { key: 'previousSchoolName', aliases: ['ecole de provenance / school of provenance / ikigo yavuyeho', "école de provenance / school of provenance / ikigo yavuyeho", 'école de provenance'] },
  { key: 'previousClass', aliases: ['classe / class / ishuri'] },
  { key: 'academicYearName', aliases: ["année scolaire / school year / umwaka w'amashuri", "annee scolaire / school year / umwaka w'amashuri", 'année scolaire'] },
  { key: 'classLabel', aliases: ['classe / class / ishuri 2'] },
  { key: 'inscritA', aliases: ['inscrit à :', 'inscrit a :', 'inscrit à', 'inscrit a'] },
  { key: 'surgicalHistory', aliases: ['antécédents chirurgicaux / surgical history / niba yageze kubagwa', 'antecedents chirurgicaux / surgical history'] },
  { key: 'heartMurmur', aliases: ['souffle cardiaque / heart murmur / niba arwaye umutima', 'souffle cardiaque / heart murmur'] },
  { key: 'medicinalAllergies', aliases: ['allergies médicamenteuses / medicinal allergies / allergie z\'imiti', 'allergies medicamenteuses / medicinal allergies'] },
  { key: 'generalAllergies', aliases: ['allergies / allergie rusange', 'allergies'] },
  { key: 'tuberculosis', aliases: ['tuberculose, maladie infectieuse / tuberculosis, infections diseas / igituntu n\'izindi ndwara zandura', 'tuberculose, maladie infectieuse'] },
  { key: 'foodIntolerance', aliases: ['intolérance alimentaire / food intolerance / kutihanganira bimwe mubiribwa', 'intolerance alimentaire / food intolerance'] },
  { key: 'diabetes', aliases: ['diabète / diabetes', 'diabete / diabetes', 'diabète'] },
  { key: 'asthma', aliases: ['asthme / asthma', 'asthme'] },
  { key: 'visualDisturbances', aliases: ['troubles visuels / visual disturbances / ibibazo by\'amaso', 'troubles visuels / visual disturbances'] },
  { key: 'registrationDate', aliases: ['date d’enregistrement du dossier / date of registration / itariki yo kwiyandikisha', 'date d\'enregistrement du dossier / date of registration', 'date d’enregistrement du dossier'] },
  { key: 'transportMode', aliases: ['informations sur le transport de l\'enfant / transport informations', 'informations sur le transport'] },
  { key: 'busStop', aliases: ['arrêt bus / bus stop', 'arret bus / bus stop', 'arrêt bus'] },
  { key: 'paymentMethod', aliases: ['mode de paiement pour l\'inscription / payment method for registration', 'mode de paiement pour l’inscription / payment method for registration'] },
];

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, "'")
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function excelDateToIso(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  // US-style from Google Sheets export: M/D/YY or M/D/YYYY
  const mdy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (mdy) {
    let year = Number(mdy[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return `${year}-${pad2(mdy[1])}-${pad2(mdy[2])}`;
  }

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return '';
}

function cellStr(value) {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function parseOuiNon(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return value;
  const v = normalizeHeader(value);
  if (!v) return null;
  if (v.startsWith('oui') || v.startsWith('yes') || v.startsWith('yego') || v === 'o' || v === 'y' || v === 'true' || v === '1') {
    return true;
  }
  if (
    v.startsWith('non')
    || v.startsWith('no')
    || v.startsWith('hoya')
    || v.includes('pas de maladie')
    || v.includes('pas d\'allerg')
    || v.includes('pas d"allerg')
    || v === 'ras'
    || v === 'false'
    || v === '0'
  ) {
    return false;
  }
  return null;
}

function normalizeGender(value) {
  const v = normalizeHeader(value);
  if (v.includes('masculin') || v.includes('male') || v.includes('gabo') || v === 'm') return 'MALE';
  if (v.includes('feminin') || v.includes('female') || v.includes('gore') || v === 'f') return 'FEMALE';
  return '';
}

function normalizeTransport(value) {
  const v = normalizeHeader(value);
  if (!v) return 'NONE';
  if (v.includes('ecole') || v.includes('school')) return 'SCHOOL';
  if (v.includes('prive') || v.includes('private')) return 'PRIVATE';
  if (v.includes('pas de transport') || v.includes('none')) return 'NONE';
  return 'NONE';
}

function normalizeBusStop(value) {
  const v = normalizeHeader(value).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!v) return null;
  const map = {
    mbugangari: 'MBUGANGARI',
    mbugangali: 'MBUGANGARI',
    makoro: 'MAKORO',
    centre_ville: 'CENTRE_VILLE',
    centreville: 'CENTRE_VILLE',
    majengo: 'MAJENGO',
    rugerero: 'RUGERERO',
    byahi: 'BYAHI',
    rcd: 'RCD',
    petite_barriere: 'PETITE_BARRIERE',
    petitebarriere: 'PETITE_BARRIERE',
  };
  return map[v] || null;
}

function normalizePayment(value) {
  const v = normalizeHeader(value);
  if (!v) return '';
  if (v.includes('bordereau')) return 'BORDEREAU';
  if (v.includes('momo') || v.includes('mobile')) return 'MOMO_PAY';
  return '';
}

function normalizeTreatment(tuberculosisRaw, generalAllergiesRaw) {
  const tb = normalizeHeader(tuberculosisRaw);
  if (tb.includes('pas de maladie') || tb.includes('no illness')) return 'NO_ILLNESS';
  if (tb.includes('pas de traitement') || tb.includes('no treatment')) return 'NO_TREATMENT';
  if (tb.includes('traitement') || tb.includes('on treatment')) return 'ON_TREATMENT';
  const allergy = normalizeHeader(generalAllergiesRaw);
  if (allergy.includes('pas d') || allergy === 'non' || allergy === 'ras') return 'NO_ILLNESS';
  return 'NO_ILLNESS';
}

/** Map form class label → grade code (M1, P1, …) */
export function classLabelToGrade(label) {
  const v = normalizeHeader(label);
  if (!v) return null;

  const exact = {
    'creche': 'CRECHE',
    'crèche': 'CRECHE',
    'petite section (ps)/m1': 'M1',
    'petite section': 'M1',
    'ps/m1': 'M1',
    'm1': 'M1',
    'moyenne section/m2': 'M2',
    'moyenne section': 'M2',
    'm2': 'M2',
    'grande section/m3': 'M3',
    'grande section': 'M3',
    'm3': 'M3',
    'grande section/m3 (top class)': 'TOP',
    'top class': 'TOP',
    '1ere annee maternelle / nursery 1': 'M1',
    '2eme annee maternelle / nursery 2': 'M2',
    '3eme annee maternelle / nursery 3': 'M3',
    'cp/p1': 'P1',
    'ce1/p2': 'P2',
    'ce2/p3': 'P3',
    'cm1/p4': 'P4',
    'cm2/p5': 'P5',
    '6eme annee/p6': 'P6',
    '1ere annee primaire / primary 1': 'P1',
    '2eme annee primaire / primary 2': 'P2',
    '3eme annee primaire / primary 3': 'P3',
    '4eme annee primaire / primary 4': 'P4',
    '5eme annee primaire / primary 5': 'P5',
    '6eme annee primaire / primary 6': 'P6',
  };
  if (exact[v]) return exact[v];

  if (v.includes('creche')) return 'CRECHE';
  if (v.includes('top class') || v.includes('topclass') || (v.includes('grande') && v.includes('top'))) return 'TOP';
  if (v.includes('petite') || v.includes('nursery 1') || /\bm1\b/.test(v) || v.includes('1ere annee maternelle')) return 'M1';
  if ((v.includes('moyenne') && v.includes('middle')) || v.includes('middle class')) return 'M2';
  if (v.includes('moyenne') || v.includes('nursery 2') || /\bm2\b/.test(v) || v.includes('2eme annee maternelle')) return 'M2';
  if (v.includes('grande') || v.includes('nursery 3') || /\bm3\b/.test(v) || v.includes('3eme annee maternelle')) return 'M3';
  if (v.includes('cp/') || v.includes('primary 1') || v.includes('1ere annee primaire') || /\bp1\b/.test(v)) return 'P1';
  if (v.includes('ce1') || v.includes('primary 2') || v.includes('2eme annee primaire') || /\bp2\b/.test(v)) return 'P2';
  if (v.includes('ce2') || v.includes('primary 3') || v.includes('3eme annee primaire') || /\bp3\b/.test(v)) return 'P3';
  if (v.includes('cm1') || v.includes('primary 4') || v.includes('4eme annee primaire') || /\bp4\b/.test(v)) return 'P4';
  if (v.includes('cm2') || v.includes('primary 5') || v.includes('5eme annee primaire') || /\bp5\b/.test(v)) return 'P5';
  if (v.includes('6eme annee') || v.includes('primary 6') || /\bp6\b/.test(v)) return 'P6';
  return null;
}

/**
 * Extract campus letter from form "Inscrit à :" values like "LA RACINE (A)" / "LA RACINE (B)".
 * These map to campuses (e.g. LRSA / LRSB), not class sections.
 */
export function parseInscritCampusLetter(value) {
  const raw = cellStr(value);
  if (!raw) return '';
  const paren = raw.match(/\(([A-Za-z0-9]+)\)\s*$/);
  if (paren) return paren[1].toUpperCase();
  const trailing = raw.match(/(?:^|[\s\-_/])([A-Za-z])\s*$/);
  if (trailing) return trailing[1].toUpperCase();
  return '';
}

/** @deprecated Use parseInscritCampusLetter — A/B in "Inscrit à" means campus, not class section. */
export function parseInscritSection(value) {
  return parseInscritCampusLetter(value);
}

/**
 * Resolve campus from "Inscrit à : LA RACINE (A|B)" against school campuses.
 * Prefers exact name match, then (A)/(B) markers in name/code, then ordered A/B fallback.
 */
export function resolveCampusFromInscrit(inscritA, campuses = [], defaultCampusId = null) {
  const list = (campuses || []).filter((c) => c && c.isActive !== false);
  const needle = normalizeHeader(inscritA);
  const letter = parseInscritCampusLetter(inscritA);

  if (needle) {
    const exact = list.find((c) => normalizeHeader(c.name) === needle || normalizeHeader(c.code) === needle);
    if (exact) return exact;
  }

  if (letter) {
    const byName = list.find((c) => {
      const n = normalizeHeader(c.name);
      return n.includes(`(${letter.toLowerCase()})`)
        || n.endsWith(` ${letter.toLowerCase()}`)
        || n.includes(`campus ${letter.toLowerCase()}`)
        || /\bracine\s*\(?\s*[ab]\s*\)?\b/.test(n) && n.includes(`(${letter.toLowerCase()})`);
    });
    if (byName) return byName;

    // Codes like LRSA / LRSB / LRS-A — require letter as a campus marker, not any trailing letter
    const byCode = list.find((c) => {
      const code = String(c.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!code) return false;
      if (code === letter || code === `LRS${letter}` || code === `LARACINE${letter}`) return true;
      return /(?:LRS|CAMPUS|RACINE)?[_\-]?([AB])$/.test(code) && code.endsWith(letter);
    });
    if (byCode) return byCode;

    if (list.length >= 1) {
      const sorted = [...list].sort((a, b) => String(a.code || a.name).localeCompare(String(b.code || b.name)));
      const idx = letter.charCodeAt(0) - 'A'.charCodeAt(0);
      if (idx >= 0 && idx < sorted.length) return sorted[idx];
    }
  }

  if (needle) {
    const fuzzy = list.find((c) => {
      const n = normalizeHeader(c.name);
      return n.includes(needle) || needle.includes(n);
    });
    if (fuzzy) return fuzzy;
  }

  if (defaultCampusId) {
    return list.find((c) => c.id === defaultCampusId) || null;
  }
  return null;
}

function buildHeaderIndex(headers) {
  const index = {};
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));

  for (const col of COLUMN_ALIASES) {
    for (const alias of col.aliases) {
      const want = normalizeHeader(alias);
      const hit = normalizedHeaders.find((h) => h.norm === want || h.norm.startsWith(want) || want.startsWith(h.norm));
      if (hit && index[col.key] == null) {
        index[col.key] = hit.raw;
        break;
      }
    }
  }

  // Disambiguate two "Profession / Akazi akora" columns by order
  const professionHeaders = normalizedHeaders.filter((h) => h.norm.replace(/\s+/g, ' ') === 'profession / akazi akora' || h.norm.includes('profession / akazi'));
  if (professionHeaders.length >= 1 && index.fatherProfession == null) {
    index.fatherProfession = professionHeaders[0].raw;
  }
  if (professionHeaders.length >= 2) {
    index.motherProfession = professionHeaders[1].raw;
  }

  // Disambiguate Classe columns: first = previous, second = registration
  const classHeaders = normalizedHeaders.filter((h) => h.norm.startsWith('classe / class / ishuri'));
  if (classHeaders.length >= 1) index.previousClass = classHeaders[0].raw;
  if (classHeaders.length >= 2) index.classLabel = classHeaders[1].raw;
  else if (classHeaders.length === 1 && !index.classLabel) index.classLabel = classHeaders[0].raw;

  // Phone columns in order: father, mother, emergency
  const phoneHeaders = normalizedHeaders.filter((h) => h.norm.includes('numero de telephone') || h.norm.includes('phone number'));
  if (phoneHeaders.length >= 1) index.fatherPhone = phoneHeaders[0].raw;
  if (phoneHeaders.length >= 2) index.motherPhone = phoneHeaders[1].raw;
  if (phoneHeaders.length >= 3) index.emergencyContactPhone = phoneHeaders[2].raw;

  // Email columns: father then mother
  const emailHeaders = normalizedHeaders.filter((h) => h.norm.includes('e-mail') || h.norm.includes('email') || h.norm.includes('imeri'));
  if (emailHeaders.length >= 1) index.fatherEmail = emailHeaders[0].raw;
  if (emailHeaders.length >= 2) index.motherEmail = emailHeaders[1].raw;

  return index;
}

function resolveAcademicYearId(name, academicYears, campusId = null) {
  const needle = normalizeHeader(name).replace(/[/\s]+/g, '-');
  if (!needle) return null;
  const pool = campusId
    ? academicYears.filter((y) => !y.campusId || y.campusId === campusId)
    : academicYears;
  const hit = pool.find((y) => normalizeHeader(y.name).replace(/[/\s]+/g, '-') === needle);
  return hit?.id || null;
}

/** Prefer campus-local year; if missing, reuse same-named year from another campus (server will clone it). */
function resolveAcademicYearForImport(name, academicYears, campusId = null) {
  const localId = resolveAcademicYearId(name, academicYears, campusId);
  if (localId) return { academicYearId: localId, yearBorrowed: false };

  const anyId = resolveAcademicYearId(name, academicYears, null);
  if (anyId) return { academicYearId: anyId, yearBorrowed: true };

  return { academicYearId: null, yearBorrowed: false };
}

function resolveClassId({ classLabel, academicYearId, campusId }, classes) {
  const grade = classLabelToGrade(classLabel);
  // Class section is independent of campus A/B ("Inscrit à"); prefer section A then any grade match.
  const preferredSection = 'A';
  const pool = classes.filter((c) => {
    if (campusId && c.campusId && c.campusId !== campusId) return false;
    if (academicYearId && c.academicYearId && c.academicYearId !== academicYearId) return false;
    return true;
  });

  if (grade) {
    const byGradeSection = pool.find(
      (c) => String(c.grade).toUpperCase() === grade
        && String(c.section || '').toUpperCase() === preferredSection,
    );
    if (byGradeSection) {
      return { classId: byGradeSection.id, grade, section: byGradeSection.section || preferredSection };
    }

    const byGrade = pool.find((c) => String(c.grade).toUpperCase() === grade);
    if (byGrade) return { classId: byGrade.id, grade, section: byGrade.section || preferredSection };
  }

  const needle = normalizeHeader(classLabel);
  const exact = pool.find((c) => normalizeHeader(c.name) === needle);
  if (exact) {
    return {
      classId: exact.id,
      grade: exact.grade || grade,
      section: exact.section || preferredSection,
    };
  }

  return { classId: null, grade, section: preferredSection };
}

function looksLikeSchoolYear(value) {
  return /^\d{4}\s*[-/]\s*\d{4}$/.test(String(value || '').trim());
}

/**
 * Download the school Google Form template (blank).
 */
export async function downloadStudentImportTemplate() {
  const res = await fetch('/templates/fiche-inscription-scolaire.xlsx');
  if (!res.ok) throw new Error('Template file not found');
  const blob = await res.blob();
  saveAs(blob, 'fiche-inscription-scolaire-template.xlsx');
}

/**
 * Parse Google Forms "Fiche d'inscription" export into registration payloads.
 * Uses column "Inscrit à :" (LA RACINE A / B) to pick the target campus.
 */
export function parseStudentImportFile(fileBuffer, {
  academicYears = [],
  classes = [],
  campuses = [],
  defaultCampusId = null,
} = {}) {
  const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames.find((n) => /r[eé]ponse|formulaire|student|inscription/i.test(n))
    || workbook.SheetNames[0];
  if (!sheetName) {
    return { students: [], errors: [{ row: 0, error: 'Workbook has no sheets' }] };
  }

  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
  if (!matrix.length) {
    return { students: [], errors: [{ row: 0, error: 'Empty sheet' }] };
  }

  const headers = matrix[0].map((h) => String(h || ''));
  const headerIndex = buildHeaderIndex(headers);
  const get = (rowArr, key) => {
    const header = headerIndex[key];
    if (!header) return '';
    const col = headers.indexOf(header);
    return col >= 0 ? rowArr[col] : '';
  };

  const students = [];
  const errors = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const rowArr = matrix[i];
    const excelRow = i + 1;
    if (!rowArr || !rowArr.some((c) => String(c || '').trim())) continue;

    const lastName = cellStr(get(rowArr, 'lastName'));
    const postName = cellStr(get(rowArr, 'postName'));
    const firstName = cellStr(get(rowArr, 'firstName'));
    if (!lastName && !postName && !firstName) continue;

    const academicYearName = cellStr(get(rowArr, 'academicYearName'));
    const classLabel = cellStr(get(rowArr, 'classLabel'));
    const inscritA = cellStr(get(rowArr, 'inscritA'));
    const campus = resolveCampusFromInscrit(inscritA, campuses, defaultCampusId);
    if (!campus?.id) {
      errors.push({
        row: excelRow,
        error: inscritA
          ? `Unknown campus "${inscritA}" — create campuses LA RACINE A / B (or codes ending in A/B) first`
          : 'Missing "Inscrit à :" (LA RACINE A or B) — cannot choose campus',
      });
      continue;
    }

    const { academicYearId, yearBorrowed } = resolveAcademicYearForImport(
      academicYearName,
      academicYears,
      campus.id,
    );

    // If year must be cloned onto this campus, don't attach another campus's class id
    const resolved = yearBorrowed
      ? {
        classId: null,
        grade: classLabelToGrade(classLabel),
        section: 'A',
      }
      : resolveClassId({ classLabel, academicYearId, campusId: campus.id }, classes);

    if (!academicYearId) {
      errors.push({
        row: excelRow,
        error: `Unknown academic year "${academicYearName || '(empty)'}" — create it in Academic Years first (for campus A or B)`,
      });
      continue;
    }
    if (!resolved.classId && !resolved.grade) {
      errors.push({
        row: excelRow,
        error: `Unrecognized class "${classLabel || '(empty)'}" — use labels like "1ère année Primaire / Primary 1"`,
      });
      continue;
    }

    let previousSchoolName = cellStr(get(rowArr, 'previousSchoolName'));
    if (looksLikeSchoolYear(previousSchoolName)) {
      // Misplaced year in provenance column on some exports
      previousSchoolName = '';
    }

    const tuberculosisRaw = get(rowArr, 'tuberculosis');
    const generalAllergiesRaw = cellStr(get(rowArr, 'generalAllergies'));
    const campusLetter = parseInscritCampusLetter(inscritA);
    const payload = {
      __row: excelRow,
      campusId: campus.id,
      campusCode: campus.code || '',
      campusName: campus.name || '',
      campusLetter: campusLetter || '',
      inscritA,
      yearBorrowed: Boolean(yearBorrowed),
      lastName,
      postName,
      firstName,
      gender: normalizeGender(get(rowArr, 'gender')),
      dateOfBirth: excelDateToIso(get(rowArr, 'dateOfBirth')),
      nationality: cellStr(get(rowArr, 'nationality')) || 'Rwandaise',
      fatherName: cellStr(get(rowArr, 'fatherName')),
      fatherProfession: cellStr(get(rowArr, 'fatherProfession')),
      fatherPhone: cellStr(get(rowArr, 'fatherPhone')),
      fatherEmail: cellStr(get(rowArr, 'fatherEmail')),
      motherName: cellStr(get(rowArr, 'motherName')),
      motherProfession: cellStr(get(rowArr, 'motherProfession')),
      motherPhone: cellStr(get(rowArr, 'motherPhone')),
      motherEmail: cellStr(get(rowArr, 'motherEmail')),
      province: 'WEST',
      district: cellStr(get(rowArr, 'district')),
      sector: cellStr(get(rowArr, 'sector')),
      cell: cellStr(get(rowArr, 'cell')),
      village: cellStr(get(rowArr, 'village')),
      emergencyContactName: cellStr(get(rowArr, 'emergencyContactName')),
      emergencyContactPhone: cellStr(get(rowArr, 'emergencyContactPhone')),
      previousSchoolName,
      previousSchoolYear: '',
      previousClass: cellStr(get(rowArr, 'previousClass')),
      academicYearId,
      classId: resolved.classId || undefined,
      classGrade: resolved.grade,
      classSection: resolved.section || 'A',
      classLabel,
      registrationDate: excelDateToIso(get(rowArr, 'registrationDate')) || new Date().toISOString().slice(0, 10),
      transportMode: normalizeTransport(get(rowArr, 'transportMode')),
      busStop: normalizeBusStop(get(rowArr, 'busStop')),
      paymentMethod: normalizePayment(get(rowArr, 'paymentMethod')),
      registrationStatus: 'APPROVED',
      surgicalHistory: parseOuiNon(get(rowArr, 'surgicalHistory')),
      heartMurmur: parseOuiNon(get(rowArr, 'heartMurmur')),
      medicinalAllergies: parseOuiNon(get(rowArr, 'medicinalAllergies')),
      generalAllergies: generalAllergiesRaw,
      tuberculosis: parseOuiNon(tuberculosisRaw),
      treatment: normalizeTreatment(tuberculosisRaw, generalAllergiesRaw),
      foodIntolerance: parseOuiNon(get(rowArr, 'foodIntolerance')),
      diabetes: parseOuiNon(get(rowArr, 'diabetes')),
      asthma: parseOuiNon(get(rowArr, 'asthma')),
      visualDisturbances: parseOuiNon(get(rowArr, 'visualDisturbances')),
      additionalInfo: inscritA ? `Inscrit à: ${inscritA}` : '',
      documents: [],
    };

    const missing = [];
    if (!payload.lastName) missing.push('Nom');
    if (!payload.postName) missing.push('Post-Nom');
    if (!payload.gender) missing.push('Sexe');
    if (!payload.dateOfBirth) missing.push('Date de naissance');
    if (!payload.fatherName || !payload.fatherPhone) missing.push('Père (nom/téléphone)');
    if (!payload.motherName || !payload.motherPhone) missing.push('Mère (nom/téléphone)');
    if (!payload.district || !payload.sector || !payload.cell || !payload.village) missing.push('Adresse');
    if (!payload.emergencyContactName || !payload.emergencyContactPhone) missing.push('Contact urgence');
    if (!payload.paymentMethod) missing.push('Mode de paiement');

    if (missing.length) {
      errors.push({ row: excelRow, error: `Champs manquants: ${missing.join(', ')}` });
      continue;
    }

    students.push(payload);
  }

  return { students, errors };
}
