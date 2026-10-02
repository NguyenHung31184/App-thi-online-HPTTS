import type { OcrCccdResult } from '../../../types';

/** Card fields from the OCR proxy response (it names them name, dob, address). */
export function ocrResultFrom(result: Record<string, unknown>): OcrCccdResult {
  return {
    id_card_number: result.id_card_number as string | undefined,
    full_name: result.name as string | undefined,
    name: result.name as string | undefined,
    dob: result.dob as string | undefined,
    date_of_birth: result.dob as string | undefined,
    id_card_issue_date: result.id_card_issue_date as string | undefined,
    id_card_issue_place: result.id_card_issue_place as string | undefined,
    permanent_address: result.address as string | undefined,
    address: result.address as string | undefined,
    gender: result.gender as string | undefined,
  };
}

/** The server's own message wins; otherwise a hint that typing the CCCD still works. */
export function ocrHttpError(status: number, result: Record<string, unknown>): string {
  const serverMsg = typeof result?.error === 'string' ? result.error : '';
  const statusMsg =
    status === 429
      ? 'Hệ thống OCR đang bận, vui lòng thử lại sau ít phút hoặc nhập tay CCCD.'
      : status === 500
        ? 'Máy chủ đọc CCCD tạm thời lỗi. Bạn có thể nhập tay số CCCD bên dưới.'
        : `Lỗi OCR (${status})`;
  return serverMsg || statusMsg;
}

export function ocrNetworkError(err: unknown): string {
  if (err instanceof Error && err.name === 'AbortError') {
    return 'Hệ thống OCR mất quá nhiều thời gian. Vui lòng nhập tay CCCD bên dưới.';
  }
  const message = err instanceof Error ? err.message : 'Lỗi mạng khi gọi OCR.';
  return message.includes('fetch') || message.includes('Failed')
    ? 'Không kết nối được máy chủ đọc CCCD. Bạn có thể nhập tay số CCCD bên dưới hoặc thử lại sau.'
    : message;
}
