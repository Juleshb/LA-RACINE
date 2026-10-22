import {
  proclamationIssuedLine,
  proclamationPlaceLine,
  proclamationSchoolHeading,
  proclamationTermLabel,
} from '../../lib/proclamationExport';

function clean(value) {
  return String(value ?? '').trim();
}

function fmtPlace(student) {
  if (student?.place == null) return '';
  return student.totalStudents ? `${student.place}/${student.totalStudents}` : String(student.place);
}

function fmtNum(value, digits = 1) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return '';
  if (digits === 0 || Number.isInteger(n)) return String(n);
  return n.toFixed(digits);
}

const HEADERS = ['S/N', 'Place', "Id de l'élève", 'NOM', 'POST-NOM', 'PRENOM', 'Genre', 'Total', '%', 'échecs'];

export default function ProclamationSheet({ report }) {
  if (!report) return null;

  const rows = report.rows || [];
  const teacher = clean(report.meta?.classTeacher);
  const country = clean(report.meta?.country || 'RWANDA').toUpperCase();

  return (
    <article className="proclamation-sheet">
      <header className="proclamation-head">
        <p className="proclamation-school">{proclamationSchoolHeading(report.meta?.schoolName, report.meta?.city)}</p>
        <p className="proclamation-place">{proclamationPlaceLine(report.meta)}</p>
        <p className="proclamation-country">{country}</p>
        <h2>FICHE DE PROCLAMATION</h2>
        <p>Classe : {clean(report.class?.name)}</p>
        <p>Année scolaire : {clean(report.meta?.academicYear)}</p>
        <p>Trimestre : {proclamationTermLabel(report.term)}</p>
      </header>

      <div className="proclamation-table-wrap">
        <table>
          <thead>
            <tr>
              {HEADERS.map((label) => <th key={label}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={HEADERS.length} className="proclamation-empty">Aucun élève</td>
              </tr>
            )}
            {rows.map((student, index) => (
              <tr key={student.id || student.studentId || index}>
                <td className="num">{index + 1}</td>
                <td className="num">{fmtPlace(student)}</td>
                <td>{clean(student.studentId)}</td>
                <td>{clean(student.lastName).toUpperCase()}</td>
                <td>{clean(student.postName).toUpperCase()}</td>
                <td>{clean(student.firstName).toUpperCase()}</td>
                <td className="num">{clean(student.gender)}</td>
                <td className="num">{fmtNum(student.total)}</td>
                <td className="num">{fmtNum(student.percentage)}</td>
                <td className="num">{fmtNum(student.failures, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="proclamation-foot">
        <div>
          <p>{proclamationIssuedLine(report.meta)}</p>
          <p className="proclamation-sign">
            {teacher && <strong>{teacher}</strong>}
            <span>Noms et Signature de l&apos;enseignant titulaire de la classe</span>
          </p>
        </div>
        <dl>
          <div>
            <dt>Moyenne</dt>
            <dd>{fmtNum(report.summary?.average)}</dd>
          </div>
          <div>
            <dt>Succès</dt>
            <dd>{fmtNum(report.summary?.success, 0)}</dd>
          </div>
          <div>
            <dt>échec</dt>
            <dd>{fmtNum(report.summary?.failed, 0)}</dd>
          </div>
        </dl>
      </footer>
    </article>
  );
}
