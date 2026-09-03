import { forwardRef } from 'react';
import { User } from 'lucide-react';

const ROLE_FR = {
  SCHOOL_MANAGER: 'Directeur',
  SCHOOL_ADMIN: 'Administrateur',
  TEACHER: 'Enseignant',
  HEAD_OF_STUDIES: 'Préfet des études',
  HEAD_OF_DISCIPLINE: 'Préfet de discipline',
  SECRETARY: 'Secrétaire',
  ACCOUNTANT: 'Comptable',
  ACTIVITIES_MANAGER: 'Responsable des activités',
  LIBRARIAN: 'Bibliothécaire',
};

function Field({ label, value, strong }) {
  return (
    <div className="svc-field">
      <span className="svc-label">{label}&nbsp;:</span>
      <span className={`svc-value${strong ? ' is-strong' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function formatSex(staff) {
  const gender = String(staff?.gender || staff?.sex || '').toUpperCase();
  if (gender === 'MALE' || gender === 'M' || gender === 'MASCULIN') return 'Masculin';
  if (gender === 'FEMALE' || gender === 'F' || gender === 'FEMININ' || gender === 'FÉMININ') return 'Féminin';
  return '—';
}

function formatIdentity(staff) {
  return staff?.identityNumber || staff?.nationalId || staff?.idNumber || '—';
}

function frenchRole(staff, roleLabel) {
  if (staff?.role && ROLE_FR[staff.role]) return ROLE_FR[staff.role];
  if (roleLabel && ROLE_FR[roleLabel]) return ROLE_FR[roleLabel];
  if (/secretary/i.test(roleLabel || '')) return 'Secrétaire';
  if (/teacher|enseignant/i.test(roleLabel || '')) return 'Enseignant';
  return roleLabel || 'Personnel';
}

function ServiceCardBg() {
  return (
    <svg className="svc-bg" viewBox="0 0 406 256" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <rect
          key={i}
          x={-50 + i * 38}
          y={-30}
          width={12}
          height={320}
          fill="#dbe7f0"
          opacity="0.45"
          transform="skewX(-32)"
        />
      ))}
      <polygon fill="#c8e6f8" points="198,256 248,256 348,0 298,0" />
      <polygon fill="#5eb6ea" points="228,256 282,256 382,0 328,0" />
      <polygon fill="#0078d4" points="262,256 318,256 418,0 362,0" />
      <polygon fill="#151515" points="300,256 406,256 406,0 400,0 348,0" />
    </svg>
  );
}

const StaffIdCard = forwardRef(function StaffIdCard({
  staff,
  photoUrl,
  schoolName = 'LA RACINE',
  academicYear = '',
  roleLabel = 'Personnel',
  id = 'staff-id-card',
}, ref) {
  if (!staff) return null;

  const name = String(staff.name || `${staff.firstName || ''} ${staff.lastName || ''}`)
    .trim()
    .toUpperCase() || '—';
  const school = String(schoolName || 'LA RACINE').replace(/^École\s+/i, '').trim() || 'LA RACINE';
  const poste = frenchRole(staff, roleLabel);

  return (
    <div ref={ref} id={id} className="id-card id-card-staff svc-card">
      <ServiceCardBg />

      <div className="svc-banner">CARTE DE SERVICE</div>
      <div className="svc-rule" />
      <p className="svc-motto">DISCIPLINE - INTELLIGENCE - INNOVATION</p>
      <img src="/logo.png" alt="" className="svc-logo" crossOrigin="anonymous" />

      <div className="svc-fields">
        <Field label="Nom" value={name} strong />
        <Field label="PP/ Numéro d’identité" value={formatIdentity(staff)} />
        <Field label="Sexe" value={formatSex(staff)} />
        <Field label="Poste" value={poste} />
        <Field label="École" value={school} />
        <Field label="Validité" value={academicYear ? `Année ${academicYear}` : 'Fin de contrat'} />
        <Field label="N° Tél" value={staff.phone || '—'} />
      </div>

      <img src="/bulletin/sceau-directeur.png" alt="" className="svc-seal" crossOrigin="anonymous" />

      <div className="svc-photo-wrap">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="id-card-photo svc-photo" crossOrigin="anonymous" />
        ) : (
          <div className="id-card-photo svc-photo svc-photo-placeholder">
            <User size={34} color="#94a3b8" strokeWidth={1.4} />
          </div>
        )}
        <span className="svc-photo-accent" aria-hidden="true" />
      </div>

      <div className="svc-sign-box">
        <img src="/bulletin/signature-directeur.png" alt="" className="svc-sign" crossOrigin="anonymous" />
      </div>

      <span className="id-card-school" hidden>{schoolName}</span>
    </div>
  );
});

export default StaffIdCard;
