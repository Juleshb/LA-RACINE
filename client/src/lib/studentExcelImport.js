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

/** Map form class label → grade code (N1, P1, …) */
export function classLabelToGrade(label) {
  const v = normalizeHeader(label);
  if (!v) return null;

  const exact = {
    'creche': 'CRECHE',
    'crèche': 'CRECHE',
    '1ere annee maternelle / nursery 1': 'N1',
    '2eme annee maternelle / nursery 2': 'N2',
    '3eme annee maternelle / nursery 3': 'N3',
    'top class': 'TOP',
    '1ere annee primaire / primary 1': 'P1',
    '2eme annee primaire / primary 2': 'P2',
    '3eme annee primaire / primary 3': 'P3',
    '4eme annee primaire / primary 4': 'P4',
    '5eme annee primaire / primary 5': 'P5',
    '6eme annee primaire / primary 6': 'P6',
  };
  if (exact[v]) return exact[v];

  if (v.includes('creche')) return 'CRECHE';
  if (v.includes('top class') || v.includes('topclass')) return 'TOP';
  if (v.includes('nursery 1') || v.includes('1ere annee maternelle') || v.includes('1re annee maternelle')) return 'N1';
  if (v.includes('nursery 2') || v.includes('2eme annee maternelle') || v.includes('2e annee maternelle')) return 'N2';
  if (v.includes('nursery 3') || v.includes('3eme annee maternelle') || v.includes('3e annee maternelle')) return 'N3';
  if (v.includes('primary 1') || v.includes('1ere annee primaire') || v.includes('1re annee primaire')) return 'P1';
  if (v.includes('primary 2') || v.includes('2eme annee primaire') || v.includes('2e annee primaire')) return 'P2';
  if (v.includes('primary 3') || v.includes('3eme annee primaire') || v.includes('3e annee primaire')) return 'P3';
  if (v.includes('primary 4') || v.includes('4eme annee primaire') || v.includes('4e annee primaire')) return 'P4';
  if (v.includes('primary 5') || v.includes('5eme annee primaire') || v.includes('5e annee primaire')) return 'P5';
  if (v.includes('primary 6') || v.includes('6eme annee primaire') || v.includes('6e annee primaire')) return 'P6';
  return null;
}

/** Extract section A/B from "LA RACINE (A)" */
export function parseInscritSection(value) {
  const raw = cellStr(value);
  const m = raw.match(/\(([A-Za-z0-9]+)\)/);
  return m ? m[1].toUpperCase() : '';
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

function resolveAcademicYearId(name, academicYears) {
  const needle = normalizeHeader(name).replace(/[/\s]+/g, '-');
  if (!needle) return null;
  const hit = academicYears.find((y) => normalizeHeader(y.name).replace(/[/\s]+/g, '-') === needle);
  return hit?.id || null;
}

function resolveClassId({ classLabel, inscritA, academicYearId }, classes) {
  const grade = classLabelToGrade(classLabel);
  const section = parseInscritSection(inscritA) || 'A';
  const pool = academicYearId
    ? classes.filter((c) => c.academicYearId === academicYearId)
    : classes;

  if (grade) {
    const byGradeSection = pool.find(
      (c) => String(c.grade).toUpperCase() === grade
        && String(c.section || '').toUpperCase() === section,
    );
    if (byGradeSection) return { classId: byGradeSection.id, grade, section };

    const byGrade = pool.find((c) => String(c.grade).toUpperCase() === grade);
    if (byGrade) return { classId: byGrade.id, grade, section: byGrade.section || section };
  }

  const needle = normalizeHeader(classLabel);
  const exact = pool.find((c) => normalizeHeader(c.name) === needle);
  if (exact) {
    return {
      classId: exact.id,
      grade: exact.grade || grade,
      section: exact.section || section,
    };
  }

  return { classId: null, grade, section };
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
 */
export function parseStudentImportFile(fileBuffer, { academicYears = [], classes = [] } = {}) {
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
    const academicYearId = resolveAcademicYearId(academicYearName, academicYears);
    const resolved = resolveClassId({ classLabel, inscritA, academicYearId }, classes);

    if (!academicYearId) {
      errors.push({ row: excelRow, error: `Unknown academic year "${academicYearName || '(empty)'}" — create it in Academic Years first` });
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
    const payload = {
      __row: excelRow,
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
