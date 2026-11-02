import {
  proclamationColumns,
  proclamationContextLine,
  proclamationIssuedLine,
  proclamationModelLine,
  proclamationPlaceLine,
  proclamationSchoolHeading,
  proclamationSheets,
  proclamationSheetTitle,
} from '../../lib/proclamationExport';

function clean(value) {
  return String(value ?? '').trim();
}

function fmtNum(value, digits = 1) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return '';
  if (digits === 0 || Number.isInteger(n)) return String(n);
  return n.toFixed(digits);
}

function countCell(group, key) {
  const value = group?.[key];
  return value == null ? '' : String(value);
}

function ProclamationArticle({ report }) {
  const rows = report.rows || [];
  const columns = proclamationColumns(report);
  const teacher = clean(report.meta?.classTeacher);
  const country = clean(report.meta?.country || 'RWANDA').toUpperCase();
  const summary = report.summary || {};
  const modelLine = proclamationModelLine(report);

  const displayValue = (student, index, column) => {
    if (column.kind === 'sn') return index + 1;
    if (column.kind === 'text') return clean(student.studentId);
    if (column.kind === 'name') return clean(student[column.key]).toUpperCase();
    if (column.kind === 'gender') return clean(student.gender);
    if (column.kind === 'count') return fmtNum(student[column.key], 0);
    return fmtNum(student[column.key]);
  };

  return (
    <article className="proclamation-sheet">
      <header className="proclamation-head">
        <p className="proclamation-school">{proclamationSchoolHeading(report.meta?.schoolName, report.meta?.city)}</p>
        <p className="proclamation-place">{proclamationPlaceLine(report.meta)}</p>
        <p className="proclamation-country">{country}</p>
        <h2>{proclamationSheetTitle(report.term)}</h2>
        {modelLine && <p className="proclamation-model">{modelLine}</p>}
        <p>Classe : {clean(report.class?.name)}</p>
        <p>Année scolaire : {clean(report.meta?.academicYear)}</p>
        <p>{proclamationContextLine(report)}</p>
      </header>

      <div className="proclamation-table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => <th key={column.key}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="proclamation-empty">Aucun élève</td>
              </tr>
            )}
            {rows.map((student, index) => (
              <tr key={student.id || student.studentId || index}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.kind === 'text' || column.kind === 'name' ? undefined : 'num'}
                  >
                    {displayValue(student, index, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="proclamation-foot">
        <div>
          <p className="proclamation-date">{proclamationIssuedLine(report.meta)}</p>
          <p className="proclamation-sign">
            {teacher && <strong>{teacher}</strong>}
            <span>Noms et Signature de l&apos;enseignant titulaire de la classe</span>
          </p>
        </div>
        <table className="proclamation-summary">
          <tbody>
            <tr>
              <th>Moyenne</th>
              <td colSpan={2}>{fmtNum(summary.average)}</td>
            </tr>
            <tr>
              <th rowSpan={3}>Succès</th>
              <td>F</td>
              <td>{countCell(summary.success, 'F')}</td>
            </tr>
            <tr>
              <td>M</td>
              <td>{countCell(summary.success, 'M')}</td>
            </tr>
            <tr>
              <td>Total</td>
              <td>{countCell(summary.success, 'total')}</td>
            </tr>
            <tr>
              <th rowSpan={3}>échec</th>
              <td>F</td>
              <td>{countCell(summary.failed, 'F')}</td>
            </tr>
            <tr>
              <td>M</td>
              <td>{countCell(summary.failed, 'M')}</td>
            </tr>
            <tr>
              <td>Total</td>
              <td>{countCell(summary.failed, 'total')}</td>
            </tr>
            <tr>
              <th rowSpan={3}>Non classés</th>
              <td>F</td>
              <td>{countCell(summary.unclassified, 'F')}</td>
            </tr>
            <tr>
              <td>M</td>
              <td>{countCell(summary.unclassified, 'M')}</td>
            </tr>
            <tr>
              <td>Total</td>
              <td>{countCell(summary.unclassified, 'total')}</td>
            </tr>
          </tbody>
        </table>
      </footer>
    </article>
  );
}

export default function ProclamationSheet({ report, sheetRef }) {
  if (!report) return null;
  const sheets = proclamationSheets(report);
  return (
    <div ref={sheetRef} className="proclamation-sheet-stack">
      {sheets.map((sheet) => (
        <ProclamationArticle key={sheet.template || 'fiche'} report={sheet} />
      ))}
    </div>
  );
}
