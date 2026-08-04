export const SCHOOL_YEARS = [
  '2019-2020', '2020-2021', '2021-2022', '2022-2023',
  '2023-2024', '2024-2025', '2025-2026',
];

export const CLASS_LEVELS = [
  { value: 'M1', label: 'Petite Section (PS)/M1' },
  { value: 'M2', label: 'Moyenne Section/M2' },
  { value: 'M3', label: 'Grande Section/M3' },
  { value: 'TOP', label: 'Grande Section/M3 (Top class)' },
  { value: 'P1', label: 'CP/P1' },
  { value: 'P2', label: 'CE1/P2' },
  { value: 'P3', label: 'CE2/P3' },
  { value: 'P4', label: 'CM1/P4' },
  { value: 'P5', label: 'CM2/P5' },
  { value: 'P6', label: '6ème année/P6' },
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
  { value: 'ON_TREATMENT', label: 'Traitement / On treatment' },
  { value: 'NO_TREATMENT', label: 'Pas de traitement / No treatment' },
  { value: 'NO_ILLNESS', label: 'Pas de maladie / No illness' },
];

export const DOCUMENT_TYPES = [
  { value: 'BIRTH_CERTIFICATE', label: 'Acte de naissance / Birth certificate', required: true },
  { value: 'PHOTO', label: 'Photo', required: true },
  { value: 'REPORT_CARD', label: 'Bulletin / Report card', required: false },
  { value: 'MEDICAL_CERTIFICATE', label: 'Certificat médical', required: false },
  { value: 'OTHER', label: 'Autre / Other', required: false },
];

export const DOCUMENT_FILE_LABELS = {
  BIRTH_CERTIFICATE: 'BIRTH CERTIFICATE',
  PHOTO: 'PHOTO',
  REPORT_CARD: 'REPORT CARD',
  MEDICAL_CERTIFICATE: 'MEDICAL CERTIFICATE',
  OTHER: 'OTHER',
};

export function formatAttachmentName(docType, studentCode, originalFileName = '') {
  const label = DOCUMENT_FILE_LABELS[docType] || docType.replace(/_/g, ' ');
  const ext = originalFileName.match(/\.[^.]+$/)?.[0] || '';
  return studentCode ? `${label} ${studentCode}${ext}` : `${label}${ext}`;
}

export const MAX_FILE_SIZE_MB = 5;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const FORM_SECTIONS = [
  { id: 1, title: "Coordonnées de l'enfant", subtitle: 'Child Details / Imyirondoro y\'umwana' },
  { id: 2, title: 'Représentants légaux', subtitle: 'Legal Representatives / Ababyeyi' },
  { id: 3, title: 'École de provenance', subtitle: 'School of Provenance' },
  { id: 4, title: "Inscription à La Racine", subtitle: 'Registration at École La RACINE' },
  { id: 5, title: "Maladies de l'enfant", subtitle: 'Child Illnesses / Indwara z\'umwana' },
  { id: 6, title: "Date d'enregistrement", subtitle: 'Date of Registration' },
  { id: 7, title: 'Transport', subtitle: 'Transport Information' },
  { id: 8, title: 'Mode de paiement', subtitle: 'Payment Method' },
  { id: 9, title: 'Pièces jointes', subtitle: 'Attachments / Inyandiko' },
];

export const EMPTY_FORM = {
  lastName: '',
  postName: '',
  firstName: '',
  gender: 'MALE',
  dateOfBirth: '',
  nationality: 'Rwandaise',
  fatherName: '',
  fatherProfession: '',
  fatherPhone: '',
  fatherEmail: '',
  motherName: '',
  motherProfession: '',
  motherPhone: '',
  motherEmail: '',
  province: 'WEST',
  district: '',
  sector: '',
  cell: '',
  village: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  previousAcademicYearId: '',
  previousClassId: '',
  previousSchoolName: '',
  previousSchoolYear: '',
  previousClass: '',
  academicYearId: '',
  classId: '',
  registrationYear: '',
  registrationClass: '',
  surgicalHistory: null,
  heartMurmur: null,
  medicinalAllergies: null,
  generalAllergies: '',
  tuberculosis: null,
  treatment: 'NO_ILLNESS',
  foodIntolerance: null,
  diabetes: null,
  asthma: null,
  visualDisturbances: null,
  registrationDate: new Date().toISOString().split('T')[0],
  transportMode: 'NONE',
  busStop: '',
  paymentMethod: '',
  documents: [],
};

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
