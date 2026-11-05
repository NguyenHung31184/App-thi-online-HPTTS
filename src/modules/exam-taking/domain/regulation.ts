/**
 * Training regulation acknowledgement (Circular 79, Article 47(2)): before the first exam the student reads the
 * centre's "Quy chế đào tạo" and confirms it. The table and both RPCs live in the shared database, owned by the
 * management app (migration 20261105100000_regulation_acknowledgements in QuanlyTTDT-HPTTS).
 */

export interface RegulationStatus {
  title: string;
  url: string;
  /** public_documents.updated_at; a new file needs a new confirmation. */
  version: string;
  acknowledgedAt: string | null;
}

/** Ask only when a regulation is published and this version is not confirmed. No file, nothing to block. */
export function needsRegulationAck(status: RegulationStatus | null | undefined): status is RegulationStatus {
  return Boolean(status && !status.acknowledgedAt);
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
