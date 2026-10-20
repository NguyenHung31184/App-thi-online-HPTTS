import { buildWorkbook, excelFileName, fileDate, saveBlob } from '../../../../shared/lib/excel-workbook';
import {
  RESULT_SHEET_COLUMNS, VIOLATION_SHEET_COLUMNS, resultSheetRows, violationSheetRows,
  type AttemptReportRow, type ViolationSummaryRow,
} from '../../domain/report-rows';

/** "Đề thi: A; B" when the rows span one to three exams, so the printed sheet says what it covers. */
function scopeNotes(rows: { exam_title?: string; class_name?: string }[], now: number): string[] {
  const list = (values: (string | undefined)[]) => [...new Set(values.filter(Boolean))] as string[];
  const exams = list(rows.map((r) => r.exam_title));
  const classes = list(rows.map((r) => r.class_name));
  return [
    ...(exams.length > 0 && exams.length <= 3 ? [`Đề thi: ${exams.join('; ')}`] : []),
    ...(classes.length > 0 && classes.length <= 3 ? [`Lớp: ${classes.join('; ')}`] : []),
    `Xuất lúc ${new Date(now).toLocaleString('vi-VN')}`,
  ];
}

export async function exportReportToExcel(rows: AttemptReportRow[]): Promise<void> {
  const now = Date.now();
  const blob = await buildWorkbook([{
    name: 'Ket qua thi',
    heading: { title: 'KẾT QUẢ THI LÝ THUYẾT', notes: [...scopeNotes(rows, now), `Số bài làm: ${rows.length}`] },
    columns: RESULT_SHEET_COLUMNS,
    rows: resultSheetRows(rows),
  }]);
  saveBlob(excelFileName(`Ket qua thi ${fileDate(now)}`), blob);
}

export async function exportViolationsToExcel(rows: ViolationSummaryRow[]): Promise<void> {
  const now = Date.now();
  const blob = await buildWorkbook([{
    name: 'Vi pham',
    heading: { title: 'TỔNG HỢP TÍN HIỆU GIÁM SÁT THI', notes: [`Xuất lúc ${new Date(now).toLocaleString('vi-VN')}`, `Số lượt thi: ${rows.length}`] },
    columns: VIOLATION_SHEET_COLUMNS,
    rows: violationSheetRows(rows),
  }]);
  saveBlob(excelFileName(`Tin hieu giam sat ${fileDate(now)}`), blob);
}
