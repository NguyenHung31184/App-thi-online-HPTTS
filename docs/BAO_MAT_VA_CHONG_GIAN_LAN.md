# Bảo mật và chống gian lận trong kỳ thi

Liệt kê các biện pháp: **đang chạy** (đã triển khai) và **chưa có — cần bổ sung**.

---

## Đang chạy (đã triển khai)

| # | Biện pháp | Mô tả ngắn |
|---|-----------|-------------|
| 1 | **Không lộ đáp án** | View `questions_for_student` không có `answer_key`. RPC `get_questions_for_student` trả đề không đáp án. Thí sinh chỉ nhận câu hỏi + phương án, không biết đáp án đúng. |
| 2 | **Chấm điểm server-side** | RPC `grade_attempt` chạy trên server: đọc `answer_key` từ bảng `questions`, so sánh với `attempt.answers`, cập nhật `raw_score`, `score`, `status`. Client không tham gia chấm. |
| 3 | **RLS (Row Level Security)** | Phân quyền theo role (admin/teacher/student). Thí sinh chỉ đọc/ghi attempt của mình; chỉ xem đề/cửa sổ thi được phép; không đọc trực tiếp bảng `questions` (dùng RPC). |
| 4 | **Mã truy cập kỳ thi** | Mỗi cửa sổ thi / ca thực hành có `access_code`. Khi "Vào thi", so sánh mã nhập với mã lưu; sai thì không tạo attempt. |
| 5 | **Ràng buộc theo lớp và thời gian** | Cửa sổ thi gắn `class_id` và `start_at`/`end_at`. RLS + `getAllowedWindows`/`getAllowedPracticalSessions`: thí sinh chỉ thấy kỳ thi thuộc lớp mình (qua `enrollments`) và trong khung giờ. Kiểm tra thời gian trước khi tạo attempt. |
| 6 | **Xác thực CCCD trước khi thi** | Màn xác thực CCCD: chụp/tải ảnh → OCR đọc số CCCD → gọi Edge Function `verify-cccd-for-exam` kiểm tra học viên trong TTDT. Chỉ khi hợp lệ mới gán `student_id` vào profile và có thể thấy kỳ thi theo lớp. |
| 7 | **Snapshot đề (kiểm định)** | Khi kiểm định đề, tạo snapshot chỉ chứa `question_ids`, lưu Storage. Khi làm bài, lấy danh sách câu từ snapshot rồi gọi `get_questions_for_student` → đề khóa theo bản đã kiểm định. |
| 8 | **Giới hạn thời gian làm bài** | Mỗi đề có `duration_minutes`. Timer tính `remainingMs` từ `started_at + duration_minutes`; khi hết giờ tự gọi nộp bài. |
| 9 | **Tráo câu hỏi và đáp án** | Shuffle câu hỏi theo seed từ `attemptId`; shuffle đáp án trắc nghiệm theo seed `attemptId|questionId`. Cùng attempt thì thứ tự ổn định, khác attempt thì khác thứ tự. |
| 10 | **Audit log hành vi** | Ghi vào `attempt_audit_logs`: `visibility_hidden` (chuyển tab/tab ẩn), `focus_lost` (mất focus cửa sổ), `photo_taken` (ảnh webcam lúc bắt đầu). Admin/teacher có thể xem log. |
| 11 | **Proctoring ảnh khi bắt đầu** | Khi vào trang làm bài: bật webcam, chụp 1 ảnh, upload `exam-uploads/proctoring/{attemptId}/start.jpg`, ghi audit `photo_taken`. Từ chối camera vẫn cho làm bài (không chặn). |
| 12 | **Đăng nhập (Supabase Auth)** | Phải đăng nhập mới vào Dashboard và tạo attempt. Phân quyền theo `profiles.role`. |
| 13 | **Bảo vệ API TTDT** | Edge Function `receive-exam-results` và `verify-cccd-for-exam` có thể bật kiểm tra API key (env); khi set thì chỉ request đúng key mới được gọi. |
| 14 | **Xác nhận nộp bài** | Trước khi nộp: modal hiển thị "Bạn đã làm được X / Y câu. Bạn có chắc chắn muốn nộp bài?" với Hủy / Có, nộp bài. |

---

## Chưa có — cần bổ sung

| # | Biện pháp | Gợi ý triển khai |
|---|-----------|-------------------|
| 1 | **Chặn copy/paste** | Trên màn làm bài (`ExamTakePage`): `document.addEventListener('copy', e => e.preventDefault())`, tương tự `paste`. Có thể ghi `copy_paste_blocked` vào audit log. Type `AuditEvent` đã có `copy_paste_blocked`. |
| 2 | **Bắt buộc toàn màn hình** | Dùng Fullscreen API: khi vào trang làm bài yêu cầu fullscreen; khi thoát fullscreen ghi audit và có thể cảnh báo / đếm lần vi phạm. Hiện mới có lời nhắc "Nên làm bài trong chế độ toàn màn hình". |
| 3 | **Tự động nộp bài sau N lần vi phạm** | Đếm số lần `visibility_hidden` hoặc `focus_lost` (hoặc thoát fullscreen) trong phiên làm bài; khi vượt ngưỡng (vd. 3 lần) hiện cảnh báo cuối hoặc tự gọi nộp bài. Cần đọc `attempt_audit_logs` theo attempt hoặc đếm ở client. |
| 4 | **Proctoring AI (phát hiện bất thường)** | Chụp ảnh định kỳ hoặc khi có sự kiện; chạy TensorFlow.js + COCO-SSD (hoặc tương đương) trên client để phát hiện nhiều mặt, điện thoại, v.v.; upload ảnh nghi ngờ + log để GV xem sau. Hiện chỉ có 1 ảnh lúc bắt đầu, không phân tích nội dung. |
| 5 | **Mã hóa access_code** | Hiện `access_code` lưu plain text. Có thể hash (bcrypt) khi lưu và so sánh khi nhập để tránh lộ mã trong DB. |

---

## Tóm tắt

- **Đang chạy:** 14 hạng mục (không lộ đáp án, chấm server-side, RLS, mã truy cập, ràng buộc lớp/thời gian, CCCD, snapshot đề, giới hạn thời gian, shuffle, audit log, ảnh proctoring lúc bắt đầu, auth, bảo vệ API TTDT, xác nhận nộp bài).
- **Chưa có:** 5 hạng mục (chặn copy/paste, bắt buộc fullscreen, auto-nộp sau N vi phạm, proctoring AI, hash access_code).

Tài liệu kế hoạch chi tiết: `docs/BAO_MAT_APP_THI_ONG_FREE.md` (repo QuanlyTTDT).
