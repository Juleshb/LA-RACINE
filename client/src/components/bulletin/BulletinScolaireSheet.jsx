import { Fragment } from 'react';
import { User } from 'lucide-react';
import BulletinQrCode from './BulletinQrCode';
import BulletinDirectorStamp from './BulletinDirectorStamp';
import { periodExamColumns } from '../../lib/bulletinMaxima';
import { reportSchoolTitle } from '../../lib/reportSchoolTitle';

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
  const continuous = m2?.obtained != null ? m2 : (m1?.obtained != null ? m1 : null);
  return periodExamColumns({
    period1Max: sub.test1Max ?? sub.columns?.test1?.max,
    period2Max: sub.test2Max ?? sub.columns?.test2?.max,
    testsMax: sub.testsMarkMax,
    examMax: exam.max,
    examScore: exam.score,
    period1Score: m1?.obtained ?? null,
    period1ScoreMax: m1?.maxScore,
    period2Score: m2?.obtained ?? null,
    period2ScoreMax: m2?.maxScore,
    continuousScore: continuous?.obtained ?? null,
    continuousScoreMax: continuous?.maxScore,
  }).cells;
}

function sumColumn(subjects, index, maps, midtermMode, courseMarkOnly) {
  return subjects.reduce((acc, sub) => {
    const cols = midtermMode
      ? midtermSubjectColumns(sub, maps)
      : (courseMarkOnly ? flexibleSubjectColumns(sub) : legacySubjectColumns(sub));
    return addCells(acc, cols[index] || cell(null, 0));
  }, cell(null, 0));
}

function periodColumnLabels(term, midtermMode, courseMarkOnly) {
  if (courseMarkOnly && !midtermMode) return ['Période', 'Ex', 'Tot'];
  if (!midtermMode) return ['Période', 'Période', 'Ex', 'Tot'];
  const t = String(term || '');
  if (/3/.test(t)) return ['5eP', '6eP', 'Ex', 'Tot'];
  if (/2/.test(t)) return ['3eP', '4eP', 'Ex', 'Tot'];
  return ['1eP', '2eP', 'Ex', 'Tot'];
}

function maximaColumnLabels(midtermMode, courseMarkOnly) {
  if (courseMarkOnly && !midtermMode) return ['Période', 'Ex', 'Tot'];
  return ['Période', 'Période', 'Ex', 'Tot'];
}

function columnsFromSummary(summaryColumns, midtermMode, courseMarkOnly, subjects, maps) {
  if (midtermMode) {
    return [0, 1, 2, 3].map((i) => sumColumn(subjects, i, maps, true, false));
  }
  if (courseMarkOnly) {
    return [summaryColumns?.tests, summaryColumns?.exam, summaryColumns?.total];
  }
  return [summaryColumns?.test1, summaryColumns?.test2, summaryColumns?.exam, summaryColumns?.total];
}

function showDomainSubtotal(domain, index, list) {
  if (domain.excludeFromGeneral) return false;
  if (!domain.subtotalGroup) return true;
  const next = list[index + 1];
  return !next || next.subtotalGroup !== domain.subtotalGroup;
}

function domainsForSubtotal(domain, index, list) {
  if (!domain.subtotalGroup) return [domain];
  const group = domain.subtotalGroup;
  let start = index;
  while (start > 0 && list[start - 1].subtotalGroup === group) start -= 1;
  return list.slice(start, index + 1);
}

export default function BulletinScolaireSheet({ report, id = 'bulletin-scolaire-sheet' }) {
  if (!report) return null;

  const { student, class: cls, term, domains, summary, midterms, meta, photoUrl, verification, rank, overallRank } = report;
  const annual = Boolean(report.annual);
  const yearTerms = report.year?.terms || [];
  const courseMarkOnly = Boolean(report.config?.courseMarkOnly);
  const midtermMode = Boolean(midterms?.mt1 || midterms?.mt2);
  const maps = midtermSubjectMap(midterms);

  const columnLabels = periodColumnLabels(term, midtermMode, courseMarkOnly);
  const maxLabels = maximaColumnLabels(
    annual ? yearTerms.some((t) => t.midterms?.mt1 || t.midterms?.mt2) : midtermMode,
    annual ? yearTerms.every((t) => t.courseMarkOnly) : courseMarkOnly,
  );
  const termLabelSets = annual
    ? yearTerms.map((t) => periodColumnLabels(t.term, Boolean(t.midterms?.mt1 || t.midterms?.mt2), t.courseMarkOnly))
    : [columnLabels];
  const columnSpan = annual ? (termLabelSets[0]?.length || 4) : columnLabels.length;

  const schoolTitle = reportSchoolTitle(meta?.schoolName);

  const locationLine = [meta?.city, meta?.district, meta?.country || 'Rwanda'].filter(Boolean).join(' - ').toUpperCase();
  const studentName = [student.lastName, student.postName, student.firstName].filter(Boolean).join(' ').toUpperCase();
  const classLine = `${cls.name || ''}`.toUpperCase() || `${cls.grade} ${cls.section || ''}`.toUpperCase();
  const guardianLine = parentLine(student);
  const yearLabel = meta?.academicYear || '';
  const bulletinTitle = `BULLETIN SCOLAIRE${yearLabel ? ` - ${yearLabel}` : ''}`.toUpperCase();

  const issuedDate = meta?.issuedAt
    ? new Date(meta.issuedAt).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  const subjectColumns = (sub) => {
    if (midtermMode) return midtermSubjectColumns(sub, maps);
    return courseMarkOnly ? flexibleSubjectColumns(sub) : legacySubjectColumns(sub);
  };

  const domainColumnsFor = (domainList) => {
    const subjects = domainList.flatMap((d) => d.subjects);
    if (midtermMode) {
      return [0, 1, 2, 3].map((i) => sumColumn(subjects, i, maps, true, false));
    }
    if (courseMarkOnly) {
      return subjects.reduce((acc, sub) => {
        acc[0] = addCells(acc[0], sub.columns?.tests || cell(null, 0));
        acc[1] = addCells(acc[1], sub.columns?.exam || cell(null, 0));
        acc[2] = addCells(acc[2], sub.columns?.total || cell(null, 0));
        return acc;
      }, [cell(null, 0), cell(null, 0), cell(null, 0)]);
    }
    return subjects.reduce((acc, sub) => {
      acc[0] = addCells(acc[0], sub.columns?.test1 || cell(null, 0));
      acc[1] = addCells(acc[1], sub.columns?.test2 || cell(null, 0));
      acc[2] = addCells(acc[2], sub.columns?.exam || cell(null, 0));
      acc[3] = addCells(acc[3], sub.columns?.total || cell(null, 0));
      return acc;
    }, [cell(null, 0), cell(null, 0), cell(null, 0), cell(null, 0)]);
  };

  const generalDomains = domains.filter((d) => !d.excludeFromGeneral);
  const otherDomains = domains.filter((d) => d.excludeFromGeneral);
  const generalSubjects = generalDomains.flatMap((d) => d.subjects);
  const otherSubjects = otherDomains.flatMap((d) => d.subjects);
  const allSubjects = domains.flatMap((d) => d.subjects);

  const generalColumns = columnsFromSummary(summary.general?.columns || summary.columns, midtermMode, courseMarkOnly, generalSubjects, maps);
  const otherColumns = columnsFromSummary(summary.otherLanguages?.columns, midtermMode, courseMarkOnly, otherSubjects, maps);
  const overallColumns = columnsFromSummary(summary.overall?.columns, midtermMode, courseMarkOnly, allSubjects, maps);

  const yearSummaryFor = (kind) => report.year?.summary?.[kind];
  const sumYearCells = (list, termIdx) => list.flatMap((d) => d.subjects).reduce((acc, sub) => {
    const cells = sub.year?.terms?.[termIdx]?.cells || [];
    return cells.map((col, i) => addCells(acc[i] || cell(null, 0), col || cell(null, 0)));
  }, []);
  const sumYearAnnual = (list) => list.flatMap((d) => d.subjects).reduce(
    (acc, sub) => addCells(acc, sub.year?.annual || cell(null, 0)),
    cell(null, 0),
  );

  const isTotCol = (len, i) => i === len - 1;

  const periodPlaceAt = (index, rankInfo, termMidterms) => {
    if ((termMidterms?.mt1 || termMidterms?.mt2) && index < 2) {
      const standing = index === 0 ? termMidterms.mt1?.standing : termMidterms.mt2?.standing;
      return fmtPlace(standing?.place, standing?.totalStudents);
    }
    return fmtPlace(rankInfo?.place, rankInfo?.totalStudents);
  };

  const renderPctGroup = (cols, keyPrefix) => cols.map((col, i) => (
    <td key={`${keyPrefix}-${i}`} className="num font-bold">{fmtPct(col)}</td>
  ));

  const renderPlaceGroup = (cols, rankInfo, termMidterms, keyPrefix) => cols.map((_, i) => (
    <td key={`${keyPrefix}-${i}`} className="num font-bold">
      {isTotCol(cols.length, i)
        ? fmtPlace(rankInfo?.place, rankInfo?.totalStudents)
        : periodPlaceAt(i, rankInfo, termMidterms)}
    </td>
  ));

  const renderCountGroup = (cols, count, keyPrefix) => cols.map((_, i) => (
    <td key={`${keyPrefix}-${i}`} className="num font-bold">{count}</td>
  ));

  const renderScoreTail = (key, maxCols, termGroups, annualCell) => (
    <>
      {maxCols.map((col, colIdx) => (
        <td key={`${key}-max-${colIdx}`} className="num">{fmtMax(col)}</td>
      ))}
      {termGroups.map((cols, gi) => cols.map((col, colIdx) => (
        <td key={`${key}-t${gi}-${colIdx}`} className="num">{fmtScore(col)}</td>
      )))}
      {annual && (
        <>
          <td key={`${key}-amax`} className="num">{fmtMax(annualCell)}</td>
          <td key={`${key}-apo`} className="num">{fmtScore(annualCell)}</td>
        </>
      )}
    </>
  );

  const subjectYearMax = (sub) => sub.year?.maxima || sub.year?.terms?.[0]?.cells || subjectColumns(sub);
  const subjectYearGroups = (sub) => (
    annual
      ? (sub.year?.terms || []).map((t) => t.cells || [])
      : [subjectColumns(sub)]
  );

  const domainYearMax = (domainList) => (
    annual
      ? domainList.flatMap((d) => d.subjects).reduce((acc, sub) => {
        const cells = sub.year?.maxima || sub.year?.terms?.[0]?.cells || [];
        return cells.map((col, i) => addCells(acc[i] || cell(null, 0), col || cell(null, 0)));
      }, [])
      : domainColumnsFor(domainList)
  );
  const domainYearGroups = (domainList) => (
    annual
      ? yearTerms.map((_, i) => sumYearCells(domainList, i))
      : [domainColumnsFor(domainList)]
  );

  const renderDomainBlock = (list) => list.map((domain, domainIdx) => {
    const showSubtotal = showDomainSubtotal(domain, domainIdx, list);
    const subtotalDomains = domainsForSubtotal(domain, domainIdx, list);
    const domainRowSpan = domain.subjects.length + (showSubtotal ? 1 : 0);
    return (
      <Fragment key={domain.category}>
        {domain.subjects.map((sub, idx) => (
          <tr key={sub.id}>
            {idx === 0 && (
              <td rowSpan={domainRowSpan} className="domain-cell">
                {domain.category}
              </td>
            )}
            <td className="subject-cell">{sub.name}</td>
            {renderScoreTail(
              sub.id,
              subjectYearMax(sub),
              subjectYearGroups(sub),
              sub.year?.annual,
            )}
          </tr>
        ))}
        {showSubtotal && (
          <tr key={`${domain.category}-total`} className="domain-total-row">
            <td className="subject-cell font-bold">{domain.subtotalLabel || 'Sous-total'}</td>
            {renderScoreTail(
              `${domain.category}-tot`,
              domainYearMax(subtotalDomains),
              domainYearGroups(subtotalDomains),
              sumYearAnnual(subtotalDomains),
            )}
          </tr>
        )}
      </Fragment>
    );
  });

  const renderTermSummaryCells = (labelPrefix, kind, rankInfo) => {
    if (!annual) {
      const cols = kind === 'overall' ? overallColumns : kind === 'other' ? otherColumns : generalColumns;
      return renderPctGroup(cols, `${labelPrefix}-pct`);
    }
    const packed = yearSummaryFor(kind === 'other' ? 'otherLanguages' : kind);
    return (
      <>
        {yearTerms.map((t, ti) => (
          <Fragment key={`${labelPrefix}-term-${ti}`}>
            {renderPctGroup(packed?.terms?.[ti]?.cells || [], `${labelPrefix}-t${ti}-pct`)}
          </Fragment>
        ))}
        <td className="num font-bold" />
        <td className="num font-bold">{fmtPct(packed?.annual)}</td>
      </>
    );
  };

  const renderTermPlaceCells = (labelPrefix, kind) => {
    if (!annual) {
      const cols = kind === 'overall' ? overallColumns : kind === 'other' ? otherColumns : generalColumns;
      const usedRank = kind === 'overall' ? (overallRank || rank) : rank;
      return renderPlaceGroup(cols, usedRank, midterms, `${labelPrefix}-place`);
    }
    return (
      <>
        {yearTerms.map((t, ti) => {
          const packed = yearSummaryFor(kind === 'other' ? 'otherLanguages' : kind);
          const termRank = kind === 'overall' ? (t.overallRank || t.rank) : t.rank;
          return (
            <Fragment key={`${labelPrefix}-place-${ti}`}>
              {renderPlaceGroup(packed?.terms?.[ti]?.cells || [], termRank, t.midterms, `${labelPrefix}-t${ti}-pl`)}
            </Fragment>
          );
        })}
        <td className="num font-bold" />
        <td className="num font-bold">{fmtPlace(kind === 'overall' ? overallRank?.place : rank?.place, rank?.totalStudents)}</td>
      </>
    );
  };

  const renderTermCountCells = (labelPrefix, kind) => {
    const count = (kind === 'overall' ? overallRank : rank)?.totalStudents || '';
    if (!annual) {
      const cols = kind === 'overall' ? overallColumns : kind === 'other' ? otherColumns : generalColumns;
      return renderCountGroup(cols, count, `${labelPrefix}-n`);
    }
    return (
      <>
        {yearTerms.map((t, ti) => {
          const packed = yearSummaryFor(kind === 'other' ? 'otherLanguages' : kind);
          const termCount = (kind === 'overall' ? t.overallRank : t.rank)?.totalStudents || count;
          return (
            <Fragment key={`${labelPrefix}-n-${ti}`}>
              {renderCountGroup(packed?.terms?.[ti]?.cells || [], termCount, `${labelPrefix}-t${ti}-n`)}
            </Fragment>
          );
        })}
        <td className="num font-bold" />
        <td className="num font-bold">{count}</td>
      </>
    );
  };

  const renderSummaryTriplet = (labelPrefix, kind, rankInfo) => (
    <>
      <tr className="summary-row">
        <td colSpan={2 + columnSpan} className="font-bold text-right">POURCENTAGE</td>
        {renderTermSummaryCells(labelPrefix, kind, rankInfo)}
      </tr>
      <tr className="summary-row midterm-place-row">
        <td colSpan={2 + columnSpan} className="font-bold text-right">PLACE</td>
        {renderTermPlaceCells(labelPrefix, kind)}
      </tr>
      <tr className="summary-row">
        <td colSpan={2 + columnSpan} className="font-bold text-right">NOMBRE D'ÉLÈVES</td>
        {renderTermCountCells(labelPrefix, kind)}
      </tr>
    </>
  );

  return (
    <div id={id} className={`bulletin-scolaire-sheet ${midtermMode ? 'bulletin-has-midterms' : ''} ${annual ? 'bulletin-is-annual' : ''}`}>
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
          <p className="bulletin-student-meta">ID DE L'ÉLÈVE : {student.studentId || '—'}</p>
          <p className="bulletin-student-name">NOM DE L'ÉLÈVE : {studentName}</p>
          <p className="bulletin-student-class">CLASSE : {classLine}</p>
          {guardianLine ? <p className="bulletin-student-parent">Parent : {guardianLine}</p> : null}
          <p className="bulletin-student-title">{bulletinTitle}</p>
          <p className="bulletin-student-term">{annual ? 'BULLETIN ANNUEL' : `TRIMESTRE : ${term}`}</p>
        </div>

        <table className="bulletin-table">
          <thead>
            <tr>
              <th rowSpan={2} className="col-cours">COURS</th>
              <th rowSpan={2} className="col-subject" />
              <th colSpan={columnSpan} className="group-header">MAXIMA</th>
              {annual ? yearTerms.map((t) => (
                <th key={t.term} colSpan={columnSpan} className="group-header">{t.term.toUpperCase()}</th>
              )) : (
                <th colSpan={columnSpan} className="group-header">{term.toUpperCase()}</th>
              )}
              {annual && <th colSpan={2} className="group-header">ANNUEL</th>}
            </tr>
            <tr>
              {maxLabels.map((label, i) => (
                <th key={`max-${label}-${i}`}>{label}</th>
              ))}
              {(annual ? termLabelSets : [columnLabels]).flatMap((labels, gi) => labels.map((label, i) => (
                <th key={`score-${gi}-${label}-${i}`} className={/eP$/i.test(label) ? 'th-midterm' : undefined}>{label}</th>
              )))}
              {annual && (
                <>
                  <th>MAX</th>
                  <th>P.O</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {renderDomainBlock(generalDomains)}
            <tr className="grand-total-row">
              <td colSpan={2} className="font-bold text-right">Total général</td>
              {renderScoreTail(
                'grand',
                annual ? (yearSummaryFor('general')?.maxima || generalColumns) : generalColumns,
                annual ? (yearSummaryFor('general')?.terms || []).map((t) => t.cells) : [generalColumns],
                yearSummaryFor('general')?.annual,
              )}
            </tr>
            {renderSummaryTriplet('general', 'general', rank)}
            {otherDomains.length > 0 && (
              <>
                {renderDomainBlock(otherDomains)}
                <tr className="domain-total-row">
                  <td colSpan={2} className="font-bold text-right">Total</td>
                  {renderScoreTail(
                    'other',
                    annual ? (yearSummaryFor('otherLanguages')?.maxima || otherColumns) : otherColumns,
                    annual ? (yearSummaryFor('otherLanguages')?.terms || []).map((t) => t.cells) : [otherColumns],
                    yearSummaryFor('otherLanguages')?.annual,
                  )}
                </tr>
                <tr className="grand-total-row">
                  <td colSpan={2} className="font-bold text-right">MAXIMA GÉNÉRAUX</td>
                  {renderScoreTail(
                    'all',
                    annual ? (yearSummaryFor('overall')?.maxima || overallColumns) : overallColumns,
                    annual ? (yearSummaryFor('overall')?.terms || []).map((t) => t.cells) : [overallColumns],
                    yearSummaryFor('overall')?.annual,
                  )}
                </tr>
                {renderSummaryTriplet('overall', 'overall', overallRank || rank)}
              </>
            )}
          </tbody>
        </table>

        <div className="bulletin-decisions">
          <p className="bulletin-verdict-title">Verdict du jury</p>
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
            <BulletinDirectorStamp compact directorName={meta?.directorName} />
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
