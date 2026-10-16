/**
 * Server error codes of start_exam_attempt, in the words a student can act on. Before 16/10/2026 the raw code
 * (for example `access_code_rate_limited`) was shown as is.
 */
const START_ATTEMPT_MESSAGES: Record<string, string> = {
  authentication_required: 'Bạn chưa đăng nhập tài khoản thi. Vui lòng đăng nhập rồi thử lại.',
  exam_window_not_found: 'Không tìm thấy kỳ thi. Kỳ thi có thể đã bị xóa.',
  exam_window_closed: 'Kỳ thi chưa mở hoặc đã hết giờ.',
  exam_window_not_allowed: 'Bạn không thuộc lớp của kỳ thi này. Báo giám thị kiểm tra danh sách lớp.',
  access_code_rate_limited:
    'Bạn đã nhập sai mã truy cập 5 lần nên bị tạm khóa 10 phút. Báo giám thị để được mở khóa và đọc lại mã của kỳ thi này.',
  attempt_limit_reached: 'Bạn đã dùng hết số lần thi của kỳ thi này.',
  exam_not_available: 'Đề thi không còn sẵn sàng. Báo giám thị.',
  exam_not_locked: 'Đề thi chưa được khóa để thi. Báo giám thị.',
  exam_no_module: 'Đề thi chưa gắn mô-đun. Báo giám thị.',
  exam_no_blueprint: 'Đề thi chưa có cấu trúc rút câu hỏi. Báo giám thị.',
  invalid_exam_blueprint: 'Cấu trúc rút câu hỏi của đề thi không hợp lệ. Báo giám thị.',
  insufficient_questions_for_blueprint: 'Ngân hàng câu hỏi không đủ câu để rút đề. Báo giám thị.',
};

export const WRONG_ACCESS_CODE_MESSAGE =
  'Mã truy cập không đúng. Kiểm tra lại mã giám thị đọc cho kỳ thi này (mã thi thử trước đây không dùng được).';

/** Câu cho học viên ứng với lỗi máy chủ; lỗi lạ giữ nguyên nội dung để giám thị chụp gửi kỹ thuật. */
export function startAttemptErrorMessage(serverMessage: string | null | undefined): string {
  const code = (serverMessage ?? '').trim();
  return START_ATTEMPT_MESSAGES[code] ?? (code || 'Không vào được bài thi. Thử lại hoặc báo giám thị.');
}
