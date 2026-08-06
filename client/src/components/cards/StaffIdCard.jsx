import { forwardRef } from 'react';
import { User } from 'lucide-react';

function Fact({ label, value }) {
  return (
    <div className="id-card-fact">
      <span className="id-card-label">{label}</span>
      <span className="id-card-value">{value || '—'}</span>
    </div>
  );
}

/**
 * Printable staff / teacher ID card (CR80 landscape).
 */
const StaffIdCard = forwardRef(function StaffIdCard({
  staff,
  photoUrl,
  schoolName = 'École La RACINE',
  campusName = '',
  academicYear = '',
  roleLabel = 'ENSEIGNANT',
  id = 'staff-id-card',
}, ref) {
  if (!staff) return null;

  const name = String(staff.name || `${staff.firstName || ''} ${staff.lastName || ''}`)
    .trim()
    .toUpperCase() || '—';

  return (
    <div ref={ref} id={id} className="id-card id-card-staff">
      <div className="id-card-glow" aria-hidden="true" />
      <div className="id-card-mark" aria-hidden="true">
        <img src="/logo.png" alt="" crossOrigin="anonymous" />
      </div>

      <header className="id-card-top">
        <div className="id-card-brand">
          <img src="/logo.png" alt="" className="id-card-logo" crossOrigin="anonymous" />
          <div className="id-card-header-text">
            <div className="id-card-school">{schoolName}</div>
            <div className="id-card-campus">
              {[campusName, academicYear].filter(Boolean).join(' · ') || 'Rwanda'}
            </div>
          </div>
        </div>
        <div className="id-card-kind">PERSONNEL</div>
      </header>

      <div className="id-card-body">
        <div className="id-card-photo-wrap">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="id-card-photo id-card-photo-staff" crossOrigin="anonymous" />
          ) : (
            <div className="id-card-photo id-card-photo-placeholder id-card-photo-staff">
              <User size={30} color="#a3e635" strokeWidth={1.5} />
            </div>
          )}
          <div className="id-card-photo-accent" aria-hidden="true" />
        </div>

        <div className="id-card-fields">
          <div className="id-card-name">{name}</div>
          <div className="id-card-facts">
            <Fact label="Fonction" value={roleLabel} />
            <Fact label="Matière" value={staff.subject || '—'} />
            <Fact label="Tél" value={staff.phone || '—'} />
            <Fact label="Année" value={academicYear || '—'} />
          </div>
        </div>
      </div>

      <footer className="id-card-footer">
        <span className="id-card-motto">Discipline · Intelligence · Innovation</span>
        <div className="id-card-auth" aria-hidden="true">
          <img
            src="/bulletin/signature-directeur.png"
            alt=""
            className="id-card-mini-signature"
            crossOrigin="anonymous"
          />
          <img
            src="/bulletin/sceau-directeur.png"
            alt=""
            className="id-card-mini-seal"
            crossOrigin="anonymous"
          />
        </div>
      </footer>
    </div>
  );
});

export default StaffIdCard;
