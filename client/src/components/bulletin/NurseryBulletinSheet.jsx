import { Fragment } from 'react';
import { User } from 'lucide-react';
import BulletinQrCode from './BulletinQrCode';
import BulletinDirectorStamp from './BulletinDirectorStamp';

const GRADE_COLORS = {
  A: 'nursery-grade-a',
  B: 'nursery-grade-b',
  C: 'nursery-grade-c',
  D: 'nursery-grade-d',
};

const DEFAULT_FULL_YEAR_COLUMNS = [
  { key: 't1', label: '1er Trim.' },
  { key: 't2', label: '2ème Trim.' },
  { key: 't3', label: '3ème Trim.' },
  { key: 'annual', label: 'Annuel' },
];

function shortColumnLabel(label, isFullYear) {
  if (!isFullYear) return label;
  const map = {
    '1er Trimestre': '1er Trim.',
    '2ème Trimestre': '2ème Trim.',
    '3ème Trimestre': '3ème Trim.',
    'Résultat Annuel': 'Annuel',
  };
  return map[label] || label;
}

function GradeCell({ letter }) {
  if (!letter) return <td className="nursery-grade-cell" />;
  return (
    <td className={`nursery-grade-cell ${GRADE_COLORS[letter] || ''}`}>
      <span>{letter}</span>
    </td>
  );
}

function parentLine(student) {
  const father = String(student?.fatherName || '').trim();
  const mother = String(student?.motherName || '').trim();
  if (father && mother) return `${father} / ${mother}`;
  return father || mother || String(student?.parentName || '').trim();
}

export default function NurseryBulletinSheet({ report, id = 'nursery-bulletin-sheet' }) {
  if (!report) return null;

  const { student, class: cls, domains = [], meta, photoUrl, verification } = report;
  const columns = report.columns?.length
    ? report.columns
    : report.viewMode === 'FULL_YEAR'
      ? DEFAULT_FULL_YEAR_COLUMNS
      : [{ key: 't1', label: report.termLabel || report.term || 'Trimestre' }];

  const colSpan = 2 + columns.length;
  const isFullYear = report.viewMode === 'FULL_YEAR' || columns.length > 1;

  const schoolBase = (meta?.schoolName || 'LA RACINE')
    .replace(/^\s*ecole\s+/i, '')
    .replace(/\s*school\s*$/i, '')
    .trim()
    .toUpperCase();

  const studentName = [student.lastName, student.postName, student.firstName]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
  const guardianLine = parentLine(student);

  const gradeLabels = report.config?.gradeScale || {
    A: 'Très bon travail',
    B: 'Bon travail',
    C: 'Moyen',
    D: 'Doit fournir des efforts',
  };

  const titleSuffix = isFullYear
    ? (meta?.academicYear ? ` — ${meta.academicYear}` : ' — ANNÉE COMPLÈTE')
    : ` — ${String(report.termLabel || report.term || '').toUpperCase()}`;

  const skillCount = domains.reduce(
    (n, d) => n + d.subdomains.reduce((m, s) => m + s.items.length, 0),
    0,
  );
  // Prefer readable type; PDF may span 2 pages rather than crushing text
  const density = skillCount > 60 ? 'dense' : skillCount > 42 ? 'normal' : 'roomy';

  return (
    <div
      id={id}
      className={[
        'nursery-bulletin-sheet',
        'nursery-bulletin-a4',
        isFullYear ? 'nursery-bulletin-full-year' : 'nursery-bulletin-term',
        `nursery-density-${density}`,
      ].join(' ')}
    >
      <div className="nursery-bulletin-watermark" aria-hidden="true">
        <img src="/logo.png" alt="" />
      </div>

      <div className="nursery-bulletin-inner">
        <header className="nursery-bulletin-header">
          <div className="nursery-bulletin-header-logo">
            <img src="/logo.png" alt="École La RACINE logo" />
          </div>
          <div className="nursery-bulletin-header-center">
            <h1>ECOLE {schoolBase}</h1>
            <p className="nursery-bulletin-place">
              {(meta?.district || 'RUBAVU').toUpperCase()} — {(meta?.city || 'GISENYI').toUpperCase()}
            </p>
            <p className="nursery-bulletin-contacts">
              Tel: {(meta?.phone || '(250) 723-908-058, 784-211-083')} · {(meta?.website || 'www.laracine.rw')}
            </p>
          </div>
          <div className="nursery-bulletin-header-photo">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`Photo de ${student.firstName} ${student.lastName}`}
                className="nursery-student-photo"
              />
            ) : (
              <div className="nursery-student-photo nursery-student-photo-placeholder" aria-hidden="true">
                <User className="w-6 h-6 text-gray-300" />
              </div>
            )}
          </div>
        </header>

        <div className="nursery-bulletin-info">
          <div><span>Nom de l&apos;élève</span>{studentName}</div>
          <div><span>Classe</span>{cls?.name || ''} ({cls?.grade || ''})</div>
          <div><span>Matricule</span>{student.studentId}</div>
          <div><span>Enseignant(e)</span>{meta?.classTeacher || '—'}</div>
          {guardianLine ? (
            <div className="nursery-bulletin-parent"><span>Parent / tuteur</span>{guardianLine}</div>
          ) : null}
        </div>

        <h2 className="nursery-bulletin-title">
          SUIVI DES ACQUIS SCOLAIRE DE L&apos;ÉLÈVE{titleSuffix}
        </h2>

        <div className="nursery-table-wrap">
          <table className="nursery-bulletin-table">
            <thead>
              <tr>
                <th className="col-domain">Domaine d&apos;apprentissage</th>
                <th className="col-element">Principaux éléments du programme</th>
                {columns.map((col) => (
                  <th key={col.key} className="col-term">
                    {shortColumnLabel(col.label, isFullYear)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => {
                const flatItems = domain.subdomains.flatMap((sub) =>
                  sub.items.map((item, idx) => ({
                    ...item,
                    subdomain: sub.name || '',
                    isFirstInSub: idx === 0,
                    subRowSpan: sub.items.length,
                  })),
                );
                return (
                  <Fragment key={domain.category}>
                    <tr className="nursery-domain-row">
                      <td colSpan={colSpan}>{domain.category}</td>
                    </tr>
                    {flatItems.map((item) => (
                      <tr key={item.id} className="nursery-skill-row">
                        {item.isFirstInSub && (
                          <td className="nursery-subdomain-cell" rowSpan={item.subRowSpan}>
                            {item.subdomain}
                          </td>
                        )}
                        <td className="nursery-element-cell">{item.name}</td>
                        {columns.map((col) => (
                          <GradeCell key={col.key} letter={item.grades?.[col.key]} />
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="nursery-bulletin-bottom">
          {isFullYear && (
            <div className="nursery-bulletin-decision">
              <span>Décision :</span>
              <label><span className="checkbox" /> Promu(e)</label>
              <label><span className="checkbox" /> Deuxième session</label>
              <label><span className="checkbox" /> Il est conseillé de répéter</label>
              <label><span className="checkbox" /> Abandonné</label>
            </div>
          )}

          <div className="nursery-bulletin-legend">
            <span className="nursery-legend-label">Légende :</span>
            {Object.entries(gradeLabels).map(([letter, label]) => (
              <div key={letter} className={`nursery-legend-item ${GRADE_COLORS[letter]}`}>
                <strong>{letter}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="nursery-bulletin-comment">
            <span>Commentaire de l&apos;enseignante :</span>
            <div className="nursery-comment-lines" />
          </div>

          <div className="nursery-bulletin-signatures">
            <div className="nursery-sig">
              <p className="nursery-sig-label">Signature de l&apos;enseignante</p>
              {meta?.classTeacher && <p className="sig-name">{meta.classTeacher}</p>}
            </div>
            <div className="nursery-sig">
              <p className="nursery-sig-label">Signature du parent / responsable</p>
              {guardianLine ? <p className="sig-name">{guardianLine}</p> : null}
            </div>
            <div className="nursery-sig nursery-sig-director">
              <p className="nursery-sig-label">Sceau et signature de la direction</p>
              <BulletinDirectorStamp compact />
            </div>
            {verification?.verifyUrl && (
              <div className="nursery-bulletin-qr">
                <BulletinQrCode value={verification.verifyUrl} size={48} />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="bulletin-print-folio" aria-hidden="true" />
    </div>
  );
}
