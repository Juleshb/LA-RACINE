export const BULLETIN_PRESETS = {
  STANDARD: {
    preset: 'STANDARD',
    label: 'Rwanda bulletin — TEST1 + TEST2 + EX',
    labelFr: 'Bulletin standard — TEST1 + TEST2 + EX',
    assessments: [
      { key: 'TEST1', label: 'TEST 1', maxField: 'test1Max', fallbackMax: 10 },
      { key: 'TEST2', label: 'TEST 2', maxField: 'test2Max', fallbackMax: 10 },
      { key: 'EX', label: 'EX', maxField: 'examMax', fallbackMax: 20 },
    ],
  },
  TESTS_EXAM: {
    preset: 'TESTS_EXAM',
    label: 'Tests + Exam — TEST1 + EX',
    labelFr: 'Interrogations + Examen',
    assessments: [
      { key: 'TEST1', label: 'TEST 1', maxField: 'test1Max', fallbackMax: 20 },
      { key: 'EX', label: 'EX', maxField: 'examMax', fallbackMax: 40 },
    ],
  },
  SIMPLE: {
    preset: 'SIMPLE',
    label: 'Single mark per trimestre',
    labelFr: 'Une note par trimestre',
    assessments: [
      { key: 'SCORE', label: 'Note', maxField: 'totalMax', fallbackMax: 100 },
    ],
  },
  NURSERY: {
    preset: 'NURSERY',
    label: 'Nursery competence — A / B / C / D',
    labelFr: 'Maternelle — acquis A / B / C / D',
    mode: 'COMPETENCE',
    assessments: [],
  },
  COMPETENCE: {
    preset: 'COMPETENCE',
    label: 'Competence grades — A / B / C / D',
    labelFr: 'Notes de compétence — A / B / C / D',
    mode: 'COMPETENCE',
    assessments: [],
  },
};

export const DEFAULT_TERMS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];

export function listBulletinPresets() {
  return Object.values(BULLETIN_PRESETS).map((p) => ({
    preset: p.preset,
    label: p.label,
    labelFr: p.labelFr,
    assessmentCount: p.assessments.length,
    assessmentKeys: p.assessments.map((a) => a.key),
  }));
}

export function resolveBulletinConfig(stored, grade) {
  if (stored?.preset === 'CUSTOM' && Array.isArray(stored.assessments) && stored.assessments.length) {
    return {
      preset: 'CUSTOM',
      label: stored.label || 'Custom bulletin',
      assessments: stored.assessments,
      terms: stored.terms || DEFAULT_TERMS,
    };
  }
  if (stored?.preset && BULLETIN_PRESETS[stored.preset]) {
    const base = stored.preset === 'NURSERY' ? BULLETIN_PRESETS.COMPETENCE : BULLETIN_PRESETS[stored.preset];
    return { ...base, terms: stored.terms || DEFAULT_TERMS };
  }
  const nurseryGrades = ['M1', 'M2', 'M3', 'TOP', 'CRECHE', 'N1', 'N2', 'N3'];
  const preset = nurseryGrades.includes(grade) ? BULLETIN_PRESETS.COMPETENCE : BULLETIN_PRESETS.STANDARD;
  return { ...preset, terms: DEFAULT_TERMS };
}

export function getMaxForAssessment(subject, assessment) {
  if (!subject) return assessment.fallbackMax || 100;
  if (assessment.maxField === 'custom' && assessment.customMax) return assessment.customMax;
  const fromSubject = assessment.maxField ? subject[assessment.maxField] : null;
  if (fromSubject != null && fromSubject > 0) return fromSubject;
  return assessment.fallbackMax || 100;
}

export function subjectUsesBulletinScale(subject) {
  return Boolean(subject?.totalMax || subject?.test1Max);
}
