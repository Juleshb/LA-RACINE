export const SCHOOL_YEARS = [
  '2019-2020', '2020-2021', '2021-2022', '2022-2023',
  '2023-2024', '2024-2025', '2025-2026',
];

export const CLASS_LEVELS = [
  { value: 'CRECHE', label: 'Crèche', labelFr: 'Crèche', labelEn: 'Crèche', labelRw: 'Crèche' },
  { value: 'N1', label: '1ère année Maternelle / Nursery 1', labelFr: '1ère année Maternelle', labelEn: 'Nursery 1', labelRw: 'N1' },
  { value: 'N2', label: '2ème année Maternelle / Nursery 2', labelFr: '2ème année Maternelle', labelEn: 'Nursery 2', labelRw: 'N2' },
  { value: 'N3', label: '3ème année Maternelle / Nursery 3', labelFr: '3ème année Maternelle', labelEn: 'Nursery 3', labelRw: 'N3' },
  { value: 'P1', label: '1ère année Primaire / Primary 1', labelFr: '1ère année Primaire', labelEn: 'Primary 1', labelRw: 'P1' },
  { value: 'P2', label: '2ème année Primaire / Primary 2', labelFr: '2ème année Primaire', labelEn: 'Primary 2', labelRw: 'P2' },
  { value: 'P3', label: '3ème année Primaire / Primary 3', labelFr: '3ème année Primaire', labelEn: 'Primary 3', labelRw: 'P3' },
  { value: 'P4', label: '4ème année Primaire / Primary 4', labelFr: '4ème année Primaire', labelEn: 'Primary 4', labelRw: 'P4' },
  { value: 'P5', label: '5ème année Primaire / Primary 5', labelFr: '5ème année Primaire', labelEn: 'Primary 5', labelRw: 'P5' },
  { value: 'P6', label: '6ème année Primaire / Primary 6', labelFr: '6ème année Primaire', labelEn: 'Primary 6', labelRw: 'P6' },
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
