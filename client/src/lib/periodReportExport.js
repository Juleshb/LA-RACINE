import { exportReportExcel, exportReportPdf } from './reportExport';

function studentName(student) {
  return [student?.lastName, student?.postName, student?.firstName].filter(Boolean).join(' ');
}

function sortedRows(report) {
  return (report?.rows || [])
    .slice()
    .sort((a, b) => (a.standing?.place || 999) - (b.standing?.place || 999));
}

function reportMeta(report) {
  const windowTitle = report?.window?.title || 'Période';
  const className = report?.class?.name || 'Classe';
  const term = report?.window?.term || '';
  const grade = report?.class?.grade || '';
  const section = report?.class?.section || '';
  const safeClass = String(className).replace(/\s+/g, '-');
  const safeTitle = String(windowTitle).replace(/\s+/g, '-');
  const dateStamp = new Date().toISOString().slice(0, 10);
  return {
    windowTitle,
    className,
    term,
    grade,
    section,
    filenameBase: `periode-${safeTitle}-${safeClass}-${dateStamp}`,
  };
}

/**
 * Excel: full class records including every subject mark.
 */
export function buildPeriodReportExcelExport(report) {
  const subjects = report?.subjects || [];
  const { windowTitle, className, term, filenameBase } = reportMeta(report);
  const title = `${windowTitle} — ${className}${term ? ` (${term})` : ''} — Détail`;

  const columns = [
    { key: 'place', label: 'Place' },
    { key: 'studentId', label: 'Matricule' },
    { key: 'student', label: 'Élève' },
    { key: 'total', label: 'Total' },
    { key: 'obtained', label: 'Obtenu' },
    { key: 'maxScore', label: 'Maxima' },
    { key: 'pct', label: '%' },
    ...subjects.map((s) => ({
      key: `subj_${s.id}`,
      label: s.code || s.name,
    })),
  ];

  const rows = sortedRows(report).map((row) => {
    const out = {
      place: row.standing?.place ?? '',
      studentId: row.student?.studentId || '',
      student: studentName(row.student),
      total: row.standing
        ? `${row.standing.obtained}/${row.standing.maxScore}`
        : '',
      obtained: row.standing?.obtained ?? '',
      maxScore: row.standing?.maxScore ?? '',
      pct: row.standing?.pct != null ? Math.round(row.standing.pct * 10) / 10 : '',
    };
    for (const s of subjects) {
      const mark = (row.subjects || []).find((x) => x.subjectId === s.id);
      out[`subj_${s.id}`] = mark?.obtained != null ? `${mark.obtained}/${mark.maxScore}` : '';
    }
    return out;
  });

  return {
    title,
    sheetName: 'Detail',
    columns,
    rows,
    meta: {
      generatedAt: new Date().toISOString(),
      className,
      term,
      cutoffDate: report?.window?.cutoffDate,
      studentCount: rows.length,
    },
    filename: `${filenameBase}-detail`,
  };
}

/**
 * PDF: proclamation list — place, student, total marks and %, no subject columns.
 */
export function buildPeriodProclamationPdfExport(report) {
  const { windowTitle, className, term, grade, section, filenameBase } = reportMeta(report);
  const classLine = [grade, section].filter(Boolean).join(' ') || className;
  const title = `Proclamation — ${windowTitle}`;
  const subtitle = `${className}${term ? ` · ${term}` : ''}`;

  const columns = [
    { key: 'place', label: 'Place' },
    { key: 'student', label: 'Élève' },
    { key: 'marks', label: 'Notes' },
    { key: 'pct', label: '%' },
  ];

  const rows = sortedRows(report).map((row) => ({
    place: row.standing?.place != null
      ? `${row.standing.place}/${row.standing.totalStudents || sortedRows(report).length}`
      : '—',
    student: studentName(row.student),
    marks: row.standing
      ? `${row.standing.obtained} / ${row.standing.maxScore}`
      : '—',
    pct: row.standing?.pct != null ? `${Math.round(row.standing.pct * 10) / 10} %` : '—',
  }));

  return {
    title,
    columns,
    rows,
    meta: {
      generatedAt: new Date().toISOString(),
      className,
      classLine,
      term,
      subtitle,
      cutoffDate: report?.window?.cutoffDate,
      studentCount: rows.length,
    },
    filename: `${filenameBase}-proclamation`,
  };
}

export function exportPeriodReportExcel(report) {
  const payload = buildPeriodReportExcelExport(report);
  exportReportExcel({
    ...payload,
    // Short ASCII sheet name — full title stays in the download filename
    title: payload.sheetName || 'Detail',
  });
}

export function exportPeriodReportPdf(report) {
  const payload = buildPeriodProclamationPdfExport(report);
  // Prefixed title line includes class for the proclamation header
  exportReportPdf({
    ...payload,
    title: `${payload.title} — ${payload.meta.className}${payload.meta.term ? ` (${payload.meta.term})` : ''}`,
  });
}
