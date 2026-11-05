/**
 * Training regulation acknowledgement (Circular 79, Article 47(2), "at the start of the course"): at the first sign-in
 * the student reads the centre's "Quy chế đào tạo" and confirms it. The table and both RPCs live in the shared
 * database, owned by the management app (migration 20261105100000_regulation_acknowledgements in QuanlyTTDT-HPTTS).
 */

export interface RegulationStatus {
  title: string;
  url: string;
  /** public_documents.updated_at; a new file needs a new confirmation. */
  version: string;
  acknowledgedAt: string | null;
}

/** Ask only when a regulation is published and this version is not confirmed. No file, nothing to block. */
export function needsRegulationAck(status: RegulationStatus | null | undefined): boolean {
  return Boolean(status && !status.acknowledgedAt);
}

/**
 * Where the first-sign-in check runs: student accounts only (linked to a student record), never inside a running exam
 * (a regulation replaced mid-exam must not cover the paper).
 */
export function regulationCheckApplies(pathname: string, studentId: string | null | undefined): boolean {
  return Boolean(studentId) && !pathname.startsWith('/exam/');
}

const ACK_MESSAGES: Record<string, string> = {
  not_exam_student: 'Tài khoản này chưa gắn với hồ sơ học viên. Báo giám thị để kiểm tra tài khoản thi.',
  no_regulation: 'Trung tâm vừa gỡ file Quy chế. Tải lại trang rồi vào thi.',
  regulation_changed: 'Trung tâm vừa cập nhật Quy chế. Mở lại file mới rồi xác nhận.',
};

export function regulationAckErrorMessage(serverMessage: string | null | undefined): string {
  const code = (serverMessage ?? '').trim();
  return ACK_MESSAGES[code] ?? 'Không ghi được xác nhận. Kiểm tra kết nối rồi thử lại.';
}
