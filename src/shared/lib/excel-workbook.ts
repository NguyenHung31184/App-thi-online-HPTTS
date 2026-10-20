// Excel files in the house style of the management app (QuanlyTTDT-HPTTS): Times New Roman, bordered table, shaded
// header that repeats on every printed page, frozen header, filter buttons, numbers and dates stored as real values.
// exceljs loads only when a file is built.
import type { Cell, Worksheet } from 'exceljs';

export type CellKind = 'text' | 'integer' | 'number' | 'percent' | 'date' | 'datetime';
/** datetime/date columns take epoch milliseconds; percent columns take a fraction (0.755 = 75.5%). */
export type SheetValue = string | number | null | undefined;

export interface SheetColumn {
  header: string;
  width: number;
  kind?: CellKind;
  align?: 'left' | 'center' | 'right';
}

export interface TableSheet {
  name: string;
  columns: SheetColumn[];
  rows: SheetValue[][];
  /**
   * Report heading above the table: centre name, title, one italic line per note. Leave it out for a file that is
   * imported again, whose reader expects the column names on row 1.
   */
  heading?: { title: string; notes?: string[] };
  /** Plain lines after a blank row below the table, such as the filling rules of a template. */
  footer?: string[];
  landscape?: boolean;
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FONT = 'Times New Roman';
const THIN = { style: 'thin' as const };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const HEAD_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE8F1FA' } };
const FORMATS: Partial<Record<CellKind, string>> = {
  integer: '0',
  number: '0.##',
  percent: '0.0%',
  date: 'dd/mm/yyyy',
  datetime: 'dd/mm/yyyy hh:mm',
};
const UNIT_LINES = ['CÔNG TY CỔ PHẦN DỊCH VỤ KỸ THUẬT', 'VÀ ĐÀO TẠO CẢNG HẢI PHÒNG', 'TRUNG TÂM ĐÀO TẠO'];

/** Excel keeps no time zone: shift so the sheet shows the local wall-clock time. */
function localDate(ms: number): Date {
  return new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
}

function columnLetter(n: number): string {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

function font(cell: Cell, extra: { bold?: boolean; italic?: boolean; underline?: boolean; size?: number } = {}) {
  cell.font = { name: FONT, size: extra.size ?? 11, bold: extra.bold, italic: extra.italic, underline: extra.underline };
}

function writeHeading(ws: Worksheet, lastCol: number, heading: NonNullable<TableSheet['heading']>): number {
  const last = columnLetter(lastCol);
  const unitEnd = columnLetter(Math.min(lastCol, 3));
  UNIT_LINES.forEach((text, i) => {
    const row = i + 1;
    if (lastCol > 1) ws.mergeCells(`A${row}:${unitEnd}${row}`);
    const cell = ws.getCell(`A${row}`);
    cell.value = text;
    font(cell, { bold: i === 2, underline: i === 2 });
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  let row = UNIT_LINES.length + 2;
  for (const [i, text] of [heading.title, ...(heading.notes ?? [])].entries()) {
    if (lastCol > 1) ws.mergeCells(`A${row}:${last}${row}`);
    const cell = ws.getCell(`A${row}`);
    cell.value = text;
    font(cell, i === 0 ? { bold: true, size: 14 } : { italic: true });
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row += 1;
  }
  return row + 1;
}

function writeSheet(ws: Worksheet, sheet: TableSheet) {
  const { columns } = sheet;
  columns.forEach((column, i) => { ws.getColumn(i + 1).width = column.width; });
  const headerRow = sheet.heading ? writeHeading(ws, columns.length, sheet.heading) : 1;

  columns.forEach((column, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = column.header;
    font(cell, { bold: true });
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = HEAD_FILL;
    cell.border = BORDER;
  });
  ws.getRow(headerRow).height = 32;

  sheet.rows.forEach((values, r) => {
    columns.forEach((column, c) => {
      const cell = ws.getCell(headerRow + 1 + r, c + 1);
      const value = values[c];
      const kind = column.kind ?? 'text';
      if (value === null || value === undefined || value === '') cell.value = null;
      else if ((kind === 'date' || kind === 'datetime') && typeof value === 'number') cell.value = localDate(value);
      else cell.value = value;
      const format = FORMATS[kind];
      if (format) cell.numFmt = format;
      font(cell);
      cell.alignment = { horizontal: column.align ?? (kind === 'text' ? 'left' : 'center'), vertical: 'top', wrapText: kind === 'text' };
      cell.border = BORDER;
    });
  });

  ws.views = [{ state: 'frozen', ySplit: headerRow }];
  if (sheet.rows.length > 0) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + sheet.rows.length, column: columns.length } };
  ws.pageSetup = {
    paperSize: 9,
    orientation: sheet.landscape === false ? 'portrait' : 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    printTitlesRow: `${headerRow}:${headerRow}`,
  };

  let footerRow = headerRow + sheet.rows.length + 2;
  for (const line of sheet.footer ?? []) {
    const cell = ws.getCell(footerRow, 1);
    cell.value = line;
    font(cell, { bold: footerRow === headerRow + sheet.rows.length + 2 });
    footerRow += 1;
  }
}

/** The workbook bytes; the first sheet is the one importers read. */
export async function buildWorkbookBytes(sheets: TableSheet[]): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const book = new ExcelJS.Workbook();
  book.creator = 'App thi online HPTTS';
  book.created = new Date();
  for (const sheet of sheets) writeSheet(book.addWorksheet(sheet.name), sheet);
  return (await book.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function buildWorkbook(sheets: TableSheet[]): Promise<Blob> {
  return new Blob([await buildWorkbookBytes(sheets)], { type: XLSX_MIME });
}

/** "Kết quả thi: QC/K44" → "Kết quả thi- QC-K44.xlsx": Windows-safe, Vietnamese kept, at most 120 characters. */
export function excelFileName(base: string): string {
  const safe = base.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'du-lieu';
  return `${safe}.xlsx`;
}

/** dd-mm-yyyy of a moment, for file names. */
export function fileDate(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

export function saveBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
