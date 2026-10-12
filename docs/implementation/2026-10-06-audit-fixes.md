# Hoàn thiện 6 vấn đề sau rà soát 06/10/2026

Trạng thái: migration đã áp dụng ở production và mã nguồn đã push, deploy ngày 12/10/2026 (chạy thử trước; không có ai đang thi). Rollback: `docs/rollback/2026-10-06-modular-monolith-completion-and-audit-fixes.md`. Khi viết (06/10): đã sửa mã nguồn và kiểm tra local. Migration mới chưa áp dụng lên Supabase production; frontend/API chưa deploy. Báo cáo `docs/AUDIT_2026-10-06_LOGIC_MODULAR_MONOLITH.md` giữ nguyên kết quả trước khi sửa.

## Thay đổi

| Vấn đề | Kết quả |
| --- | --- |
| Kết luận Đạt khác nhau giữa các màn hình | Dùng chung `isExamPassed` cho chi tiết, danh sách, báo cáo và payload TTDT; so sánh điểm gốc, kiểm tra đình chỉ. Ví dụ 69,6/100 với ngưỡng 70 vẫn Chưa đạt. Hiển thị điểm giữ tối đa 2 chữ số thập phân. |
| Xem lại đề lấy ngân hàng hiện tại | RPC dành cho admin/teacher/proctor đọc đề đã phát qua `exam_private.bank_questions`, giữ thứ tự câu. Chỉ đọc sau khi bài hoàn thành; học viên không nhận khóa chấm qua RPC này. Bài legacy không có snapshot vẫn dùng nguồn legacy; không thể khôi phục nội dung lịch sử chưa từng lưu. |
| Tự luận thiếu khóa chấm | Cho phép lưu nháp; chặn xuất bản/khóa blueprint và phát đề có tự luận thiếu tiêu chí chấm hợp lệ. Có kiểm tra frontend, domain và trigger database. Không bổ sung chấm thủ công. |
| Migration xóa mềm phụ thuộc định dạng SQL | Sửa bản bootstrap bằng regex hẹp chịu khoảng trắng; migration mới định nghĩa rõ RPC cho database đã nâng cấp. Ca kiểm thử nạp định nghĩa SQL thực tế trước khi chạy bản cũ. |
| Tải lại trang làm mất số vi phạm | Lưu bộ đếm trên server, khóa bài khi ghi, gộp tín hiệu trùng trong 3 giây. Tải lại trang đọc bộ đếm và đồng bộ mỗi 5 giây. Lần thứ 5 tự đình chỉ phía server; ảnh minh chứng lưu sau và không quyết định việc đếm. Giữ ngưỡng hiện hành là 5. |
| API bài học theo phiên bản chưa nối giao diện | Danh sách theo enrollment, phiên bản, thời hạn và thứ tự mở từ RPC; player dùng đúng assignment. Đọc/PDF/YouTube xác nhận thủ công theo quy tắc backend; video khác ghi khoảng phát thực tế, resume, retry và flush khi rời trang. Server xác nhận hoàn thành, tua không được tính. |

## Kiểm chứng

- Online: 30 file / 235 test đạt, bao gồm hồi quy điểm sát ngưỡng, essay, snapshot review, quyền truy cập, vi phạm và phát video.
- `npm.cmd run build`: TypeScript và Vite đạt. Còn cảnh báo chunk lớn, không thuộc 6 sửa lỗi này.
- `npm.cmd run lint` và `npm.cmd run check:boundaries`: đạt.
- TTDT: 14 test integration e-learning đạt; không sửa mã nguồn TTDT.
- Browser local với tài khoản và dữ liệu giả: bài sau khóa trước khi hoàn thành bài trước; xác nhận đọc lưu thành công và mở bài tiếp; video không có nút hoàn thành tùy ý; link thiếu enrollment bị chặn; viewport 390px không tràn ngang.
- Đọc schema production xác nhận kiểu trả về `get_available_exam_windows()` khớp migration và API e-learning đã tồn tại. Không ghi dữ liệu production.

Kiểm thử browser dùng dữ liệu giả không thay thế nghiệm thu với video/Drive/camera và tài khoản thật. Quiz phiên bản vẫn cần dịch vụ chấm riêng; UI không tự tạo kết quả hoàn thành. Các phát hiện bổ sung trong báo cáo gốc, như liên kết CCCD và cấu hình ngưỡng lịch sử, không nằm trong 6 vấn đề được sửa.

## Đưa lên hệ thống

1. Áp dụng các migration trước đó theo thứ tự, đặc biệt snapshot đề và xóa mềm. E-learning cần schema/RPC trong TTDT đã triển khai.
2. Áp dụng `supabase/migrations/20261006151544_exam_audit_fixes.sql` trước frontend/API mới. Migration chạy trong transaction, timeout khóa 5 giây; lỗi sẽ rollback toàn bộ.
3. Deploy frontend/API mới cùng nhau và kiểm tra bài thi, xem lại bài, học theo phiên bản bằng tài khoản được phân quyền. RPC mới là bắt buộc cho frontend này.

Nếu deploy frontend lỗi, sửa tiếp/rollback bản phát hành sau khi đánh giá tương thích: frontend cũ ghi trực tiếp browser audit và sẽ bị policy mới chặn. Không xóa bảng bộ đếm, audit logs hoặc snapshot để rollback vì sẽ mất dấu vết thi. Ưu tiên migration sửa tiếp khi cần; không sửa dữ liệu điểm lịch sử tự động.

## Modular monolith sau sửa

`arch:score`: **16.501/22.332 dòng = 73,9%**, **38/46 route = 82,6%**, **5/10 tiêu chí**. Ranh giới import đạt. Vẫn có 3 service legacy (437 dòng), 6 file gọi Supabase ngoài lớp data/platform và 9/10 trang legacy còn nghiệp vụ. Sửa 6 lỗi không có nghĩa dự án đã hoàn thiện 100% hoặc đạt mục tiêu kiến trúc 85–90%.
