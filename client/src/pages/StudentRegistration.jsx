import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, FileUp, X } from 'lucide-react';
import { api } from '../lib/api';
import { useCampus } from '../context/CampusContext';
import { useAuth } from '../context/AuthContext';
import {
  FORM_SECTIONS, EMPTY_FORM,
  BUS_STOPS, TRANSPORT_MODES, PAYMENT_METHODS, TREATMENT_OPTIONS,
  DOCUMENT_TYPES, fileToBase64, MAX_FILE_SIZE_MB, MAX_FILE_SIZE_BYTES, formatAttachmentName,
} from '../config/registration';
import RwandaLocationSelect from '../components/RwandaLocationSelect';

function classLabel(cls) {
  return `${cls.name} (${cls.grade} — ${cls.section})`;
}

function Label({ children, required }) {
  return (
    <label className="label">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function YesNoField({ label, value, onChange, required }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className="flex gap-4 mt-1">
        {[{ v: true, l: 'Oui / Yes / Yego' }, { v: false, l: 'Non / No / Oya' }].map(({ v, l }) => (
          <label key={String(v)} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={value === v} onChange={() => onChange(v)} className="accent-brand-600" />
            {l}
          </label>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ section }) {
  return (
    <div className="mb-6 pb-4 border-b border-gray-200">
      <p className="text-xs uppercase tracking-wider text-brand-600 font-medium">Section {section.id}</p>
      <h2 className="text-xl font-bold text-gray-900 mt-1">{section.title}</h2>
      <p className="text-sm text-gray-500">{section.subtitle}</p>
    </div>
  );
}

export default function StudentRegistration({ isParent = false }) {
  const navigate = useNavigate();
  const { campusId } = useCampus();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [academicYears, setAcademicYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setOptionsLoading(true);
    api[isParent ? 'getParentRegistrationOptions' : 'getRegistrationOptions']()
      .then((data) => {
        if (!active) return;
        setAcademicYears(data.academicYears || []);
        setClasses(data.classes || []);
        const activeYear = data.academicYears?.find((y) => y.isActive);
        if (activeYear) {
          setForm((f) => {
            const next = f.academicYearId ? f : {
              ...f,
              academicYearId: activeYear.id,
              registrationYear: activeYear.name,
            };
            if (isParent && user && !f.fatherName && !f.motherName) {
              return {
                ...next,
                fatherName: `${user.firstName} ${user.lastName}`.trim(),
                motherName: next.motherName,
              };
            }
            return next;
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => { if (active) setOptionsLoading(false); });
    return () => { active = false; };
  }, [campusId, isParent, user]);

  const classesForYear = (yearId) => classes.filter((c) => c.academicYearId === yearId);

  const previousYearClasses = useMemo(
    () => classesForYear(form.previousAcademicYearId),
    [classes, form.previousAcademicYearId],
  );

  const registrationClasses = useMemo(
    () => classesForYear(form.academicYearId),
    [classes, form.academicYearId],
  );

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleFile = async (docType, file) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`"${file.name}" is too large. Maximum file size is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    const contentBase64 = await fileToBase64(file);
    setForm((f) => ({
      ...f,
      documents: [
        ...f.documents.filter((d) => d.docType !== docType),
        { docType, fileName: file.name, mimeType: file.type, contentBase64 },
      ],
    }));
  };

  const removeDoc = (docType) => {
    setForm((f) => ({ ...f, documents: f.documents.filter((d) => d.docType !== docType) }));
  };

  const validateStep = (stepIndex = step) => {
    setError('');
    if (stepIndex === 0) {
      if (!form.lastName || !form.postName || !form.dateOfBirth || !form.nationality) {
        setError('Nom, Post-Nom, date de naissance et nationalité sont obligatoires.');
        return false;
      }
    }
    if (stepIndex === 1) {
      if (!form.fatherName || !form.fatherPhone || !form.motherName || !form.motherPhone) {
        setError('Noms et téléphones du père et de la mère sont obligatoires.');
        return false;
      }
      if (!form.province || !form.district || !form.sector || !form.cell || !form.village) {
        setError('Province, district, secteur, cellule et village sont obligatoires.');
        return false;
      }
      if (!form.emergencyContactName || !form.emergencyContactPhone) {
        setError('Personne de contact d\'urgence obligatoire.');
        return false;
      }
    }
    if (stepIndex === 3) {
      if (!form.academicYearId || !form.classId) {
        setError('Année scolaire et classe sont obligatoires.');
        return false;
      }
    }
    if (stepIndex === 5) {
      if (!form.registrationDate) {
        setError('Date d\'enregistrement obligatoire.');
        return false;
      }
    }
    if (stepIndex === 7) {
      if (!form.paymentMethod) {
        setError('Mode de paiement obligatoire.');
        return false;
      }
    }
    if (stepIndex === 8) {
      const types = form.documents.map((d) => d.docType);
      if (!types.includes('BIRTH_CERTIFICATE') || !types.includes('PHOTO')) {
        setError('Acte de naissance et photo sont obligatoires.');
        return false;
      }
    }
    return true;
  };

  const validateAll = () => {
    for (let i = 0; i < FORM_SECTIONS.length; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, FORM_SECTIONS.length - 1));
  };

  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    if (!validateAll()) return;
    setSaving(true);
    setError('');
    try {
      const student = isParent
        ? await api.submitParentRegistration(form)
        : await api.registerStudent(form);
      if (isParent) {
        navigate(`/campus/${campusId}/my-registrations`, {
          state: { message: student.message || 'Registration submitted for school review.' },
        });
      } else {
        navigate(`/campus/${campusId}/students/${student.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const section = FORM_SECTIONS[step];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          {isParent ? 'Register your child' : 'Fiche d\'inscription scolaire'}
        </h1>
        <p className="text-gray-500 mt-1">
          {isParent
            ? 'Complete all sections and submit — the school will review and approve or reject your application.'
            : 'Registration Form 2025-2026 · Ifishi yo kwiyandikisha ku ishuri'}
        </p>
      </div>

      {/* Stepper */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
        {FORM_SECTIONS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => i < step && setStep(i)}
            className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              i === step ? 'bg-brand-600 text-white' : i < step ? 'bg-brand-50 text-brand-700 cursor-pointer' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {s.id}. {s.title.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>
      )}

      <div className="card">
        <SectionHeader section={section} />

        {/* I. Child details */}
        {step === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label required>Nom / Name / Izina</Label><input className="input" required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
            <div><Label required>Post-Nom / Post Name</Label><input className="input" required value={form.postName} onChange={(e) => set('postName', e.target.value)} /></div>
            <div><Label>Prénom / Surname</Label><input className="input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></div>
            <div>
              <Label required>Sexe / Sex / Igitsina</Label>
              <select className="input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="MALE">Masculin / Male / Gabo</option>
                <option value="FEMALE">Féminin / Female / Gore</option>
              </select>
            </div>
            <div><Label required>Date de naissance / Date of Birth</Label><input className="input" type="date" required value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} /></div>
            <div><Label required>Nationalité / Nationality</Label><input className="input" required value={form.nationality} onChange={(e) => set('nationality', e.target.value)} /></div>
          </div>
        )}

        {/* II. Legal representatives */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Père / Father / Se</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label required>Nom – prénom du père</Label><input className="input" required value={form.fatherName} onChange={(e) => set('fatherName', e.target.value)} /></div>
                <div><Label>Profession</Label><input className="input" value={form.fatherProfession} onChange={(e) => set('fatherProfession', e.target.value)} /></div>
                <div><Label required>Téléphone</Label><input className="input" required value={form.fatherPhone} onChange={(e) => set('fatherPhone', e.target.value)} /></div>
                <div><Label>E-mail</Label><input className="input" type="email" value={form.fatherEmail} onChange={(e) => set('fatherEmail', e.target.value)} /></div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Mère / Mother / Nyina</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label required>Nom – prénom de la mère</Label><input className="input" required value={form.motherName} onChange={(e) => set('motherName', e.target.value)} /></div>
                <div><Label>Profession</Label><input className="input" value={form.motherProfession} onChange={(e) => set('motherProfession', e.target.value)} /></div>
                <div><Label required>Téléphone</Label><input className="input" required value={form.motherPhone} onChange={(e) => set('motherPhone', e.target.value)} /></div>
                <div><Label>E-mail</Label><input className="input" type="email" value={form.motherEmail} onChange={(e) => set('motherEmail', e.target.value)} /></div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Adresse / Address</h3>
              <RwandaLocationSelect
                value={{
                  province: form.province,
                  district: form.district,
                  sector: form.sector,
                  cell: form.cell,
                  village: form.village,
                }}
                onChange={(location) => setForm((f) => ({ ...f, ...location }))}
              />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Autre personne de contact / Emergency contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label required>Nom</Label><input className="input" required value={form.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} /></div>
                <div><Label required>Téléphone</Label><input className="input" required value={form.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} /></div>
              </div>
            </div>
          </div>
        )}

        {/* III. Previous school */}
        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Année Scolaire / School year</Label>
              <select
                className="input"
                value={form.previousAcademicYearId}
                disabled={optionsLoading}
                onChange={(e) => {
                  const year = academicYears.find((y) => y.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    previousAcademicYearId: e.target.value,
                    previousClassId: '',
                    previousSchoolYear: year?.name || '',
                    previousClass: '',
                  }));
                }}
              >
                <option value="">{optionsLoading ? 'Chargement…' : '—'}</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (active)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Classe / Class</Label>
              <select
                className="input"
                value={form.previousClassId}
                disabled={!form.previousAcademicYearId || optionsLoading}
                onChange={(e) => {
                  const cls = previousYearClasses.find((c) => c.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    previousClassId: e.target.value,
                    previousClass: cls ? classLabel(cls) : '',
                  }));
                }}
              >
                <option value="">—</option>
                {previousYearClasses.map((c) => (
                  <option key={c.id} value={c.id}>{classLabel(c)}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* IV. La Racine registration */}
        {step === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label required>Année Scolaire / School year</Label>
              <select
                className="input"
                required
                value={form.academicYearId}
                disabled={optionsLoading}
                onChange={(e) => {
                  const year = academicYears.find((y) => y.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    academicYearId: e.target.value,
                    classId: '',
                    registrationYear: year?.name || '',
                    registrationClass: '',
                  }));
                }}
              >
                <option value="">{optionsLoading ? 'Chargement…' : 'Sélectionner...'}</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (active)' : ''}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">L&apos;élève sera inscrit dans cette année scolaire.</p>
            </div>
            <div>
              <Label required>Classe / Class</Label>
              <select
                className="input"
                required
                value={form.classId}
                disabled={!form.academicYearId || optionsLoading}
                onChange={(e) => {
                  const cls = registrationClasses.find((c) => c.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    classId: e.target.value,
                    registrationClass: cls ? classLabel(cls) : '',
                  }));
                }}
              >
                <option value="">Sélectionner...</option>
                {registrationClasses.map((c) => (
                  <option key={c.id} value={c.id}>{classLabel(c)}</option>
                ))}
              </select>
              {form.academicYearId && !registrationClasses.length && (
                <p className="text-xs text-amber-600 mt-1">Aucune classe pour cette année. Créez des classes d&apos;abord.</p>
              )}
            </div>
          </div>
        )}

        {/* V. Medical */}
        {step === 4 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <YesNoField label="Antécédents chirurgicaux / Surgical history" value={form.surgicalHistory} onChange={(v) => set('surgicalHistory', v)} required />
            <YesNoField label="Souffle cardiaque / Heart murmur" value={form.heartMurmur} onChange={(v) => set('heartMurmur', v)} required />
            <YesNoField label="Allergies médicamenteuses" value={form.medicinalAllergies} onChange={(v) => set('medicinalAllergies', v)} required />
            <div className="md:col-span-2"><Label>Allergies / Allergie rusange</Label><input className="input" value={form.generalAllergies} onChange={(e) => set('generalAllergies', e.target.value)} placeholder="Décrire si applicable" /></div>
            <YesNoField label="Tuberculose, maladie infectieuse" value={form.tuberculosis} onChange={(v) => set('tuberculosis', v)} required />
            <div>
              <Label>Traitement / Treatment</Label>
              <select className="input" value={form.treatment} onChange={(e) => set('treatment', e.target.value)}>
                {TREATMENT_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <YesNoField label="Intolérance alimentaire" value={form.foodIntolerance} onChange={(v) => set('foodIntolerance', v)} required />
            <YesNoField label="Diabète / Diabetes" value={form.diabetes} onChange={(v) => set('diabetes', v)} required />
            <YesNoField label="Asthme / Asthma" value={form.asthma} onChange={(v) => set('asthma', v)} required />
            <YesNoField label="Troubles visuels / Visual disturbances" value={form.visualDisturbances} onChange={(v) => set('visualDisturbances', v)} required />
          </div>
        )}

        {/* VI. Registration date */}
        {step === 5 && (
          <div className="max-w-sm">
            <Label required>Date d'enregistrement du dossier</Label>
            <input className="input" type="date" required value={form.registrationDate} onChange={(e) => set('registrationDate', e.target.value)} />
          </div>
        )}

        {/* VII. Transport */}
        {step === 6 && (
          <div className="space-y-4 max-w-lg">
            <div>
              <Label>Moyen de transport</Label>
              <div className="space-y-2 mt-2">
                {TRANSPORT_MODES.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" checked={form.transportMode === t.value} onChange={() => set('transportMode', t.value)} className="accent-brand-600" />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
            {form.transportMode === 'SCHOOL' && (
              <div>
                <Label>Arrêt bus / Bus stop</Label>
                <select className="input" value={form.busStop} onChange={(e) => set('busStop', e.target.value)}>
                  <option value="">Sélectionner...</option>
                  {BUS_STOPS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* VIII. Payment */}
        {step === 7 && (
          <div className="space-y-3 max-w-lg">
            <Label required>Mode de paiement pour l'inscription</Label>
            {PAYMENT_METHODS.map((p) => (
              <label key={p.value} className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-brand-400 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                <input type="radio" name="payment" checked={form.paymentMethod === p.value} onChange={() => set('paymentMethod', p.value)} className="mt-1 accent-brand-600" />
                <span className="text-sm">{p.label}</span>
              </label>
            ))}
          </div>
        )}

        {/* IX. Attachments */}
        {step === 8 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Téléchargez les pièces jointes requises. Acte de naissance et photo sont obligatoires.
              {' '}Max {MAX_FILE_SIZE_MB} MB par fichier (PDF ou image).
            </p>
            {DOCUMENT_TYPES.map((dt) => {
              const uploaded = form.documents.find((d) => d.docType === dt.value);
              return (
                <div key={dt.value} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{dt.label}{dt.required && <span className="text-red-500 ml-1">*</span>}</p>
                    {uploaded && (
                      <p className="text-xs text-gray-400 mt-1">
                        Selected: {uploaded.fileName}
                        <span className="block text-brand-600 mt-0.5">
                          Will be saved as: {formatAttachmentName(dt.value, 'LRS-XXXX-XXX', uploaded.fileName)}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {uploaded && (
                      <button type="button" onClick={() => removeDoc(dt.value)} className="p-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    )}
                    <label className="btn-secondary flex items-center gap-2 cursor-pointer text-sm">
                      <FileUp className="w-4 h-4" />
                      {uploaded ? 'Remplacer' : 'Choisir'}
                      <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => handleFile(dt.value, e.target.files[0])} />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button type="button" onClick={prev} disabled={step === 0} className="btn-secondary flex items-center gap-2 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> Précédent
          </button>
          {step < FORM_SECTIONS.length - 1 ? (
            <button type="button" onClick={next} className="btn-primary flex items-center gap-2">
              Suivant <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={saving} className="btn-primary flex items-center gap-2">
              <Check className="w-4 h-4" />
              {saving ? 'Submitting...' : (isParent ? 'Submit for school review' : 'Soumettre l\'inscription')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
