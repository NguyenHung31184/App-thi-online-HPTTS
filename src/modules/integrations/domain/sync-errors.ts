/** Step-by-step help for a failed theory grade sync, picked from the TTDT response text. */
export function explainTheorySyncError(response: string | null | undefined): string {
  const r = (response ?? '').toLowerCase();
  if (r.includes('module_id')) {
    return [
      'Lỗi liên quan module_id (mã mô-đun).',
      '',
      '1. Vào menu Admin → Đề thi.',
      '2. Tìm đúng đề thi tương ứng với log này (xem cột "Đề thi / Kỳ").',
      '3. Mở màn hình Sửa đề thi và chọn/nhập đúng Mã mô-đun (module_id) của TTDT.',
      '4. Lưu lại, sau đó quay lại màn Đồng bộ điểm và bấm "Thử lại" cho dòng này.',
    ].join('\n');
  }
  if (r.includes('class_id')) {
    return [
      'Lỗi liên quan class_id (mã lớp).',
      '',
      '1. Vào menu Admin → Kỳ thi.',
      '2. Tìm đúng kỳ thi (kỳ / lớp) trùng với log này.',
      '3. Mở màn hình Sửa kỳ thi và chọn đúng Lớp TTDT.',
      '4. Lưu lại, sau đó quay lại màn Đồng bộ điểm và bấm "Thử lại" cho dòng này.',
    ].join('\n');
  }
  if (r.includes('student_id') || r.includes('enrollment_id')) {
    return [
      'Lỗi liên quan student_id / enrollment (học viên chưa map sang TTDT).',
      '',
      '1. Kiểm tra tài khoản thi của học viên đã được xác thực CCCD và gắn với học viên TTDT chưa.',
      '2. Nếu chưa, thực hiện bước xác thực CCCD / gắn student_id trong app thi hoặc app quản lý.',
      '3. Khi tài khoản đã có student_id, quay lại màn Đồng bộ điểm và bấm "Thử lại".',
    ].join('\n');
  }
  if (r.includes('401') || r.includes('jwt') || r.includes('authorization')) {
    return [
      'Lỗi xác thực API TTDT (401 / JWT / authorization).',
      '',
      '1. Mở file .env của app thi online.',
      '2. Kiểm tra TTDT_RECEIVE_GRADES_URL và TTDT_API_KEY trong cấu hình máy chủ Vercel.',
      '3. Kiểm tra SUPABASE_SERVICE_ROLE_KEY chỉ được đặt trong biến môi trường máy chủ.',
      '4. Deploy lại sau khi cập nhật cấu hình, rồi bấm "Thử lại".',
    ].join('\n');
  }
  return [
    'Không nhận diện được loại lỗi cụ thể.',
    '',
    '1. Bấm nút "Xem" để đọc toàn bộ phản hồi chi tiết từ TTDT.',
    '2. Dựa trên thông báo đó, kiểm tra lại cấu hình đề thi, kỳ thi, học viên hoặc API key tương ứng.',
    '3. Sau khi chỉnh sửa, quay lại màn Đồng bộ điểm và bấm "Thử lại".',
  ].join('\n');
}

/** Cutoff for "Dọn log lỗi cũ": logs created before it are removed. */
export function syncLogCutoff(now: number, days: number): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}
