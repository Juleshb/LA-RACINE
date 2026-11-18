/** Fee lines on the school tuition workings template. */
export const TUITION_FEE_LINES = [
  {
    id: 'dollar',
    feeType: 'OTHER',
    term: '',
    installments: 1,
    storedLabel: 'Paiement en Dollars',
    notes: 'Paiement en Dollars',
    currency: 'USD',
    labelKey: 'pageBody.tuition.dollar',
  },
  {
    id: 'inscription',
    feeType: 'REGISTRATION',
    term: '',
    installments: 1,
    storedLabel: 'Inscription',
    notes: '',
    labelKey: 'pageBody.tuition.inscription',
  },
  {
    id: 'confirmation',
    feeType: 'CONFIRMATION',
    term: '',
    installments: 1,
    storedLabel: 'Confirmation',
    notes: '',
    labelKey: 'pageBody.tuition.confirmation',
  },
  {
    id: 'carry',
    feeType: 'CARRY_OVER',
    term: 'PRIOR_YEAR',
    installments: 1,
    storedLabel: 'Balance of Third Trimester',
    notes: '',
    labelKey: 'pageBody.tuition.carryOver',
  },
  {
    id: 't1',
    feeType: 'TUITION',
    term: 'TRIMESTRE_1',
    installments: 2,
    storedLabel: 'First trimester',
    notes: '',
    labelKey: 'pageBody.tuition.firstTrimester',
  },
  {
    id: 't2',
    feeType: 'TUITION',
    term: 'TRIMESTRE_2',
    installments: 2,
    storedLabel: 'Second trimester',
    notes: '',
    labelKey: 'pageBody.tuition.secondTrimester',
  },
  {
    id: 't3',
    feeType: 'TUITION',
    term: 'TRIMESTRE_3',
    installments: 2,
    storedLabel: 'Third trimester',
    notes: '',
    labelKey: 'pageBody.tuition.thirdTrimester',
  },
];

export const OTHER_FEE_LINES = [
  { id: 'exam', feeType: 'EXAM', term: '', installments: 1, storedLabel: '', notes: '', labelKey: 'pageBody.fees.types.EXAM' },
  { id: 'transport', feeType: 'TRANSPORT', term: '', installments: 1, storedLabel: '', notes: '', labelKey: 'pageBody.fees.types.TRANSPORT' },
  { id: 'uniform', feeType: 'UNIFORM', term: '', installments: 1, storedLabel: '', notes: '', labelKey: 'pageBody.fees.types.UNIFORM' },
  { id: 'activities', feeType: 'EXTRACURRICULAR', term: '', installments: 1, storedLabel: '', notes: '', labelKey: 'pageBody.fees.types.EXTRACURRICULAR' },
  { id: 'other', feeType: 'OTHER', term: '', installments: 1, storedLabel: '', notes: '', labelKey: 'pageBody.fees.types.OTHER' },
];

export function tuitionFeeLine(id) {
  return [...TUITION_FEE_LINES, ...OTHER_FEE_LINES].find((line) => line.id === id) || TUITION_FEE_LINES[4];
}

export function structureFromLine(line) {
  return {
    lineId: line.id,
    feeType: line.feeType,
    term: line.term,
    installments: String(line.installments),
    label: line.storedLabel,
    currency: line.currency || 'RWF',
  };
}

export function matchTuitionFeeLine(fee) {
  if (!fee?.feeType) return null;
  const text = `${fee.notes || ''} ${fee.label || ''}`;
  if (fee.feeType === 'OTHER' && (fee.currency === 'USD' || /dollar|paiement en dollars/i.test(text))) {
    return TUITION_FEE_LINES.find((line) => line.id === 'dollar');
  }
  if (fee.feeType === 'REGISTRATION') return TUITION_FEE_LINES.find((line) => line.id === 'inscription');
  if (fee.feeType === 'CONFIRMATION') return TUITION_FEE_LINES.find((line) => line.id === 'confirmation');
  if (fee.feeType === 'CARRY_OVER' && (!fee.term || fee.term === 'PRIOR_YEAR')) {
    return TUITION_FEE_LINES.find((line) => line.id === 'carry');
  }
  if (fee.feeType === 'TUITION' && fee.term) {
    return TUITION_FEE_LINES.find((line) => line.term === fee.term) || null;
  }
  return null;
}

export function splitInstallmentAmount(total, count, index) {
  const n = Math.max(1, Math.min(12, Number(count) || 1));
  const amount = Number(total) || 0;
  const base = Math.floor(amount / n);
  const parts = Array.from({ length: n }, () => base);
  parts[n - 1] = amount - base * (n - 1);
  const slot = Math.min(n, Math.max(1, Number(index) || 1)) - 1;
  return parts[slot];
}
