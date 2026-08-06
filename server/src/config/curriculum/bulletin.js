import { getNurseryCompetenceDomains } from './nurseryTemplates.js';

function grading(test1Max, test2Max) {
  const examMax = test1Max + test2Max;
  return { test1Max, test2Max, examMax, totalMax: test1Max + test2Max + examMax };
}

function subject(name, code, test1Max, test2Max) {
  return { name, code, ...grading(test1Max, test2Max) };
}

/** Primary bulletin domains — from La Racine P1 report (used for P1–P6) */
export const PRIMARY_BULLETIN_DOMAINS = [
  {
    name: 'LANGUES CONGOLAISES',
    order: 1,
    subjects: [
      subject('Lect - Ecrit en langues congolaises', 'LC-LECT', 30, 30),
      subject('Expression orale', 'LC-ORAL', 20, 20),
      subject('Expression Ecrite', 'LC-ECRIT', 20, 20),
    ],
  },
  {
    name: 'FRANCAIS',
    order: 2,
    subjects: [
      subject('Vocabulaire', 'FR-VOC', 10, 10),
      subject('Exp. orale', 'FR-ORAL', 20, 20),
    ],
  },
  {
    name: 'MATHEMATIQUES',
    order: 3,
    subjects: [
      subject('Mesure de grandeurs', 'MATH-MES', 10, 10),
      subject('Formes géométriques', 'MATH-GEO', 10, 10),
      subject('Numération', 'MATH-NUM', 20, 20),
      subject('Opération', 'MATH-OP', 20, 20),
      subject('Problèmes', 'MATH-PROB', 20, 20),
    ],
  },
  {
    name: 'SCIENCES',
    order: 4,
    subjects: [
      subject("Science d'éveil", 'SCI-EVEIL', 20, 20),
    ],
  },
  {
    name: 'TECHNOLOGIE',
    order: 5,
    subjects: [
      subject('Technologie', 'TECH', 10, 10),
    ],
  },
  {
    name: "DOMAINE DE L'UNIVERS ET ENVIRONNEMENT",
    order: 6,
    subjects: [
      subject('Ed. civ & morale', 'ENV-CIV', 10, 10),
      subject('Ed. sante & env', 'ENV-SANTE', 10, 10),
    ],
  },
  {
    name: 'DOMAINE DES ARTS',
    order: 7,
    subjects: [
      subject('Arts plastiques', 'ART-PLAS', 10, 10),
      subject('Arts dramatiques', 'ART-DRAM', 10, 10),
    ],
  },
  {
    name: 'DOMAINE DU DEVELOPPMENT PERSONNEL',
    order: 8,
    subjects: [
      subject('Ed.phy & Sports', 'DEV-EPS', 10, 10),
      subject('In.trav.prod', 'DEV-TRAV', 10, 10),
      subject('Religion', 'DEV-REL', 10, 10),
    ],
  },
  {
    name: 'AUTRES LANGUES',
    order: 9,
    subjects: [
      subject('ENGLISH', 'EN', 30, 30),
      subject('KINYARWANDA', 'KIN', 20, 20),
    ],
  },
];

/** @deprecated Kept for reference; nursery now uses Excel competence templates. */
export const NURSERY_BULLETIN_DOMAINS = [];

function sumGrandTotal(domains) {
  return domains.reduce(
    (total, domain) => total + domain.subjects.reduce((n, s) => n + (s.totalMax || 0), 0),
    0,
  );
}

export function buildCurriculum(grade, label, domains, extra = {}) {
  return {
    grade,
    label,
    grandTotalMax: sumGrandTotal(domains),
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
// CRECHE intentionally omitted — no marks / bulletin curriculum

export function buildAllCurricula() {
  const curricula = {};

  for (const grade of PRIMARY_GRADES) {
    curricula[grade] = buildCurriculum(grade, GRADE_LABELS[grade], PRIMARY_BULLETIN_DOMAINS);
  }
  for (const grade of NURSERY_GRADES) {
    const domains = getNurseryCompetenceDomains(grade) || [];
    curricula[grade] = buildCurriculum(grade, GRADE_LABELS[grade], domains, {
      mode: 'COMPETENCE',
      grandTotalMax: 0,
    });
  }

  return curricula;
}
