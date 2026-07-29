import { Fragment } from 'react';
import { User } from 'lucide-react';
import BulletinQrCode from './BulletinQrCode';

function fmtScore(col) {
  if (!col || col.max === 0) return '';
  if (col.score == null) return '';
  return String(col.score);
}

function fmtMax(col) {
  if (!col || col.max === 0) return '';
  return String(col.max);
}

function legacySubjectColumns(sub) {
  return [
    sub.columns?.test1,
    sub.columns?.test2,
    sub.columns?.exam,
    sub.columns?.total,
  ];
}

function flexibleSubjectColumns(sub) {
  return [
    sub.columns?.tests,
    sub.columns?.exam,
    sub.columns?.total,
  ];
}

function legacyDomainColumns(domainColumns) {
  return legacySubjectColumns({ columns: domainColumns });
}

function flexibleDomainColumns(domainColumns) {
  return [
    domainColumns.tests,
    domainColumns.exam,
    domainColumns.total,
  ];
}

export default function BulletinScolaireSheet({ report, id = 'bulletin-scolaire-sheet' }) {
  if (!report) return null;

  const { student, class: cls, term, domains, summary, rank, meta, photoUrl, verification } = report;
  const courseMarkOnly = Boolean(report.config?.courseMarkOnly);
  const columnLabels = courseMarkOnly ? ['TEST', 'EX', 'TOT'] : ['TEST1', 'TEST2', 'EX', 'TOT'];
  const columnSpan = columnLabels.length;

  const schoolBase = (meta?.schoolName || 'LA RACINE')
    .replace(/\s*school\s*$/i, '')
    .trim()
    .toUpperCase();
  const schoolTitle = meta?.campusName
    ? `ECOLE ${schoolBase} DE ${meta.campusName.toUpperCase()}`
    : `ECOLE ${schoolBase}`;

  const locationLine = [meta?.city, meta?.district, meta?.country || 'Rwanda'].filter(Boolean).join(' - ');
  const studentLine = [
    student.studentId,
    student.firstName,
    student.lastName,
    student.postName,
  ].filter(Boolean).join(' ').toUpperCase();

  const classLine = `${cls.grade} (${cls.section}) - ${cls.name}`.toUpperCase();
  const bulletinTitle = `BULLETIN SCOLAIRE - ${term}${meta?.academicYear ? ` ${meta.academicYear}` : ''}`.toUpperCase();

  const issuedDate = meta?.issuedAt
    ? new Date(meta.issuedAt).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  const termShort = term.replace(/trimestre\s*/i, '').trim() || '1';

  const summaryColumns = courseMarkOnly
    ? flexibleDomainColumns(summary.columns)
    : legacySubjectColumns({ columns: summary.columns });

  const footerColSpan = 2 + columnSpan;

  const subjectColumns = (sub) => (
    courseMarkOnly ? flexibleSubjectColumns(sub) : legacySubjectColumns(sub)
  );

  const domainColumns = (cols) => (
    courseMarkOnly ? flexibleDomainColumns(cols) : legacyDomainColumns(cols)
  );

  return (
    <div id={id} className="bulletin-scolaire-sheet">
      <div className="bulletin-watermark" aria-hidden="true">
        <img src="/logo.png" alt="" />
      </div>

      <div className="bulletin-sheet-inner">
        <header className="bulletin-header">
          <div className="bulletin-header-logo">
            <img src="/logo.png" alt="School logo" />
          </div>
          <div className="bulletin-header-center">
            <h1>{schoolTitle}</h1>
            <p>{locationLine}</p>
          </div>
          <div className="bulletin-header-photo">
            {photoUrl ? (
              <img src={photoUrl} alt={`Photo de ${student.firstName} ${student.lastName}`} className="bulletin-student-photo" />
            ) : (
              <div className="bulletin-student-photo bulletin-student-photo-placeholder" aria-hidden="true">
                <User className="w-8 h-8 text-gray-300" />
              </div>
            )}
          </div>
        </header>

        <div className="bulletin-student-bar">
          <p className="bulletin-student-name">{studentLine}</p>
          <p className="bulletin-student-class">{classLine}</p>
          <p className="bulletin-student-title">{bulletinTitle}</p>
        </div>

        <table className="bulletin-table">
          <thead>
            <tr>
              <th rowSpan={2} className="col-cours">COURS</th>
              <th rowSpan={2} className="col-subject" />
              <th colSpan={columnSpan} className="group-header">MAXIMA</th>
              <th colSpan={columnSpan} className="group-header">trimestre {termShort}</th>
            </tr>
            <tr>
              {columnLabels.map((label) => (
                <th key={`max-${label}`}>{label}</th>
              ))}
              {columnLabels.map((label) => (
                <th key={`score-${label}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {domains.map((domain) => (
              <Fragment key={domain.category}>
                {domain.subjects.map((sub, idx) => {
                  const cols = subjectColumns(sub);
                  return (
                    <tr key={sub.id}>
                      {idx === 0 && (
                        <td rowSpan={domain.subjects.length + 1} className="domain-cell">
                          {domain.category}
                        </td>
                      )}
                      <td className="subject-cell">{sub.name}</td>
                      {cols.map((col, colIdx) => (
                        <td key={`${sub.id}-max-${colIdx}`} className="num">{fmtMax(col)}</td>
                      ))}
                      {cols.map((col, colIdx) => (
                        <td key={`${sub.id}-score-${colIdx}`} className="num">{fmtScore(col)}</td>
                      ))}
                    </tr>
                  );
                })}
                <tr key={`${domain.category}-total`} className="domain-total-row">
                  <td className="subject-cell font-bold">Total</td>
                  {domainColumns(domain.domainColumns).map((col, colIdx) => (
                    <td key={`${domain.category}-max-${colIdx}`} className="num font-bold">{fmtMax(col)}</td>
                  ))}
                  {domainColumns(domain.domainColumns).map((col, colIdx) => (
                    <td key={`${domain.category}-score-${colIdx}`} className="num font-bold">{fmtScore(col)}</td>
                  ))}
                </tr>
              </Fragment>
            ))}
            <tr className="grand-total-row">
              <td colSpan={2} className="font-bold text-right">Total</td>
              {summaryColumns.map((col, colIdx) => (
                <td key={`grand-max-${colIdx}`} className="num font-bold">{fmtMax(col)}</td>
              ))}
              {summaryColumns.map((col, colIdx) => (
                <td key={`grand-score-${colIdx}`} className="num font-bold">{fmtScore(col)}</td>
              ))}
            </tr>
            <tr className="summary-row">
              <td colSpan={footerColSpan - 2} className="font-bold text-right">Pourcentage</td>
              <td colSpan={2} className="num font-bold">
                {summary.percentage != null ? `${summary.percentage}%` : '—'}
              </td>
            </tr>
            <tr className="summary-row">
              <td colSpan={footerColSpan - 2} className="font-bold text-right">Place</td>
              <td colSpan={2} className="num font-bold">
                {rank?.place != null ? `${rank.place}/${rank.totalStudents}` : '—'}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="bulletin-decisions">
          <label><span className="checkbox" /> Promu(e)</label>
          <label><span className="checkbox" /> Redoublement</label>
          <label><span className="checkbox" /> Admis(e) ailleurs</label>
          <label><span className="checkbox" /> Redoublement ailleurs</label>
        </div>

        <div className="bulletin-signatures">
          <div className="bulletin-sig-box">
            <p>Signature du titulaire de la classe</p>
            {meta?.classTeacher && <p className="sig-name">{meta.classTeacher}</p>}
          </div>
          <div className="bulletin-sig-box">
            <p>Signature du parent</p>
          </div>
          <div className="bulletin-sig-box bulletin-sig-director">
            <p>Fait à {meta?.city?.toUpperCase() || 'GISENYI'}, le {issuedDate}</p>
            <p>( Cachet et signature )</p>
            <p className="sig-director">Le Directeur</p>
          </div>
        </div>

        <footer className="bulletin-footer">
          <p className="bulletin-footer-text">
            Proclamation générée par École La RACINE Management — Scannez le QR pour vérifier
          </p>
          {verification?.verifyUrl && (
            <div className="bulletin-footer-qr">
              <BulletinQrCode value={verification.verifyUrl} size={72} />
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
