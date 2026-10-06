import { getNurseryCompetenceDomains } from './nurseryTemplates.js';

function grading(test1Max, test2Max) {
  const examMax = test1Max + test2Max;
  return { test1Max, test2Max, examMax, totalMax: test1Max + test2Max + examMax };
}

function subject(name, code, test1Max, test2Max) {
  return { name, code, ...grading(test1Max, test2Max) };
}

function domain(name, order, subjects, extra = {}) {
  return { name, order, subjects, ...extra };
}

const STEM = { subtotalGroup: 'STEM' };
const OTHER_LANG = { excludeFromGeneral: true };
const TOTAL_ROW = { subtotalLabel: 'Total' };

/** P1–P2 — Bulletin P1 & 2 Format.xlsx */
export const PRIMARY_P1_P2_DOMAINS = [
  domain('LANGUES CONGOLAISES', 1, [
    subject('Lect - Écrit en langues congolaises', 'LC-LECT', 30, 30),
    subject('Expression orale', 'LC-ORAL', 20, 20),
    subject('Expression écrite', 'LC-ECRIT', 20, 20),
  ]),
  domain('FRANCAIS', 2, [
    subject('Vocabulaire', 'FR-VOC', 10, 10),
    subject('Expression orale', 'FR-ORAL', 20, 20),
  ]),
  domain('MATHEMATIQUES', 3, [
    subject('Mesures de grandeurs', 'MATH-MES', 10, 10),
    subject('Formes géométriques', 'MATH-GEO', 10, 10),
    subject('Numération', 'MATH-NUM', 20, 20),
    subject('Opération', 'MATH-OP', 20, 20),
    subject('Problèmes', 'MATH-PROB', 20, 20),
  ], STEM),
  domain('SCIENCES', 4, [
    subject("Science d'éveil", 'SCI-EVEIL', 20, 20),
  ], STEM),
  domain('TECHNOLOGIE', 5, [
    subject('Technologie', 'TECH', 10, 10),
  ], STEM),
  domain("DOMAINE DE L'UNIVERS ET ENVIRONNEMENT", 6, [
    subject('Ed.civ&morale', 'ENV-CIV', 10, 10),
    subject('Ed.sante&env', 'ENV-SANTE', 10, 10),
  ]),
  domain('DOMAINE DES ARTS', 7, [
    subject('Arts plastiques', 'ART-PLAS', 10, 10),
    subject('Arts dramatiques', 'ART-DRAM', 10, 10),
  ]),
  domain('DOMAINE DU DEVELOPPMENT PERSONNEL', 8, [
    subject('Ed.phys&sports', 'DEV-EPS', 10, 10),
    subject('In.trav.prod', 'DEV-TRAV', 10, 10),
    subject('Religion', 'DEV-REL', 10, 10),
  ]),
  domain('AUTRES LANGUES', 9, [
    subject('ENGLISH', 'EN', 30, 30),
    subject('KINYARWANDA', 'KIN', 20, 20),
  ], OTHER_LANG),
];

/** P3–P4 — Bulletin P3 & 4 Format.xlsx */
export const PRIMARY_P3_P4_DOMAINS = [
  domain('LANGUES CONGOLAISES', 1, [
    subject('Lect - Écrit en langues congolaises', 'LC-LECT', 30, 30),
    subject('Exp-orale&vocab', 'LC-ORALVOC', 10, 10),
    subject('Grammaire & Conjug.', 'LC-GRAM', 10, 10),
    subject('Orth. & Rédaction', 'LC-ORTH', 5, 5),
  ]),
  domain('FRANCAIS', 2, [
    subject('Lect - Écrit en langues Françaises', 'FR-LECT', 30, 30),
    subject('Exp.orale-Récit.-Voc.', 'FR-ORAL', 10, 10),
    subject('Orth. Phras. Ecrit. & réd.', 'FR-ORTH', 10, 10),
    subject('Gram.conj analyse', 'FR-GRAM', 15, 15),
  ]),
  domain('MATHEMATIQUES', 3, [
    subject('Numération', 'MATH-NUM', 10, 10),
    subject('Opération', 'MATH-OP', 10, 10),
    subject('Mesures de grandeurs', 'MATH-MES', 10, 10),
    subject('Formes géométriques', 'MATH-GEO', 10, 10),
    subject('Problèmes', 'MATH-PROB', 20, 20),
  ], STEM),
  domain('SCIENCES', 4, [
    subject('Zoologie - botanique & Info', 'SCI-ZOO', 10, 10),
  ], STEM),
  domain('TECHNOLOGIE', 5, [
    subject('Technologie', 'TECH', 20, 20),
  ], STEM),
  domain("DOMAINE DE L'UNIVERS ET ENVIRONNEMENT", 6, [
    subject('Education civ. & morale', 'ENV-CIV', 10, 10),
    subject('Education santé & env.', 'ENV-SANTE', 10, 10),
    subject('Géographie', 'ENV-GEO', 10, 10),
    subject('Histoire', 'ENV-HIST', 10, 10),
  ]),
  domain('DOMAINE DES ARTS', 7, [
    subject('Arts plastiques', 'ART-PLAS', 10, 10),
    subject('Arts dramatiques', 'ART-DRAM', 10, 10),
  ]),
  domain('DOMAINE DU DEVELOPPMENT PERSONNEL', 8, [
    subject('Ed.phys. & sportive', 'DEV-EPS', 10, 10),
    subject('Init. Trav. Prod', 'DEV-TRAV', 10, 10),
    subject('Religion', 'DEV-REL', 10, 10),
  ]),
  domain('AUTRES LANGUES', 9, [
    subject('ENGLISH', 'EN', 30, 30),
    subject('KINYARWANDA', 'KIN', 20, 20),
  ], OTHER_LANG),
];

/** P5–P6 — Bulletin P5 & P6 Format.xlsx */
export const PRIMARY_P5_P6_DOMAINS = [
  domain('LANGUES CONGOLAISES', 1, [
    subject('Lect - Écrit en langues congolaises', 'LC-LECT', 20, 20),
    subject('Grammaire&conj', 'LC-GRAM', 10, 10),
    subject('Exp.orale-vocabulaire', 'LC-ORALVOC', 10, 10),
    subject('Orth&redaction', 'LC-ORTH', 10, 10),
  ]),
  domain('FRANCAIS', 2, [
    subject('Lect - Écrit en langues Françaises', 'FR-LECT', 20, 20),
    subject('Exp.orale-vocabulaire', 'FR-ORALVOC', 10, 10),
    subject('Orthographe', 'FR-ORTH', 10, 10),
    subject('Rédaction', 'FR-REDAC', 10, 10),
    subject('Gram.conj analyse', 'FR-GRAM', 20, 20),
  ]),
  domain('MATHEMATIQUES', 3, [
    subject('Numération', 'MATH-NUM', 10, 10),
    subject('Opération', 'MATH-OP', 10, 10),
    subject('Mesures de grandeurs', 'MATH-MES', 10, 10),
    subject('Formes géométriques', 'MATH-GEO', 10, 10),
    subject('Problèmes', 'MATH-PROB', 20, 20),
  ]),
  domain('SCIENCES', 4, [
    subject('Phy-zoolo-info', 'SCI-PHYZOO', 10, 10),
    subject('Anatomie-botanique', 'SCI-ANAT', 20, 20),
  ]),
  domain('TECHNOLOGIE', 5, [
    subject('Technologies', 'TECH', 10, 10),
  ]),
  domain("DOMAINE DE L'UNIVERS ET ENVIRONNEMENT", 6, [
    subject('Ed.civ&morale', 'ENV-CIV', 10, 10),
    subject('Ed.sante&env', 'ENV-SANTE', 10, 10),
    subject('Géographie', 'ENV-GEO', 10, 10),
    subject('Histoire', 'ENV-HIST', 10, 10),
  ], TOTAL_ROW),
  domain('DOMAINE DES ARTS', 7, [
    subject('Arts plastiques', 'ART-PLAS', 10, 10),
    subject('Arts dramatiques', 'ART-DRAM', 10, 10),
  ], TOTAL_ROW),
  domain('DOMAINE DU DEVELOPPMENT PERSONNEL', 8, [
    subject('Ed.phys&sports', 'DEV-EPS', 10, 10),
    subject('In.trav.prod', 'DEV-TRAV', 10, 10),
    subject('Religion', 'DEV-REL', 10, 10),
  ], TOTAL_ROW),
  domain('AUTRES LANGUES', 9, [
    subject('ENGLISH', 'EN', 30, 30),
    subject('KINYARWANDA', 'KIN', 20, 20),
  ], OTHER_LANG),
];

/** @deprecated Use PRIMARY_P1_P2_DOMAINS */
export const PRIMARY_BULLETIN_DOMAINS = PRIMARY_P1_P2_DOMAINS;

export function getPrimaryBulletinDomains(grade) {
  const g = String(grade || '').trim().toUpperCase();
  if (g === 'P3' || g === 'P4') return PRIMARY_P3_P4_DOMAINS;
  if (g === 'P5' || g === 'P6') return PRIMARY_P5_P6_DOMAINS;
  return PRIMARY_P1_P2_DOMAINS;
}

/** @deprecated Kept for reference; nursery now uses Excel competence templates. */
export const NURSERY_BULLETIN_DOMAINS = [];

function sumGrandTotal(domains, { excludeOther } = {}) {
  return domains.reduce((total, domainItem) => {
    if (excludeOther && domainItem.excludeFromGeneral) return total;
    return total + domainItem.subjects.reduce((n, s) => n + (s.totalMax || 0), 0);
  }, 0);
}

export function buildCurriculum(grade, label, domains, extra = {}) {
  return {
    grade,
    label,
    grandTotalMax: sumGrandTotal(domains),
    generalTotalMax: sumGrandTotal(domains, { excludeOther: true }),
    domains,
    ...extra,
  };
}

export const GRADE_LABELS = {
  M1: 'Petite Section (PS)/M1',
  M2: 'Moyenne Section/M2',
  M3: 'Grande Section/M3',
  TOP: 'Grande Section/M3 (Top class)',
  CRECHE: 'Crèche',
  N1: 'Petite Section (PS)/M1',
  N2: 'Moyenne Section/M2',
  N3: 'Grande Section/M3',
  P1: 'CP/P1',
  P2: 'CE1/P2',
  P3: 'CE2/P3',
  P4: 'CM1/P4',
  P5: 'CM2/P5',
  P6: '6ème année/P6',
};

const PRIMARY_GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
const NURSERY_GRADES = ['M1', 'M2', 'M3', 'TOP', 'N1', 'N2', 'N3'];

export function buildAllCurricula() {
  const curricula = {};

  for (const grade of PRIMARY_GRADES) {
    curricula[grade] = buildCurriculum(grade, GRADE_LABELS[grade], getPrimaryBulletinDomains(grade));
  }
  for (const grade of NURSERY_GRADES) {
    const domains = getNurseryCompetenceDomains(grade) || [];
    curricula[grade] = buildCurriculum(grade, GRADE_LABELS[grade], domains, {
      mode: 'COMPETENCE',
      grandTotalMax: 0,
      generalTotalMax: 0,
    });
  }

  return curricula;
}
