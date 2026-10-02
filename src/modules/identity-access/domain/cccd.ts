import type { OcrCccdResult, StudentSession, VerifyCccdResponse } from '../../../types';

/** CCCD numbers are compared without spaces. */
export const normalizeCccd = (value: string): string => value.replace(/\s/g, '').trim();

/** Typed CCCD and name, used when OCR fails; same server check as after OCR. */
export function manualCccdInput(cccd: string, name: string, dob: string): { error: string } | { data: OcrCccdResult } {
  const number = normalizeCccd(cccd);
  const fullName = name.replace(/\s+/g, ' ').trim();
  if (!number) return { error: 'Vui lòng nhập số CCCD.' };
  if (!fullName) return { error: 'Vui lòng nhập họ và tên đầy đủ (đúng như trên thẻ).' };
  const birth = dob.trim() || undefined;
  return { data: { id_card_number: number, full_name: fullName, name: fullName, dob: birth, date_of_birth: birth } };
}

/** What the server check is called with. */
export function verifyRequest(card: OcrCccdResult, examAccountEmail: string | undefined) {
  return {
    id_card_number: card.id_card_number ?? '',
    name: card.full_name ?? card.name,
    dob: card.dob ?? card.date_of_birth,
    exam_account_email: examAccountEmail,
  };
}

/** The message to show when the check did not pass, or null when the student may continue. */
export function verifyFailure(result: { success: boolean; data?: VerifyCccdResponse; error?: string }): string | null {
  if (!result.success) return result.error || 'Kiểm tra CCCD thất bại.';
  if (!result.data?.valid) return result.data?.message || 'Số CCCD không thuộc danh sách được thi.';
  return null;
}

/** The CCCD student session kept for this tab: date of birth trimmed, card number without spaces. */
export function studentSessionOf(
  studentId: string,
  studentCode: string,
  studentName?: string,
  extras?: { student_dob?: string; id_card_number?: string },
): StudentSession {
  return {
    student_id: studentId,
    student_code: studentCode,
    student_name: studentName,
    student_dob: extras?.student_dob?.trim() || undefined,
    id_card_number: extras?.id_card_number?.replace(/\s/g, '')?.trim() || undefined,
  };
}
