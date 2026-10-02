import * as XLSX from 'xlsx';
import { resultSheetRows, violationSheetRows, type AttemptReportRow, type SheetCell, type ViolationSummaryRow } from '../../domain/report-rows';

function writeSheet(rows: SheetCell[][], sheetName: string, filename: string): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  XLSX.writeFile(wb, filename);
}

export function exportReportToExcel(rows: AttemptReportRow[], filename?: string): void {
  writeSheet(resultSheetRows(rows), 'Kết quả thi', filename ?? `ket-qua-thi-${Date.now()}.xlsx`);
}

export function exportViolationsToExcel(rows: ViolationSummaryRow[], filename?: string): void {
  writeSheet(violationSheetRows(rows), 'Vi pham', filename ?? `bao-cao-vi-pham-${Date.now()}.xlsx`);
}
