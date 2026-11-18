import ExcelJS from 'exceljs';
import fileSaver from 'file-saver';

const saveAs = fileSaver.saveAs || fileSaver;

export const BOOK_CATEGORIES = [
  'Novel', 'Sciences', 'Mathematics', 'History', 'Geography', 'Literature', 'Textbook', 'Other',
];

export const RETURN_CONDITIONS = ['Good condition', 'Minor wear', 'Damaged', 'Lost'];

function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
    if (value.text) return String(value.text);
    if (value.result != null) return cellText(value.result);
  }
  return String(value).trim();
}

function norm(value) {
  return cellText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function columnKey(header) {
  const text = norm(header);
  if (text.includes('titre') || text === 'title') return 'title';
  if (text.includes('auteur') || text === 'author') return 'author';
  if (text.includes('categor') || text.includes('categorie')) return 'category';
  if (text.includes('isbn') || text === 'code') return 'isbn';
  if (text.includes('exempl') || text.includes('copie') || text.includes('qte') || text.includes('quantity')) return 'copies';
  if (text.includes('edit') || text.includes('publisher')) return 'publisher';
  return '';
}

export async function parseBookImportFile(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const header = sheet.getRow(1);
  const keys = [];
  header.eachCell((cell, col) => {
    keys[col] = columnKey(cell.value);
  });
  const rows = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const record = {};
    keys.forEach((key, col) => {
      if (!key) return;
      record[key] = cellText(row.getCell(col).value);
    });
    if (!record.title) return;
    rows.push({
      title: record.title,
      author: record.author || '',
      category: record.category || 'Other',
      isbn: record.isbn || '',
      copies: Math.max(1, Number(record.copies) || 1),
      publisher: record.publisher || '',
    });
  });
  return rows;
}

async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  );
}

export async function downloadBookTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Books');
  sheet.addRow(['Title', 'Author', 'Category', 'ISBN', 'Copies', 'Publisher']);
  sheet.addRow(['Le Petit Prince', 'Antoine de Saint-Exupéry', 'Literature', '', 2, 'Gallimard']);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => { column.width = 22; });
  await downloadWorkbook(workbook, 'library-books-template.xlsx');
}

export async function downloadLibraryWorkbook({ books = [], loans = [] } = {}) {
  const workbook = new ExcelJS.Workbook();
  const catalog = workbook.addWorksheet('Books');
  catalog.addRow(['Title', 'Author', 'Category', 'ISBN', 'Copies', 'Available', 'Publisher']);
  books.forEach((book) => {
    catalog.addRow([book.title, book.author || '', book.category || '', book.isbn || '', book.copies, book.available, book.publisher || '']);
  });
  catalog.getRow(1).font = { bold: true };

  const loanSheet = workbook.addWorksheet('Loans');
  loanSheet.addRow(['Borrower', 'Type', 'Book', 'Loan date', 'Due date', 'Returned', 'Condition', 'Status']);
  loans.forEach((loan) => {
    loanSheet.addRow([
      loan.borrowerName,
      loan.borrowerType,
      loan.book?.title || '',
      loan.loanedAt ? String(loan.loanedAt).slice(0, 10) : '',
      loan.dueDate ? String(loan.dueDate).slice(0, 10) : '',
      loan.returnedAt ? String(loan.returnedAt).slice(0, 10) : '',
      loan.condition || '',
      loan.status,
    ]);
  });
  loanSheet.getRow(1).font = { bold: true };
  await downloadWorkbook(workbook, 'library-la-racine.xlsx');
}
