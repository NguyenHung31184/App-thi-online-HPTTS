import type { QuestionBankItem } from '../../../../types';
import { bankCsv, bankCsvFileName } from '../../domain/bank-check';

/** Saves the CSV of the listed questions through a temporary link. */
export function downloadBankCsv(questions: QuestionBankItem[], frequency: Record<string, number>, examTitle: string): void {
  const url = URL.createObjectURL(new Blob([bankCsv(questions, frequency)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = bankCsvFileName(examTitle);
  link.click();
  URL.revokeObjectURL(url);
}
