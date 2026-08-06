import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Pencil,
  Save,
  X,
  Eye,
  Download,
  FileText,
  Loader2,
  Replace,
  Trash2,
  Plus,
  CreditCard,
} from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import { useAuth } from '../context/AuthContext';
import AdminFamilyAccounts from '../components/AdminFamilyAccounts';
import {
  BUS_STOPS,
  TRANSPORT_MODES,
  PAYMENT_METHODS,
  TREATMENT_OPTIONS,
  DOCUMENT_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  fileToBase64,
} from '../config/registration';

const STATUS_BADGE = {
  PENDING: { icon: Clock, className: 'bg-amber-50 text-amber-700', label: 'En attente' },
  APPROVED: { icon: CheckCircle, className: 'bg-green-50 text-green-700', label: 'Approuvé' },
  REJECTED: { icon: XCircle, className: 'bg-red-50 text-red-600', label: 'Rejeté' },
};

const PROVINCE_OPTIONS = [
  { value: 'KIGALI', label: 'Kigali' },
  { value: 'SOUTH', label: 'Southern' },
  { value: 'WEST', label: 'Western' },
  { value: 'NORTH', label: 'Northern' },
  { value: 'EAST', label: 'Eastern' },
];

const PROVINCE_LABELS = Object.fromEntries(PROVINCE_OPTIONS.map((o) => [o.value, o.label]));

function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label || value || '—';
}

function yesNo(value) {
  if (value === true) return 'Oui';
  if (value === false) return 'Non';
  return '—';
}

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function getDocumentDisplayName(doc, studentCode) {
  if (doc.fileName?.includes(studentCode)) return doc.fileName;

  const typeLabel = DOCUMENT_TYPES.find((d) => d.value === doc.docType)?.label
    || doc.docType?.replace(/_/g, ' ')
    || 'Document';
  const ext = doc.fileName?.match(/\.[^.]+$/)?.[0] || '';
  return `${typeLabel} ${studentCode || ''}${ext}`.trim();
}

function isImageMime(mime, fileName = '') {
  return String(mime || '').startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(fileName);
}

function isPdfMime(mime, fileName = '') {
  return String(mime || '').includes('pdf') || /\.pdf$/i.test(fileName);
}

function studentToForm(student) {
  return {
    lastName: student.lastName || '',
    postName: student.postName || '',
    firstName: student.firstName || '',
    gender: student.gender || 'MALE',
    dateOfBirth: toDateInput(student.dateOfBirth),
    nationality: student.nationality || '',
    email: student.email || '',
    phone: student.phone || '',
    fatherName: student.fatherName || '',
    fatherProfession: student.fatherProfession || '',
    fatherPhone: student.fatherPhone || '',
    fatherEmail: student.fatherEmail || '',
    motherName: student.motherName || '',
    motherProfession: student.motherProfession || '',
    motherPhone: student.motherPhone || '',
    motherEmail: student.motherEmail || '',
    province: student.province || '',
    district: student.district || '',
    sector: student.sector || '',
    cell: student.cell || '',
    village: student.village || '',
    emergencyContactName: student.emergencyContactName || '',
    emergencyContactPhone: student.emergencyContactPhone || '',
    previousSchoolName: student.previousSchoolName || '',
    previousSchoolYear: student.previousSchoolYear || '',
    previousClass: student.previousClass || '',
    classId: student.classId || '',
    registrationClass: student.registrationClass || '',
    registrationDate: toDateInput(student.registrationDate),
    registrationStatus: student.registrationStatus || 'PENDING',
    surgicalHistory: student.surgicalHistory,
    heartMurmur: student.heartMurmur,
    medicinalAllergies: student.medicinalAllergies,
    generalAllergies: student.generalAllergies || '',
    tuberculosis: student.tuberculosis,
    treatment: student.treatment || '',
    foodIntolerance: student.foodIntolerance,
    diabetes: student.diabetes,
    asthma: student.asthma,
    visualDisturbances: student.visualDisturbances,
    transportMode: student.transportMode || '',
    busStop: student.busStop || '',
    paymentMethod: student.paymentMethod || '',
    additionalInfo: student.additionalInfo || '',
  };
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function BoolSelect({ value, onChange }) {
  const v = value === true ? 'yes' : value === false ? 'no' : '';
  return (
    <select
      className="input"
      value={v}
      onChange={(e) => {
        if (e.target.value === 'yes') onChange(true);
        else if (e.target.value === 'no') onChange(false);
        else onChange(null);
      }}
    >
      <option value="">—</option>
      <option value="yes">Oui</option>
      <option value="no">Non</option>
    </select>
  );
}

function ViewRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className="text-gray-900 text-right whitespace-pre-wrap">{value || '—'}</dd>
    </div>
  );
}

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campusId } = useCampus();
  const { user } = useAuth();
  const canManage = !['TEACHER', 'PARENT', 'STUDENT'].includes(user?.role);
  const canProvisionAccounts = ['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY'].includes(user?.role);

  const [student, setStudent] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [parentAccountNote, setParentAccountNote] = useState('');
  const [studentAccountNote, setStudentAccountNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [classes, setClasses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [docBusyId, setDocBusyId] = useState(null);
  const [viewer, setViewer] = useState(null); // { doc, url, contentType }

  const loadStudent = () =>
    api.getStudent(id).then((data) => {
      setStudent(data);
      setPhotoUrl(data.photoUrl || null);
      return data;
    });

  useEffect(() => {
    loadStudent().catch(console.error);
  }, [id]);

  useEffect(() => {
    return () => {
      if (viewer?.url) URL.revokeObjectURL(viewer.url);
    };
  }, [viewer?.url]);

  useEffect(() => {
    if (!canManage) return;
    api.getClasses().then(setClasses).catch(console.error);
  }, [canManage, campusId]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const closeViewer = () => {
    setViewer((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const openDocument = async (doc) => {
    setDocBusyId(doc.id);
    setError('');
    try {
      const { url, contentType } = await api.getStudentDocumentBlob(id, doc.id);
      setViewer((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { doc, url, contentType };
      });
    } catch (err) {
      setError(err.message || 'Impossible d’ouvrir le document');
    } finally {
      setDocBusyId(null);
    }
  };

  const downloadDocument = async (doc) => {
    setDocBusyId(doc.id);
    setError('');
    try {
      const { url } = await api.getStudentDocumentBlob(id, doc.id, { download: true });
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || getDocumentDisplayName(doc, student?.studentId);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError(err.message || 'Impossible de télécharger le document');
    } finally {
      setDocBusyId(null);
    }
  };

  const applyStudentUpdate = (nextStudent) => {
    if (!nextStudent) return;
    setStudent(nextStudent);
    setPhotoUrl(nextStudent.photoUrl || null);
  };

  const replaceDocument = async (docType, file, replaceDocId = null) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Fichier trop volumineux (max ${MAX_FILE_SIZE_MB} Mo).`);
      return;
    }
    const busyKey = replaceDocId || `new-${docType}`;
    setDocBusyId(busyKey);
    setError('');
    setMessage('');
    try {
      const contentBase64 = await fileToBase64(file);
      const result = await api.uploadStudentDocument(id, {
        docType,
        fileName: file.name,
        mimeType: file.type || null,
        contentBase64,
        replaceDocId,
      });
      applyStudentUpdate(result.student);
      closeViewer();
      setMessage(replaceDocId ? 'Document remplacé. L’ancien fichier a été supprimé.' : 'Document ajouté.');
    } catch (err) {
      setError(err.message || 'Échec du téléversement');
    } finally {
      setDocBusyId(null);
    }
  };

  const removeDocument = async (doc) => {
    if (!window.confirm(`Supprimer « ${getDocumentDisplayName(doc, student.studentId)} » ?`)) return;
    setDocBusyId(doc.id);
    setError('');
    try {
      const result = await api.deleteStudentDocument(id, doc.id);
      applyStudentUpdate(result.student);
      if (viewer?.doc?.id === doc.id) closeViewer();
      setMessage('Document supprimé.');
    } catch (err) {
      setError(err.message || 'Impossible de supprimer le document');
    } finally {
      setDocBusyId(null);
    }
  };

  const startEdit = () => {
    setForm(studentToForm(student));
    setError('');
    setMessage('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm(null);
    setError('');
  };

  const saveEdit = async () => {
    if (!form.lastName?.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        ...form,
        firstName: form.firstName?.trim() || '',
        lastName: form.lastName.trim(),
        classId: form.classId || null,
        busStop: form.busStop || null,
        paymentMethod: form.paymentMethod || null,
        transportMode: form.transportMode || null,
        treatment: form.treatment || null,
        dateOfBirth: form.dateOfBirth || null,
        registrationDate: form.registrationDate || null,
      };
      const updated = await api.updateStudent(id, payload);
      setStudent(updated);
      setPhotoUrl(updated.photoUrl || photoUrl);
      setEditing(false);
      setForm(null);
      setMessage('Informations de l’élève enregistrées.');
    } catch (err) {
      setError(err.message || 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status) => {
    try {
      const updated = await api.updateRegistrationStatus(id, status);
      setStudent(updated);
      if (updated.parentAccountNote) setParentAccountNote(updated.parentAccountNote);
      if (updated.studentAccountNote) setStudentAccountNote(updated.studentAccountNote);
    } catch (err) {
      alert(err.message);
    }
  };

  const classOptions = useMemo(
    () => (Array.isArray(classes) ? classes : []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [classes],
  );

  const missingDocTypes = useMemo(() => {
    const have = new Set((student?.documents || []).map((d) => d.docType));
    return DOCUMENT_TYPES.filter((t) => !have.has(t.value));
  }, [student?.documents]);

  if (!student) return <p className="text-gray-500">Chargement...</p>;

  const status = STATUS_BADGE[student.registrationStatus] || STATUS_BADGE.PENDING;
  const StatusIcon = status.icon;
  const f = form || {};

  return (
    <div className="max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => navigate(`/campus/${campusId}/students`)}
        className="flex items-center gap-2 text-gray-500 hover:text-brand-600 mb-6 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux étudiants
      </button>

      <div className="card mb-6">
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
              <h1 className="text-2xl font-bold">
                {student.lastName} {student.postName} {student.firstName}
              </h1>
              <p className="text-brand-600 font-medium mt-1">{student.studentId}</p>
              {student.class?.name && <p className="text-gray-500 text-sm mt-1">{student.class.name}</p>}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${status.className}`}>
                <StatusIcon className="w-4 h-4" /> {status.label}
              </span>
              {canManage && student.registrationStatus === 'APPROVED' && !editing && (
                <Link
                  to={`/campus/${campusId}/id-cards?student=${student.id}`}
                  className="btn-secondary text-sm inline-flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" /> Carte élève
                </Link>
              )}
              {canManage && !editing && (
                <button type="button" onClick={startEdit} className="btn-secondary text-sm inline-flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Modifier
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{error}</div>}
      {message && <div className="mb-4 p-3 rounded-lg bg-brand-50 border border-brand-100 text-brand-800 text-sm">{message}</div>}

      {canManage && editing && (
        <div className="card mb-6 flex flex-wrap gap-3 items-center justify-between border-brand-200 bg-brand-50/40">
          <p className="text-sm text-brand-900">Mode édition — mettez à jour les informations, puis enregistrez.</p>
          <div className="flex gap-2">
            <button type="button" onClick={cancelEdit} disabled={saving} className="btn-secondary text-sm inline-flex items-center gap-1.5">
              <X className="w-4 h-4" /> Annuler
            </button>
            <button type="button" onClick={saveEdit} disabled={saving} className="btn-primary text-sm inline-flex items-center gap-1.5">
              <Save className="w-4 h-4" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {canManage && student.parentSubmitted && (
        <div className="card mb-6 flex items-start gap-3 border-violet-200 bg-violet-50/60">
          <p className="text-sm text-violet-900">
            <strong>Parent portal submission</strong> — this registration was submitted online by a parent. Review the details and approve or reject below.
          </p>
        </div>
      )}

      {canManage && !editing && student.registrationStatus === 'PENDING' && (
        <div className="card mb-6 flex gap-3">
          <button type="button" onClick={() => updateStatus('APPROVED')} className="btn-primary flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Approuver
          </button>
          <button type="button" onClick={() => updateStatus('REJECTED')} className="btn-secondary flex items-center gap-2 text-red-600">
            <XCircle className="w-4 h-4" /> Rejeter
          </button>
        </div>
      )}

      {canProvisionAccounts && (
        <AdminFamilyAccounts
          studentId={id}
          student={student}
          onUpdated={() => loadStudent().catch(console.error)}
        />
      )}

      {canManage && !canProvisionAccounts && (parentAccountNote || studentAccountNote) && (
        <div className="card mb-6 text-sm text-gray-600">
          {parentAccountNote && <p className="text-brand-800 font-medium">{parentAccountNote}</p>}
          {studentAccountNote && (
            <p className={`text-sky-800 font-medium ${parentAccountNote ? 'mt-2' : ''}`}>{studentAccountNote}</p>
          )}
        </div>
      )}

      {editing ? (
        <div className="space-y-6">
          <section className="card space-y-4">
            <h3 className="font-semibold text-gray-900">I. Coordonnées de l&apos;enfant</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nom *"><input className="input" value={f.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
              <Field label="Post-Nom"><input className="input" value={f.postName} onChange={(e) => set('postName', e.target.value)} /></Field>
              <Field label="Prénom"><input className="input" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
              <Field label="Sexe">
                <select className="input" value={f.gender} onChange={(e) => set('gender', e.target.value)}>
                  <option value="MALE">Masculin</option>
                  <option value="FEMALE">Féminin</option>
                </select>
              </Field>
              <Field label="Date de naissance">
                <input className="input" type="date" value={f.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
              </Field>
              <Field label="Nationalité"><input className="input" value={f.nationality} onChange={(e) => set('nationality', e.target.value)} /></Field>
              <Field label="E-mail élève"><input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Téléphone élève"><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            </div>
          </section>

          <section className="card space-y-4">
            <h3 className="font-semibold text-gray-900">II. Représentants légaux</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Père — nom"><input className="input" value={f.fatherName} onChange={(e) => set('fatherName', e.target.value)} /></Field>
              <Field label="Père — profession"><input className="input" value={f.fatherProfession} onChange={(e) => set('fatherProfession', e.target.value)} /></Field>
              <Field label="Père — téléphone"><input className="input" value={f.fatherPhone} onChange={(e) => set('fatherPhone', e.target.value)} /></Field>
              <Field label="Père — e-mail"><input className="input" type="email" value={f.fatherEmail} onChange={(e) => set('fatherEmail', e.target.value)} /></Field>
              <Field label="Mère — nom"><input className="input" value={f.motherName} onChange={(e) => set('motherName', e.target.value)} /></Field>
              <Field label="Mère — profession"><input className="input" value={f.motherProfession} onChange={(e) => set('motherProfession', e.target.value)} /></Field>
              <Field label="Mère — téléphone"><input className="input" value={f.motherPhone} onChange={(e) => set('motherPhone', e.target.value)} /></Field>
              <Field label="Mère — e-mail"><input className="input" type="email" value={f.motherEmail} onChange={(e) => set('motherEmail', e.target.value)} /></Field>
              <Field label="Province">
                <select className="input" value={f.province} onChange={(e) => set('province', e.target.value)}>
                  <option value="">—</option>
                  {PROVINCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="District"><input className="input" value={f.district} onChange={(e) => set('district', e.target.value)} /></Field>
              <Field label="Secteur"><input className="input" value={f.sector} onChange={(e) => set('sector', e.target.value)} /></Field>
              <Field label="Cellule"><input className="input" value={f.cell} onChange={(e) => set('cell', e.target.value)} /></Field>
              <Field label="Village"><input className="input" value={f.village} onChange={(e) => set('village', e.target.value)} /></Field>
              <Field label="Contact urgence — nom"><input className="input" value={f.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} /></Field>
              <Field label="Contact urgence — téléphone"><input className="input" value={f.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} /></Field>
            </div>
          </section>

          <section className="card space-y-4">
            <h3 className="font-semibold text-gray-900">III. École de provenance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="École"><input className="input" value={f.previousSchoolName} onChange={(e) => set('previousSchoolName', e.target.value)} /></Field>
              <Field label="Année"><input className="input" value={f.previousSchoolYear} onChange={(e) => set('previousSchoolYear', e.target.value)} /></Field>
              <Field label="Classe"><input className="input" value={f.previousClass} onChange={(e) => set('previousClass', e.target.value)} /></Field>
            </div>
          </section>

          <section className="card space-y-4">
            <h3 className="font-semibold text-gray-900">IV. Inscription La Racine</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Classe assignée">
                <select className="input" value={f.classId} onChange={(e) => set('classId', e.target.value)}>
                  <option value="">— Non assignée —</option>
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Classe demandée (texte)">
                <input className="input" value={f.registrationClass} onChange={(e) => set('registrationClass', e.target.value)} />
              </Field>
              <Field label="Date d’inscription">
                <input className="input" type="date" value={f.registrationDate} onChange={(e) => set('registrationDate', e.target.value)} />
              </Field>
              <Field label="Statut d’inscription">
                <select className="input" value={f.registrationStatus} onChange={(e) => set('registrationStatus', e.target.value)}>
                  <option value="PENDING">En attente</option>
                  <option value="APPROVED">Approuvé</option>
                  <option value="REJECTED">Rejeté</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="card space-y-4">
            <h3 className="font-semibold text-gray-900">V. Santé</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Antécédents chirurgicaux"><BoolSelect value={f.surgicalHistory} onChange={(v) => set('surgicalHistory', v)} /></Field>
              <Field label="Souffle cardiaque"><BoolSelect value={f.heartMurmur} onChange={(v) => set('heartMurmur', v)} /></Field>
              <Field label="Allergies médicamenteuses"><BoolSelect value={f.medicinalAllergies} onChange={(v) => set('medicinalAllergies', v)} /></Field>
              <Field label="Tuberculose / maladie infectieuse"><BoolSelect value={f.tuberculosis} onChange={(v) => set('tuberculosis', v)} /></Field>
              <Field label="Intolérance alimentaire"><BoolSelect value={f.foodIntolerance} onChange={(v) => set('foodIntolerance', v)} /></Field>
              <Field label="Diabète"><BoolSelect value={f.diabetes} onChange={(v) => set('diabetes', v)} /></Field>
              <Field label="Asthme"><BoolSelect value={f.asthma} onChange={(v) => set('asthma', v)} /></Field>
              <Field label="Troubles visuels"><BoolSelect value={f.visualDisturbances} onChange={(v) => set('visualDisturbances', v)} /></Field>
              <Field label="Traitement">
                <select className="input" value={f.treatment} onChange={(e) => set('treatment', e.target.value)}>
                  <option value="">—</option>
                  {TREATMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Allergies générales (texte)">
                <input className="input" value={f.generalAllergies} onChange={(e) => set('generalAllergies', e.target.value)} />
              </Field>
            </div>
          </section>

          <section className="card space-y-4">
            <h3 className="font-semibold text-gray-900">VII–VIII. Transport &amp; paiement</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Transport">
                <select className="input" value={f.transportMode} onChange={(e) => set('transportMode', e.target.value)}>
                  <option value="">—</option>
                  {TRANSPORT_MODES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Arrêt bus">
                <select className="input" value={f.busStop} onChange={(e) => set('busStop', e.target.value)}>
                  <option value="">—</option>
                  {BUS_STOPS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Paiement">
                <select className="input" value={f.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
                  <option value="">—</option>
                  {PAYMENT_METHODS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section className="card space-y-4">
            <h3 className="font-semibold text-gray-900">Autres informations</h3>
            <Field label="Notes / informations complémentaires">
              <textarea
                className="input min-h-[120px]"
                value={f.additionalInfo}
                onChange={(e) => set('additionalInfo', e.target.value)}
                placeholder="Informations supplémentaires pour le dossier de l’élève…"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={cancelEdit} disabled={saving} className="btn-secondary text-sm">Annuler</button>
              <button type="button" onClick={saveEdit} disabled={saving} className="btn-primary text-sm inline-flex items-center gap-1.5">
                <Save className="w-4 h-4" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </section>
        </div>
      ) : (
        <>
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
                  ['E-mail', student.email],
                  ['Téléphone', student.phone],
                ],
              },
              {
                title: 'II. Représentants légaux',
                rows: [
                  ['Père', student.fatherName],
                  ['Profession père', student.fatherProfession],
                  ['Tél. père', student.fatherPhone],
                  ['E-mail père', student.fatherEmail],
                  ['Mère', student.motherName],
                  ['Profession mère', student.motherProfession],
                  ['Tél. mère', student.motherPhone],
                  ['E-mail mère', student.motherEmail],
                  ['Province', PROVINCE_LABELS[student.province] || student.province],
                  ['District', student.district],
                  ['Secteur', student.sector],
                  ['Cellule', student.cell],
                  ['Village', student.village],
                  ['Contact urgence', `${student.emergencyContactName || '—'} — ${student.emergencyContactPhone || '—'}`],
                ],
              },
              {
                title: 'III. École de provenance',
                rows: [
                  ['École', student.previousSchoolName],
                  ['Année', student.previousSchoolYear],
                  ['Classe', student.previousClass],
                ],
              },
              {
                title: 'IV. Inscription La Racine',
                rows: [
                  ['Année', student.academicYear?.name || student.registrationYear],
                  ['Classe demandée', student.registrationClass],
                  ['Classe assignée', student.class?.name],
                  ['Date inscription', student.registrationDate ? new Date(student.registrationDate).toLocaleDateString() : '—'],
                ],
              },
              {
                title: 'V. Santé',
                rows: [
                  ['Antécédents chirurgicaux', yesNo(student.surgicalHistory)],
                  ['Souffle cardiaque', yesNo(student.heartMurmur)],
                  ['Allergies médicamenteuses', yesNo(student.medicinalAllergies)],
                  ['Allergies générales', student.generalAllergies],
                  ['Tuberculose / infectieux', yesNo(student.tuberculosis)],
                  ['Traitement', labelFor(TREATMENT_OPTIONS, student.treatment)],
                  ['Intolérance alimentaire', yesNo(student.foodIntolerance)],
                  ['Diabète', yesNo(student.diabetes)],
                  ['Asthme', yesNo(student.asthma)],
                  ['Troubles visuels', yesNo(student.visualDisturbances)],
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
                    <ViewRow key={k} label={k} value={v} />
                  ))}
                </dl>
              </div>
            ))}
          </div>

          {(student.additionalInfo || canManage) && (
            <div className="card mt-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-semibold text-gray-900">Autres informations</h3>
                {canManage && !student.additionalInfo && (
                  <button type="button" onClick={startEdit} className="text-sm text-brand-700 hover:underline">
                    Ajouter une note
                  </button>
                )}
              </div>
              {student.additionalInfo ? (
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{student.additionalInfo}</p>
              ) : (
                <p className="text-sm text-gray-400">Aucune information complémentaire pour le moment.</p>
              )}
            </div>
          )}
        </>
      )}

      {(student.documents?.length > 0 || canManage) && (
        <div className="card mt-6">
          <h3 className="font-semibold text-gray-900 mb-4">IX. Pièces jointes</h3>
          {student.documents?.length > 0 ? (
            <ul className="space-y-2">
              {student.documents.map((doc) => {
                const busy = docBusyId === doc.id;
                const typeLabel = DOCUMENT_TYPES.find((d) => d.value === doc.docType)?.label || doc.docType;
                return (
                  <li
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 rounded-lg bg-white border border-gray-200 p-2 text-brand-700 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {getDocumentDisplayName(doc, student.studentId)}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {typeLabel}
                          {doc.mimeType ? ` · ${doc.mimeType}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        className="btn-secondary text-xs inline-flex items-center gap-1.5"
                        disabled={busy}
                        onClick={() => openDocument(doc)}
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                        Voir
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs inline-flex items-center gap-1.5"
                        disabled={busy}
                        onClick={() => downloadDocument(doc)}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Télécharger
                      </button>
                      {canManage && (
                        <>
                          <label className={`btn-secondary text-xs inline-flex items-center gap-1.5 cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
                            <Replace className="w-3.5 h-3.5" />
                            Remplacer
                            <input
                              type="file"
                              className="hidden"
                              accept={doc.docType === 'PHOTO' ? 'image/*' : 'image/*,.pdf,application/pdf'}
                              disabled={busy}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (file) await replaceDocument(doc.docType, file, doc.id);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="btn-secondary text-xs inline-flex items-center gap-1.5 text-red-600"
                            disabled={busy}
                            onClick={() => removeDocument(doc)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 mb-3">Aucun document joint à ce dossier.</p>
          )}

          {canManage && missingDocTypes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ajouter un document</p>
              <div className="flex flex-wrap gap-2">
                {missingDocTypes.map((dt) => {
                  const busy = docBusyId === `new-${dt.value}`;
                  return (
                    <label
                      key={dt.value}
                      className={`btn-secondary text-xs inline-flex items-center gap-1.5 cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      {dt.label}
                      <input
                        type="file"
                        className="hidden"
                        accept={dt.value === 'PHOTO' ? 'image/*' : 'image/*,.pdf,application/pdf'}
                        disabled={busy}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) await replaceDocument(dt.value, file, null);
                        }}
                      />
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400">Max {MAX_FILE_SIZE_MB} Mo. Remplacer un document existant supprime l’ancien fichier.</p>
            </div>
          )}
        </div>
      )}

      {viewer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu du document"
          onClick={closeViewer}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {getDocumentDisplayName(viewer.doc, student.studentId)}
                </p>
                <p className="text-xs text-gray-500">{viewer.doc.mimeType || viewer.contentType || 'file'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="btn-secondary text-xs inline-flex items-center gap-1.5"
                  onClick={() => downloadDocument(viewer.doc)}
                >
                  <Download className="w-3.5 h-3.5" /> Télécharger
                </button>
                <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1.5" onClick={closeViewer}>
                  <X className="w-3.5 h-3.5" /> Fermer
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-gray-100 overflow-auto">
              {isImageMime(viewer.contentType, viewer.doc.fileName) ? (
                <div className="p-4 flex justify-center">
                  <img src={viewer.url} alt={viewer.doc.fileName || 'Document'} className="max-w-full max-h-[75vh] object-contain rounded-lg shadow" />
                </div>
              ) : isPdfMime(viewer.contentType, viewer.doc.fileName) ? (
                <iframe title={viewer.doc.fileName || 'PDF'} src={viewer.url} className="w-full h-[75vh] border-0 bg-white" />
              ) : (
                <div className="p-8 text-center space-y-3">
                  <FileText className="w-10 h-10 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">Aperçu non disponible pour ce type de fichier.</p>
                  <button type="button" className="btn-primary text-sm inline-flex items-center gap-1.5" onClick={() => downloadDocument(viewer.doc)}>
                    <Download className="w-4 h-4" /> Télécharger le fichier
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
