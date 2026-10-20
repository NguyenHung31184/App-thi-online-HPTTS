import type { QuestionBankItem } from '../../../../types';
import { buildWorkbook, excelFileName, saveBlob } from '../../../../shared/lib/excel-workbook';
import { BANK_SHEET_COLUMNS, bankSheetRows } from '../../domain/bank-check';

/** Saves the listed questions of an exam's bank, with how often each was drawn. */
export async function downloadBankExcel(questions: QuestionBankItem[], frequency: Record<string, number>, examTitle: string): Promise<void> {
  const blob = await buildWorkbook([{
    name: 'Ngan hang',
    heading: {
      title: 'NGÂN HÀNG CÂU HỎI CỦA ĐỀ THI',
      notes: [examTitle, `Câu đang phát hành: ${questions.length} · Xuất lúc ${new Date().toLocaleString('vi-VN')}`],
    },
    columns: BANK_SHEET_COLUMNS,
    rows: bankSheetRows(questions, frequency),
  }]);
  saveBlob(excelFileName(`Ngan hang - ${examTitle}`), blob);
}
