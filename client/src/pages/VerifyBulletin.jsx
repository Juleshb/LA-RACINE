import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, ShieldCheck, Loader2 } from 'lucide-react';
import Logo from '../components/Logo';
import { getApiBase } from '../lib/config';

const API_BASE = getApiBase();

export default function VerifyBulletin() {
  const { token } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Missing verification code');
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/verify/bulletin/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        setResult(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const issuedDate = result?.issuedAt
    ? new Date(result.issuedAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/60 via-white to-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <Logo size="md" showSubtitle={false} />
        </div>

        <div className="card shadow-lg border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Vérification du bulletin</h1>
              <p className="text-sm text-gray-500">Authenticité du bulletin scolaire</p>
            </div>
          </div>

          {loading && (
            <div className="py-10 text-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-brand-500" />
              Vérification en cours…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-center">
              <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="font-semibold text-red-700">Bulletin non vérifié</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          )}

          {!loading && result?.valid && (
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-800">Bulletin authentique</p>
                  <p className="text-sm text-emerald-700 mt-1">
                    Ce bulletin a été émis par {result.school?.name}
                    {result.school?.campus ? ` — ${result.school.campus}` : ''}.
                  </p>
                  {!result.matchesCurrent && (
                    <p className="text-xs text-amber-700 mt-2">
                      Les notes peuvent avoir été mises à jour depuis l&apos;émission de ce bulletin.
                    </p>
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Élève</dt>
                  <dd className="font-medium text-right">{result.student?.name}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Code</dt>
                  <dd className="font-medium text-right">{result.student?.code}</dd>
                </div>
                {result.class && (
                  <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">Classe</dt>
                    <dd className="font-medium text-right">
                      {result.class.grade} ({result.class.section}) — {result.class.name}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Trimestre</dt>
                  <dd className="font-medium text-right">{result.term}</dd>
                </div>
                {result.academicYear && (
                  <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">Année scolaire</dt>
                    <dd className="font-medium text-right">{result.academicYear}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Pourcentage</dt>
                  <dd className="font-medium text-right">
                    {result.percentage != null ? `${result.percentage}%` : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Place</dt>
                  <dd className="font-medium text-right">
                    {result.place != null ? `${result.place}/${result.totalStudents}` : '—'}
                  </dd>
                </div>
                {issuedDate && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Émis le</dt>
                    <dd className="font-medium text-right">{issuedDate}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <Link to="/login" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              Accéder au portail scolaire
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
