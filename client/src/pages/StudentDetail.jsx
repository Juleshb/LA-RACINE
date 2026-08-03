import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, User } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import { useAuth } from '../context/AuthContext';
import AdminFamilyAccounts from '../components/AdminFamilyAccounts';
import { BUS_STOPS, TRANSPORT_MODES, PAYMENT_METHODS } from '../config/registration';

const STATUS_BADGE = {
  PENDING: { icon: Clock, className: 'bg-amber-50 text-amber-700', label: 'En attente' },
  APPROVED: { icon: CheckCircle, className: 'bg-green-50 text-green-700', label: 'Approuvé' },
  REJECTED: { icon: XCircle, className: 'bg-red-50 text-red-600', label: 'Rejeté' },
};

const PROVINCE_LABELS = {
  KIGALI: 'Kigali',
  SOUTH: 'Southern',
  WEST: 'Western',
  NORTH: 'Northern',
  EAST: 'Eastern',
};

function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label || value || '—';
}

function getDocumentDisplayName(doc, studentCode) {
  if (doc.fileName?.includes(studentCode)) return doc.fileName;

  const labels = {
    BIRTH_CERTIFICATE: 'BIRTH CERTIFICATE',
    PHOTO: 'PHOTO',
    REPORT_CARD: 'REPORT CARD',
    MEDICAL_CERTIFICATE: 'MEDICAL CERTIFICATE',
    OTHER: 'OTHER',
  };
  const label = labels[doc.docType] || doc.docType.replace(/_/g, ' ');
  const ext = doc.fileName?.match(/\.[^.]+$/)?.[0] || '';
  return `${label} ${studentCode}${ext}`;
}

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campusId } = useCampus();
  const { user } = useAuth();
  const canManage = !['TEACHER', 'PARENT', 'STUDENT'].includes(user?.role);
  const canProvisionAccounts = ['SCHOOL_MANAGER', 'SECRETARY'].includes(user?.role);
  const [student, setStudent] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [parentAccountNote, setParentAccountNote] = useState('');
  const [studentAccountNote, setStudentAccountNote] = useState('');

  useEffect(() => {
    api.getStudent(id)
      .then((data) => {
        setStudent(data);
        setPhotoUrl(data.photoUrl || null);
      })
      .catch(console.error);
  }, [id]);

  const updateStatus = async (status) => {
    try {
      const updated = await api.updateRegistrationStatus(id, status);
      setStudent(updated);
      if (updated.parentAccountNote) {
        setParentAccountNote(updated.parentAccountNote);
      }
      if (updated.studentAccountNote) {
        setStudentAccountNote(updated.studentAccountNote);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  if (!student) return <p className="text-gray-500">Chargement...</p>;

  const status = STATUS_BADGE[student.registrationStatus] || STATUS_BADGE.PENDING;
  const StatusIcon = status.icon;

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate(`/campus/${campusId}/students`)} className="flex items-center gap-2 text-gray-500 hover:text-brand-600 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Retour aux étudiants
      </button>

      <div className="card mb-8">
        <div className="flex items-start gap-6">
          <div className="shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`${student.firstName} ${student.lastName}`}
                className="w-32 h-32 rounded-xl object-cover border-2 border-brand-100 shadow-sm"
              />
            ) : (
              <div className="w-32 h-32 rounded-xl bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                <User className="w-12 h-12 text-gray-300" />
              </div>
            )}
          </div>
          <div className="flex-1 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{student.lastName} {student.postName} {student.firstName}</h1>
              <p className="text-brand-600 font-medium mt-1">{student.studentId}</p>
              {student.class?.name && (
                <p className="text-gray-500 text-sm mt-1">{student.class.name}</p>
              )}
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium shrink-0 ${status.className}`}>
              <StatusIcon className="w-4 h-4" /> {status.label}
            </span>
          </div>
        </div>
      </div>

      {canManage && student.parentSubmitted && (
        <div className="card mb-6 flex items-start gap-3 border-violet-200 bg-violet-50/60">
          <p className="text-sm text-violet-900">
            <strong>Parent portal submission</strong> — this registration was submitted online by a parent. Review the details and approve or reject below.
          </p>
        </div>
      )}

      {canManage && student.registrationStatus === 'PENDING' && (
        <div className="card mb-6 flex gap-3">
          <button onClick={() => updateStatus('APPROVED')} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Approuver</button>
          <button onClick={() => updateStatus('REJECTED')} className="btn-secondary flex items-center gap-2 text-red-600"><XCircle className="w-4 h-4" /> Rejeter</button>
        </div>
      )}

      {canProvisionAccounts && (
        <AdminFamilyAccounts
          studentId={id}
          student={student}
          onUpdated={() => api.getStudent(id).then(setStudent).catch(console.error)}
        />
      )}

      {canManage && !canProvisionAccounts && (parentAccountNote || studentAccountNote) && (
        <div className="card mb-6 text-sm text-gray-600">
          {parentAccountNote && <p className="text-brand-800 font-medium">{parentAccountNote}</p>}
          {studentAccountNote && <p className={`text-sky-800 font-medium ${parentAccountNote ? 'mt-2' : ''}`}>{studentAccountNote}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            title: 'I. Coordonnées de l\'enfant',
            rows: [
              ['Nom', student.lastName],
              ['Post-Nom', student.postName],
              ['Prénom', student.firstName],
              ['Sexe', student.gender === 'MALE' ? 'Masculin' : 'Féminin'],
              ['Date de naissance', student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '—'],
              ['Nationalité', student.nationality],
            ],
          },
          {
            title: 'II. Représentants légaux',
            rows: [
              ['Père', student.fatherName],
              ['Tél. père', student.fatherPhone],
              ['Mère', student.motherName],
              ['Tél. mère', student.motherPhone],
              ['Province', PROVINCE_LABELS[student.province] || student.province],
              ['District', student.district],
              ['Secteur', student.sector],
              ['Cellule', student.cell],
              ['Village', student.village],
              ['Contact urgence', `${student.emergencyContactName} — ${student.emergencyContactPhone}`],
            ],
          },
          {
            title: 'III. École de provenance',
            rows: [
              ['École', student.previousSchoolName || '—'],
              ['Année', student.previousSchoolYear || '—'],
              ['Classe', student.previousClass || '—'],
            ],
          },
          {
            title: 'IV. Inscription La Racine',
            rows: [
              ['Année', student.academicYear?.name || student.registrationYear],
              ['Classe demandée', student.registrationClass || '—'],
              ['Classe assignée', student.class?.name || '—'],
              ['Date inscription', student.registrationDate ? new Date(student.registrationDate).toLocaleDateString() : '—'],
            ],
          },
          {
            title: 'V. Santé',
            rows: [
              ['Antécédents chirurgicaux', student.surgicalHistory ? 'Oui' : 'Non'],
              ['Souffle cardiaque', student.heartMurmur ? 'Oui' : 'Non'],
              ['Allergies médicamenteuses', student.medicinalAllergies ? 'Oui' : 'Non'],
              ['Traitement', student.treatment],
              ['Diabète', student.diabetes ? 'Oui' : 'Non'],
              ['Asthme', student.asthma ? 'Oui' : 'Non'],
            ],
          },
          {
            title: 'VII–VIII. Transport & Paiement',
            rows: [
              ['Transport', labelFor(TRANSPORT_MODES, student.transportMode)],
              ['Arrêt bus', labelFor(BUS_STOPS, student.busStop)],
              ['Paiement', labelFor(PAYMENT_METHODS, student.paymentMethod)],
            ],
          },
        ].map((section) => (
          <div key={section.title} className="card">
            <h3 className="font-semibold text-gray-900 mb-4">{section.title}</h3>
            <dl className="space-y-2">
              {section.rows.map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm gap-4">
                  <dt className="text-gray-500 shrink-0">{k}</dt>
                  <dd className="text-gray-900 text-right">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {student.documents?.length > 0 && (
        <div className="card mt-6">
          <h3 className="font-semibold text-gray-900 mb-4">IX. Pièces jointes</h3>
          <ul className="space-y-2">
            {student.documents.map((doc) => (
              <li key={doc.id} className="text-sm text-gray-700 flex justify-between gap-4">
                <span>{getDocumentDisplayName(doc, student.studentId)}</span>
                <span className="text-gray-400 shrink-0">{doc.mimeType || 'file'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
