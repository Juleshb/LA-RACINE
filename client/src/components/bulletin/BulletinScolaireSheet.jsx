import { Fragment } from 'react';
import { User } from 'lucide-react';
import BulletinQrCode from './BulletinQrCode';
import BulletinDirectorStamp from './BulletinDirectorStamp';

function fmtScore(col) {
  if (!col || col.max === 0) return '';
  if (col.score == null) return '';
  return String(col.score);
}

function fmtMax(col) {
  if (!col || col.max === 0) return '';
  return String(col.max);
}

function fmtPct(col) {
  if (!col || !col.max || col.score == null) return '';
  return `${Math.round((col.score / col.max) * 1000) / 10}%`;
}

function fmtPlace(place, totalStudents) {
  if (place == null) return '';
  return totalStudents != null ? `${place}/${totalStudents}` : String(place);
}

function parentLine(student) {
  const father = String(student?.fatherName || '').trim();
  const mother = String(student?.motherName || '').trim();
  if (father && mother) return `${father} / ${mother}`;
  return father || mother || String(student?.parentName || '').trim();
}

function cell(score, max) {
  if (max == null || max === 0) {
    if (score == null) return { score: null, max: 0 };
    return { score, max: 0 };
  }
  return { score: score ?? null, max };
}

function addCells(a, b) {
  const max = (a?.max || 0) + (b?.max || 0);
  const hasScore = a?.score != null || b?.score != null;
  const score = hasScore ? (a?.score || 0) + (b?.score || 0) : null;
  return { score: max ? score : null, max };
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

function midtermSubjectMap(midterms) {
  const map = { mt1: new Map(), mt2: new Map() };
  (midterms?.mt1?.subjects || []).forEach((s) => map.mt1.set(s.subjectId, s));
  (midterms?.mt2?.subjects || []).forEach((s) => map.mt2.set(s.subjectId, s));
  return map;
}

function midtermSubjectColumns(sub, maps) {
  const m1 = maps.mt1.get(sub.id);
  const m2 = maps.mt2.get(sub.id);
  const exam = sub.columns?.exam || cell(null, 0);

  // Same MAXIMA for MT1 and MT2 = subject continuous-tests max
  const fixedMax = Math.max(
    m1?.maxScore || 0,
    m2?.maxScore || 0,
    Number(sub.testsMarkMax) || 0,
    (Number(sub.test1Max) || 0) + (Number(sub.test2Max) || 0),
  );

  const mt1 = cell(m1?.obtained ?? null, fixedMax);
  const mt2 = cell(m2?.obtained ?? null, fixedMax);
  // TOT = cumulative midterm 2 (averaged continuous) + exam
  const continuous = mt2.score != null ? mt2 : mt1;
  const total = addCells(continuous, exam);
  return [mt1, mt2, exam, total];
}

function sumColumn(subjects, index, maps, midtermMode, courseMarkOnly) {
  return subjects.reduce((acc, sub) => {
    const cols = midtermMode
      ? midtermSubjectColumns(sub, maps)
      : (courseMarkOnly ? flexibleSubjectColumns(sub) : legacySubjectColumns(sub));
    return addCells(acc, cols[index] || cell(null, 0));
  }, cell(null, 0));
}

export default function BulletinScolaireSheet({ report, id = 'bulletin-scolaire-sheet' }) {
  if (!report) return null;

  const { student, class: cls, term, domains, summary, midterms, meta, photoUrl, verification } = report;
  const courseMarkOnly = Boolean(report.config?.courseMarkOnly);
  const midtermMode = Boolean(midterms?.mt1 || midterms?.mt2);
  const maps = midtermSubjectMap(midterms);

  const columnLabels = midtermMode
    ? ['P1', 'P2', 'EX', 'TOT']
    : (courseMarkOnly ? ['TEST', 'EX', 'TOT'] : ['TEST1', 'TEST2', 'EX', 'TOT']);
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
  const guardianLine = parentLine(student);
  const bulletinTitle = `BULLETIN SCOLAIRE - ${term}${meta?.academicYear ? ` ${meta.academicYear}` : ''}`.toUpperCase();

  const issuedDate = meta?.issuedAt
    ? new Date(meta.issuedAt).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  const termShort = term.replace(/trimestre\s*/i, '').trim() || '1';

  const subjectColumns = (sub) => {
    if (midtermMode) return midtermSubjectColumns(sub, maps);
    return courseMarkOnly ? flexibleSubjectColumns(sub) : legacySubjectColumns(sub);
  };

  const domainColumnsFor = (domain) => {
    if (midtermMode) {
      return [0, 1, 2, 3].map((i) => sumColumn(domain.subjects, i, maps, true, false));
    }
    if (courseMarkOnly) {
      return [
        domain.domainColumns?.tests,
        domain.domainColumns?.exam,
        domain.domainColumns?.total,
      ];
    }
    return [
      domain.domainColumns?.test1,
      domain.domainColumns?.test2,
      domain.domainColumns?.exam,
      domain.domainColumns?.total,
    ];
  };

  const allSubjects = domains.flatMap((d) => d.subjects);
  const summaryColumns = midtermMode
    ? [0, 1, 2, 3].map((i) => sumColumn(allSubjects, i, maps, true, false))
    : (courseMarkOnly
      ? [summary.columns?.tests, summary.columns?.exam, summary.columns?.total]
      : [summary.columns?.test1, summary.columns?.test2, summary.columns?.exam, summary.columns?.total]);

  const mt1Place = midterms?.mt1?.standing;
  const mt2Place = midterms?.mt2?.standing;

  // Pourcentage / Place: values only under période/test columns; EX + TOT are merged and empty
  const periodValueCount = courseMarkOnly && !midtermMode ? 1 : Math.max(0, columnSpan - 2);
  const periodPctColumns = summaryColumns.slice(0, periodValueCount);
  const periodPlaceColumns = midtermMode
    ? [
      fmtPlace(mt1Place?.place, mt1Place?.totalStudents),
      fmtPlace(mt2Place?.place, mt2Place?.totalStudents),
    ].slice(0, periodValueCount)
    : periodPctColumns.map(() => '');
  const exTotColSpan = Math.max(0, columnSpan - periodValueCount);

  return (
    <div id={id} className={`bulletin-scolaire-sheet ${midtermMode ? 'bulletin-has-midterms' : ''}`}>
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
          {guardianLine ? <p className="bulletin-student-parent">Parent : {guardianLine}</p> : null}
          <p className="bulletin-student-class">{classLine}</p>
          <p className="bulletin-student-title">{bulletinTitle}</p>
        </div>

        <table className="bulletin-table">
          <thead>
            <tr>
              <th rowSpan={2} className="col-cours">COURS</th>
              <th rowSpan={2} className="col-subject" />
              <th colSpan={columnSpan} className="group-header">MAXIMA</th>
              <th colSpan={columnSpan} className="group-header">
                {`trimestre ${termShort}`}
              </th>
            </tr>
            <tr>
              {columnLabels.map((label) => (
                <th key={`max-${label}`} className={label.startsWith('P') ? 'th-midterm' : undefined}>{label}</th>
              ))}
              {columnLabels.map((label) => (
                <th key={`score-${label}`} className={label.startsWith('P') ? 'th-midterm' : undefined}>{label}</th>
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
                  {domainColumnsFor(domain).map((col, colIdx) => (
                    <td key={`${domain.category}-max-${colIdx}`} className="num font-bold">{fmtMax(col)}</td>
                  ))}
                  {domainColumnsFor(domain).map((col, colIdx) => (
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
              <td colSpan={2 + columnSpan} className="font-bold text-right">Pourcentage</td>
              {periodPctColumns.map((col, colIdx) => (
                <td key={`pct-score-${colIdx}`} className="num font-bold">{fmtPct(col)}</td>
              ))}
              {exTotColSpan > 0 && (
                <td colSpan={exTotColSpan} className="num font-bold" />
              )}
            </tr>
            <tr className="summary-row midterm-place-row">
              <td colSpan={2 + columnSpan} className="font-bold text-right">Place</td>
              {periodPlaceColumns.map((value, colIdx) => (
                <td key={`place-score-${colIdx}`} className="num font-bold">{value}</td>
              ))}
              {exTotColSpan > 0 && (
                <td colSpan={exTotColSpan} className="num font-bold" />
              )}
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
            {guardianLine ? <p className="sig-name">{guardianLine}</p> : null}
          </div>
          <div className="bulletin-sig-box bulletin-sig-director">
            <p>Fait à {meta?.city?.toUpperCase() || 'GISENYI'}, le {issuedDate}</p>
            <p className="bulletin-cachet-hint">( Cachet et signature )</p>
            <BulletinDirectorStamp compact />
          </div>
        </div>

        <footer className="bulletin-footer">
          <p className="bulletin-footer-text">
            Proclamation générée par École La RACINE Management — Scannez le QR pour vérifier
          </p>
          {verification?.verifyUrl && (
            <div className="bulletin-footer-qr">
              <BulletinQrCode value={verification.verifyUrl} size={52} />
            </div>
          )}
        </footer>
      </div>
      <div className="bulletin-print-folio" aria-hidden="true" />
    </div>
  );
}
