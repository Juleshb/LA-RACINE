export const SCHOOL_YEARS = [
  '2019-2020', '2020-2021', '2021-2022', '2022-2023',
  '2023-2024', '2024-2025', '2025-2026',
];

export const CLASS_LEVELS = [
  { value: 'M1', label: 'Petite Section (PS)/M1', labelFr: 'Petite Section (PS)/M1', labelEn: 'Petite Section (PS)/M1', labelRw: 'M1' },
  { value: 'M2', label: 'Moyenne Section/M2', labelFr: 'Moyenne Section/M2', labelEn: 'Moyenne Section/M2', labelRw: 'M2' },
  { value: 'M3', label: 'Grande Section/M3', labelFr: 'Grande Section/M3', labelEn: 'Grande Section/M3', labelRw: 'M3' },
  { value: 'TOP', label: 'Grande Section/M3 (Top class)', labelFr: 'Grande Section/M3 (Top class)', labelEn: 'Top class', labelRw: 'Top' },
  { value: 'P1', label: 'CP/P1', labelFr: 'CP/P1', labelEn: 'CP/P1', labelRw: 'P1' },
  { value: 'P2', label: 'CE1/P2', labelFr: 'CE1/P2', labelEn: 'CE1/P2', labelRw: 'P2' },
  { value: 'P3', label: 'CE2/P3', labelFr: 'CE2/P3', labelEn: 'CE2/P3', labelRw: 'P3' },
  { value: 'P4', label: 'CM1/P4', labelFr: 'CM1/P4', labelEn: 'CM1/P4', labelRw: 'P4' },
  { value: 'P5', label: 'CM2/P5', labelFr: 'CM2/P5', labelEn: 'CM2/P5', labelRw: 'P5' },
  { value: 'P6', label: '6ème année/P6', labelFr: '6ème année/P6', labelEn: 'Primary 6', labelRw: 'P6' },
];

export const BUS_STOPS = [
  { value: 'MBUGANGARI', label: 'Mbugangari' },
  { value: 'MAKORO', label: 'Makoro' },
  { value: 'CENTRE_VILLE', label: 'Centre ville' },
  { value: 'MAJENGO', label: 'Majengo' },
  { value: 'RUGERERO', label: 'Rugerero' },
  { value: 'BYAHI', label: 'Byahi' },
  { value: 'RCD', label: 'RCD' },
  { value: 'PETITE_BARRIERE', label: 'Petite barriere' },
];

export const TRANSPORT_MODES = [
  { value: 'PRIVATE', label: 'Transport privée / Private transport' },
  { value: 'SCHOOL', label: "Transport de l'école / School transport" },
  { value: 'NONE', label: 'Pas de transport / No transport' },
];

export const PAYMENT_METHODS = [
  { value: 'MOMO_PAY', label: 'MoMo Pay / *182*8*1*011923# / CM LA RACINE Ltd' },
  { value: 'BORDEREAU', label: 'Bordereau' },
];

export const TREATMENT_OPTIONS = [
  { value: 'ON_TREATMENT', label: 'Traitement / On treatment / Ari kuvuzwa' },
  { value: 'NO_TREATMENT', label: 'Pas de traitement / No treatment / Ntago ari kuvuzwa' },
  { value: 'NO_ILLNESS', label: 'Pas de maladie / No illness' },
];

export const DOCUMENT_TYPES = [
  { value: 'BIRTH_CERTIFICATE', label: 'Acte de naissance / Birth certificate' },
  { value: 'PHOTO', label: 'Photo' },
  { value: 'REPORT_CARD', label: 'Bulletin / Report card' },
  { value: 'MEDICAL_CERTIFICATE', label: 'Certificat médical / Medical certificate' },
  { value: 'OTHER', label: 'Autre / Other' },
];

export const YES_NO_OPTIONS = [
  { value: true, label: 'Oui / Yes / Yego' },
  { value: false, label: 'Non / No / Oya' },
];

export function getFormOptions() {
  return {
    schoolYears: SCHOOL_YEARS,
    classLevels: CLASS_LEVELS,
    busStops: BUS_STOPS,
    transportModes: TRANSPORT_MODES,
    paymentMethods: PAYMENT_METHODS,
    treatmentOptions: TREATMENT_OPTIONS,
    documentTypes: DOCUMENT_TYPES,
    yesNoOptions: YES_NO_OPTIONS,
  };
}
