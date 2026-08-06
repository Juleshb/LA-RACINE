import { forwardRef } from 'react';
import { User } from 'lucide-react';

function fullStudentName(student) {
  return [student?.lastName, student?.postName, student?.firstName]
    .filter(Boolean)
    .join(' ')
    .toUpperCase() || '—';
}

function Fact({ label, value }) {
  return (
    <div className="id-card-fact">
      <span className="id-card-label">{label}</span>
      <span className="id-card-value">{value || '—'}</span>
    </div>
  );
}

/**
 * Printable student ID card (CR80 landscape) — approved students only.
 */
const StudentIdCard = forwardRef(function StudentIdCard({
  student,
  photoUrl,
  schoolName = 'École La RACINE',
  campusName = '',
  academicYear = '',
  id = 'student-id-card',
}, ref) {
  if (!student) return null;

  const className = student.class?.name || student.registrationClass || '—';
  const sex = student.gender === 'FEMALE' ? 'F' : student.gender === 'MALE' ? 'M' : '—';

  return (
    <div ref={ref} id={id} className="id-card id-card-student">
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
        <div className="id-card-kind">CARTE ÉLÈVE</div>
      </header>

      <div className="id-card-body">
        <div className="id-card-photo-wrap">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="id-card-photo" crossOrigin="anonymous" />
          ) : (
            <div className="id-card-photo id-card-photo-placeholder">
              <User size={30} color="#7dd3fc" strokeWidth={1.5} />
            </div>
          )}
          <div className="id-card-photo-accent" aria-hidden="true" />
        </div>

        <div className="id-card-fields">
          <div className="id-card-name">{fullStudentName(student)}</div>
          <div className="id-card-facts">
            <Fact label="Matricule" value={student.studentId} />
            <Fact label="Classe" value={className} />
            <Fact label="Année" value={academicYear || '—'} />
            <Fact label="Sexe" value={sex} />
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

export default StudentIdCard;
