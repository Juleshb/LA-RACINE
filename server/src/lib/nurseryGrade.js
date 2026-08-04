/** Letter grades for nursery competence bulletins (Excel A/B/C/D scale). */

export const NURSERY_LETTER_GRADES = ['A', 'B', 'C', 'D'];

export const NURSERY_GRADE_LABELS = {
  A: 'Très bon travail',
  B: 'Bon travail',
  C: 'Moyen',
  D: 'Doit fournir des efforts',
};

export const NURSERY_TERMS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3', 'Annuel'];

/** Terms selectable on the nursery bulletin page (Annuel = full-year combined sheet). */
export const NURSERY_BULLETIN_TERMS = [
  { value: 'Trimestre 1', label: '1er Trimestre', viewMode: 'TERM', gradeKey: 't1' },
  { value: 'Trimestre 2', label: '2ème Trimestre', viewMode: 'TERM', gradeKey: 't2' },
  { value: 'Trimestre 3', label: '3ème Trimestre', viewMode: 'TERM', gradeKey: 't3' },
  {
    value: 'Annuel',
    label: 'Bulletin annuel (année complète)',
    viewMode: 'FULL_YEAR',
    gradeKey: null,
  },
];

export const NURSERY_TERM_COLUMNS = {
  'Trimestre 1': 't1',
  'Trimestre 2': 't2',
  'Trimestre 3': 't3',
  Annuel: 'annual',
};

export const NURSERY_FULL_YEAR_COLUMNS = [
  { key: 't1', label: '1er Trimestre', term: 'Trimestre 1' },
  { key: 't2', label: '2ème Trimestre', term: 'Trimestre 2' },
  { key: 't3', label: '3ème Trimestre', term: 'Trimestre 3' },
  { key: 'annual', label: 'Résultat Annuel', term: 'Annuel' },
];

export function resolveNurseryBulletinView(term) {
  const found = NURSERY_BULLETIN_TERMS.find((t) => t.value === term);
  if (found) return found;
  return NURSERY_BULLETIN_TERMS[0];
}

export const NURSERY_ASSESSMENT = 'GRADE';
export const NURSERY_MAX_SCORE = 4;

const LETTER_TO_SCORE = { A: 4, B: 3, C: 2, D: 1 };
const SCORE_TO_LETTER = { 4: 'A', 3: 'B', 2: 'C', 1: 'D' };

export function letterToScore(letter) {
  if (letter == null || letter === '') return null;
  const key = String(letter).trim().toUpperCase();
  return LETTER_TO_SCORE[key] ?? null;
}

export function scoreToLetter(score) {
  if (score == null || Number.isNaN(Number(score))) return null;
  return SCORE_TO_LETTER[Math.round(Number(score))] || null;
}

export function normalizeNurseryLetter(value) {
  if (value == null || value === '') return null;
  const key = String(value).trim().toUpperCase();
  return NURSERY_LETTER_GRADES.includes(key) ? key : null;
}
