import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';

function sanitizeFilename(name) {
  return String(name || 'report').replace(/[^\w\-]+/g, '_').slice(0, 80);
}

function cellValue(row, key) {
  const value = row?.[key];
  if (value == null) return '';
  return String(value);
}

export function exportReportExcel({ title, columns, rows, filename }) {
  const headers = columns.map((c) => c.label);
  const data = rows.map((row) => columns.map((c) => cellValue(row, c.key)));
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, (title || 'Report').slice(0, 31));
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${sanitizeFilename(filename || title)}.xlsx`,
  );
}

export async function exportReportWord({ title, columns, rows, meta, filename }) {
  const headerRow = new TableRow({
    children: columns.map((col) => new TableCell({
      width: { size: Math.floor(9000 / Math.max(columns.length, 1)), type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text: col.label, bold: true })] })],
    })),
  });

  const bodyRows = rows.map((row) => new TableRow({
    children: columns.map((col) => new TableCell({
      width: { size: Math.floor(9000 / Math.max(columns.length, 1)), type: WidthType.DXA },
      children: [new Paragraph(cellValue(row, col.key))],
    })),
  }));

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: title || 'Report',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated: ${meta?.generatedAt ? new Date(meta.generatedAt).toLocaleString() : new Date().toLocaleString()} · Rows: ${rows.length}`,
              italics: true,
              size: 20,
            }),
          ],
        }),
        new Paragraph({ text: '' }),
        new Table({
          width: { size: 9000, type: WidthType.DXA },
          rows: [headerRow, ...bodyRows],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFilename(filename || title)}.docx`);
}

export function exportReportPdf({ title, columns, rows, meta, filename }) {
  const pdf = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / Math.max(columns.length, 1);
  const lineHeight = 6;
  let y = margin;

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title || 'Report', margin, y);
  y += 8;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    `Generated: ${meta?.generatedAt ? new Date(meta.generatedAt).toLocaleString() : new Date().toLocaleString()} · ${rows.length} row(s)`,
    margin,
    y,
  );
  y += 8;

  const drawHeader = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(101, 163, 13);
    pdf.setTextColor(255, 255, 255);
    pdf.rect(margin, y - 4, usableWidth, lineHeight + 1, 'F');
    columns.forEach((col, index) => {
      const text = pdf.splitTextToSize(col.label, colWidth - 2)[0] || '';
      pdf.text(text, margin + index * colWidth + 1, y);
    });
    y += lineHeight + 2;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
  };

  drawHeader();

  rows.forEach((row, rowIndex) => {
    if (y > pageHeight - margin - lineHeight) {
      pdf.addPage();
      y = margin;
      drawHeader();
    }

    if (rowIndex % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, y - 4, usableWidth, lineHeight + 1, 'F');
    }

    columns.forEach((col, index) => {
      const text = pdf.splitTextToSize(cellValue(row, col.key), colWidth - 2)[0] || '';
      pdf.text(text, margin + index * colWidth + 1, y);
    });
    y += lineHeight;
  });

  pdf.save(`${sanitizeFilename(filename || title)}.pdf`);
}
