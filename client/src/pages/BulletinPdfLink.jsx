import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import BulletinScolaireSheet from '../components/bulletin/BulletinScolaireSheet';
import NurseryBulletinSheet from '../components/bulletin/NurseryBulletinSheet';
import { downloadBulletinPdf } from '../lib/bulletinPdf';
import { getApiBase } from '../lib/config';

export default function BulletinPdfLink() {
  const { token } = useParams();
  const sheetRef = useRef(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Lien de bulletin manquant');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${getApiBase()}/verify/bulletin-pdf/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Bulletin introuvable');
        return data;
      })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  const handleDownload = async () => {
    const element = sheetRef.current?.querySelector('.bulletin-scolaire-sheet, .nursery-bulletin-sheet')
      || sheetRef.current;
    if (!element) return;
    setDownloading(true);
    setError('');
    try {
      const student = report?.student || {};
      const name = [student.lastName, student.firstName].filter(Boolean).join('-') || 'bulletin';
      await downloadBulletinPdf(element, `bulletin-${name}.pdf`);
    } catch (err) {
      setError(err.message || 'Le PDF n’a pas pu être créé');
    } finally {
      setDownloading(false);
    }
  };

  const Sheet = report?.mode === 'COMPETENCE' ? NurseryBulletinSheet : BulletinScolaireSheet;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">École La RACINE</p>
            <h1 className="text-xl font-bold text-slate-900">Bulletin scolaire</h1>
          </div>
          {report && (
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Télécharger le PDF
            </button>
          )}
        </div>

        {loading && (
          <div className="card flex items-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Ouverture du bulletin…
          </div>
        )}

        {!loading && error && (
          <div className="card border border-red-100 bg-red-50 text-red-700">{error}</div>
        )}

        {report && (
          <div ref={sheetRef} className="overflow-x-auto bg-white shadow-sm">
            <Sheet report={report} />
          </div>
        )}
      </div>
    </div>
  );
}
