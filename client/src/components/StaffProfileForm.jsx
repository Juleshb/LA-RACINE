import { Camera, FileText, GraduationCap, Landmark, Shield, User, X } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { MAX_FILE_SIZE_MB } from '../config/registration';

export const CONTRACT_TYPES = [
  { value: 'TRIAL', en: 'Trial', fr: "D'essai" },
  { value: 'FIXED', en: 'Fixed term', fr: 'Déterminé' },
  { value: 'OPEN', en: 'Open-ended', fr: 'Indéterminé' },
  { value: 'PERMANENT', en: 'Permanent', fr: 'Permanent' },
  { value: 'LIFETIME', en: 'For life', fr: 'À vie' },
];

export const QUALIFICATIONS = [
  'Primary Leaving Certificate',
  'Ordinary Level Certificate (O-Level)',
  'Advanced Level Certificate (A-Level / A2)',
  'TVET Certificate I–V',
  'Diploma / Advanced Diploma',
  "Bachelor's Degree",
  "Master's Degree",
  'PhD / Doctorate',
  "Certificat de fin d'études primaires (ENAFEP)",
  "Certificat de fin d'éducation de base (TENASOSP)",
  "Diplôme d'État (EXETAT) à la fin du cycle",
  'Graduat / Licence selon le système et le programme',
  'Licence',
  'DEA / DES / Master',
  'Doctorat / PhD',
];

export const RWANDA_BANKS = [
  'AB Bank Rwanda',
  'Access Bank Rwanda',
  'Bank of Africa Rwanda',
  'Bank of Kigali',
  'BPR Bank Rwanda',
  'Development Bank of Rwanda (BRD)',
  'Ecobank Rwanda',
  'Equity Bank Rwanda',
  'GTBank Rwanda',
  'I&M Bank Rwanda',
  'LOLC UNGUKA Finance',
  'NCBA Bank Rwanda',
  'Urwego Bank',
  'Zigama CSS',
];

const COPY = {
  en: {
    identity: 'Identity and photo',
    identityHint: 'Personal details of the staff member',
    addPhoto: 'Add a photo',
    changePhoto: 'Change photo',
    removePhoto: 'Remove',
    photoTypes: 'JPG, PNG or WEBP',
    lastName: 'Last name',
    postName: 'Middle name',
    firstName: 'First name',
    phone: 'Phone number',
    email: 'Email',
    identityNumber: 'ID / CEPGL / Passport',
    identityPlaceholder: 'Document number',
    gender: 'Gender',
    select: 'Select...',
    male: 'Male',
    female: 'Female',
    bank: 'Bank details',
    bankHint: 'Bank details for this staff member',
    bankAccount: 'Bank account number',
    bankName: 'Bank',
    bankPlaceholder: 'Bank name',
    job: 'Contract and employment',
    jobHint: 'Employment on the campus that is open',
    contract: 'Contract type',
    hireDate: 'Hire date',
    subject: 'Main subject',
    address: 'Address',
    study: 'Qualifications and experience',
    studyHint: 'Academic and professional background',
    qualification: 'Qualifications',
    qualificationPlaceholder: 'Select a qualification...',
    experience: 'Professional experience',
    experiencePlaceholder: 'Describe the roles, schools, dates, and responsibilities...',
    access: 'System access',
    accessHint: 'Account settings',
    role: 'Role',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
    note: 'The account is created for the campus that is open. Its permissions come from the assigned role.',
  },
  fr: {
    identity: 'Identité et photo',
    identityHint: 'Informations personnelles du membre du personnel',
    addPhoto: 'Ajouter une photo',
    changePhoto: 'Changer la photo',
    removePhoto: 'Retirer',
    photoTypes: 'JPG, PNG ou WEBP',
    lastName: 'Nom',
    postName: 'Post-nom',
    firstName: 'Prénom',
    phone: 'Numéro de téléphone',
    email: 'Email',
    identityNumber: 'Nº ID / C.E.P.G.L / Passeport',
    identityPlaceholder: 'Numéro du document',
    gender: 'Sexe',
    select: 'Sélectionner...',
    male: 'Masculin',
    female: 'Féminin',
    bank: 'Informations bancaires',
    bankHint: 'Coordonnées bancaires du personnel',
    bankAccount: 'Nº Compte bancaire',
    bankName: 'Banque',
    bankPlaceholder: 'Nom de la banque',
    job: 'Contrat et emploi',
    jobHint: 'Situation professionnelle au sein du campus actif',
    contract: 'Type de contrat',
    hireDate: "Date d'embauche",
    subject: 'Matière principale',
    address: 'Adresse',
    study: 'Qualifications et expériences',
    studyHint: 'Parcours académique et professionnel',
    qualification: 'Qualifications',
    qualificationPlaceholder: 'Sélectionner une qualification...',
    experience: 'Expériences professionnelles',
    experiencePlaceholder: 'Décrivez les expériences professionnelles, fonctions, établissements, périodes et responsabilités...',
    access: 'Accès au système',
    accessHint: 'Paramètres du compte',
    role: 'Rôle',
    status: 'Statut',
    active: 'Actif',
    inactive: 'Inactif',
    suspended: 'Suspendu',
    note: 'Le compte est créé pour le campus actuellement actif. Les permissions du compte sont héritées automatiquement du rôle attribué.',
  },
};

function text(language, key) {
  const pack = language === 'fr' ? COPY.fr : COPY.en;
  return pack[key];
}

function Section({ icon: Icon, title, hint, children }) {
  return (
    <section className="staff-dossier">
      <div className="staff-dossier-title">
        <span><Icon className="w-4 h-4" aria-hidden /></span>
        <div>
          <strong>{title}</strong>
          <small>{hint}</small>
        </div>
      </div>
      {children}
    </section>
  );
}

export function hireDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export function splitPersonName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { lastName: parts[0] || '', postName: '', firstName: '' };
  if (parts.length === 2) return { lastName: parts[0], postName: '', firstName: parts[1] };
  return {
    lastName: parts[0],
    postName: parts.slice(1, -1).join(' '),
    firstName: parts[parts.length - 1],
  };
}

export default function StaffProfileForm({
  form,
  onChange,
  photoPreview,
  onPhotoPick,
  onPhotoClear,
  fileRef,
  phoneRequired = false,
  emailReadOnly = false,
  showSubject = false,
  showAddress = false,
  showGender = true,
  access = null,
  showStatus = false,
  showNote = false,
}) {
  const { language } = useTranslation();
  const label = (key) => text(language, key);
  const set = (key) => (event) => onChange({ [key]: event.target.value });
  const initials = `${(form.lastName?.[0] || '').toUpperCase()}${(form.firstName?.[0] || '').toUpperCase()}`;

  return (
    <div className="staff-dossier-stack">
      <Section icon={User} title={label('identity')} hint={label('identityHint')}>
        <div className="staff-dossier-identity">
          <div className="staff-photo-box">
            <div className="staff-photo-preview">
              {photoPreview ? <img src={photoPreview} alt="" /> : (initials || <Camera className="w-8 h-8" />)}
            </div>
            <button type="button" className="staff-photo-btn" onClick={() => fileRef.current?.click()}>
              {photoPreview ? label('changePhoto') : label('addPhoto')}
            </button>
            {photoPreview && (
              <button type="button" className="staff-photo-remove" onClick={onPhotoClear}>
                <X className="w-3.5 h-3.5" />
                {label('removePhoto')}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onPhotoPick}
            />
            <small>{label('photoTypes')} · {MAX_FILE_SIZE_MB} MB</small>
          </div>
          <div className="staff-dossier-grid">
            <label className="label">{label('lastName')} *
              <input className="input" required value={form.lastName || ''} onChange={set('lastName')} placeholder={label('lastName')} />
            </label>
            <label className="label">{label('postName')}
              <input className="input" value={form.postName || ''} onChange={set('postName')} placeholder={label('postName')} />
            </label>
            <label className="label">{label('firstName')}
              <input className="input" value={form.firstName || ''} onChange={set('firstName')} placeholder={label('firstName')} />
            </label>
            <label className="label">{label('phone')}{phoneRequired ? ' *' : ''}
              <input className="input" type="tel" required={phoneRequired} minLength={phoneRequired ? 8 : undefined} value={form.phone || ''} onChange={set('phone')} placeholder="+250 7XX XXX XXX" />
            </label>
            <label className="label">{label('email')} *
              <input className="input" type="email" required={!emailReadOnly} readOnly={emailReadOnly} value={form.email || ''} onChange={set('email')} placeholder="nom@laracine.rw" />
            </label>
            <label className="label">{label('identityNumber')}
              <input className="input font-mono" value={form.identityNumber || ''} onChange={set('identityNumber')} placeholder={label('identityPlaceholder')} />
            </label>
            {showGender && (
              <label className="label">{label('gender')}
                <select className="input" value={form.gender || ''} onChange={set('gender')}>
                  <option value="">{label('select')}</option>
                  <option value="MALE">{label('male')}</option>
                  <option value="FEMALE">{label('female')}</option>
                </select>
              </label>
            )}
          </div>
        </div>
      </Section>

      <Section icon={Landmark} title={label('bank')} hint={label('bankHint')}>
        <div className="staff-dossier-grid">
          <label className="label">{label('bankAccount')}
            <input className="input font-mono" value={form.bankAccount || ''} onChange={set('bankAccount')} placeholder={label('bankAccount')} />
          </label>
          <label className="label">{label('bankName')}
            <select className="input" value={form.bankName || ''} onChange={set('bankName')}>
              <option value="">{label('select')}</option>
              {form.bankName && !RWANDA_BANKS.includes(form.bankName) && (
                <option value={form.bankName}>{form.bankName}</option>
              )}
              {RWANDA_BANKS.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Section icon={FileText} title={label('job')} hint={label('jobHint')}>
        <div className="staff-dossier-grid">
          <label className="label">{label('contract')} *
            <select className="input" required value={form.contractType || ''} onChange={set('contractType')}>
              <option value="">{label('select')}</option>
              {CONTRACT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>{language === 'fr' ? item.fr : item.en}</option>
              ))}
            </select>
          </label>
          <label className="label">{label('hireDate')}
            <input className="input" type="date" value={form.hireDate || ''} onChange={set('hireDate')} />
          </label>
          {showSubject && (
            <label className="label">{label('subject')}
              <input className="input" value={form.subject || ''} onChange={set('subject')} />
            </label>
          )}
          {showAddress && (
            <label className="label staff-span">{label('address')}
              <textarea className="input min-h-[72px]" rows={2} value={form.address || ''} onChange={set('address')} />
            </label>
          )}
        </div>
      </Section>

      <Section icon={GraduationCap} title={label('study')} hint={label('studyHint')}>
        <div className="staff-dossier-grid">
          <label className="label staff-span">{label('qualification')}
            <select className="input" value={form.qualification || ''} onChange={set('qualification')}>
              <option value="">{label('qualificationPlaceholder')}</option>
              {form.qualification && !QUALIFICATIONS.includes(form.qualification) && (
                <option value={form.qualification}>{form.qualification}</option>
              )}
              {QUALIFICATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="label staff-span">{label('experience')}
            <textarea className="input min-h-[120px]" rows={5} value={form.professionalExperience || ''} onChange={set('professionalExperience')} placeholder={label('experiencePlaceholder')} />
          </label>
        </div>
      </Section>

      {(access || showStatus) && (
        <Section icon={Shield} title={label('access')} hint={label('accessHint')}>
          <div className="staff-dossier-grid">
            {access}
            {showStatus && (
              <label className="label">{label('status')}
                <select className="input" value={form.accountStatus || 'ACTIVE'} onChange={set('accountStatus')}>
                  <option value="ACTIVE">{label('active')}</option>
                  <option value="INACTIVE">{label('inactive')}</option>
                  <option value="SUSPENDED">{label('suspended')}</option>
                </select>
              </label>
            )}
          </div>
        </Section>
      )}

      {showNote && <p className="staff-dossier-note">{label('note')}</p>}
    </div>
  );
}
