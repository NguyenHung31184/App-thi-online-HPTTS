# Hoàn thiện modular monolith ngày 06/10/2026

Trạng thái: đã commit, push và deploy ngày 12/10/2026 sau khi chạy lại toàn bộ kiểm tra; luồng học viên chưa nghiệm thu bằng tài khoản thật. Rollback: `docs/rollback/2026-10-06-modular-monolith-completion-and-audit-fixes.md`. Khi viết (06/10): mã nguồn trên bản làm việc đã đạt 10 tiêu chí của repo; chưa commit, push hoặc deploy. Không ghi database production trong lượt refactor này.

## Kết quả đo

| Chỉ số | Trước | Sau |
| --- | --- | --- |
| Dòng nghiệp vụ thuộc module | 16.501/22.332 = 73,9% | 21.163/21.532 = 98,3% |
| Route thuộc public API của module | 38/46 | 46/46 |
| Tiêu chí đạt | 5/10 | 10/10 |
| Service legacy | 3 file, 437 dòng | 0 |
| File gọi Supabase ngoài data/platform | 6 | 0 |
| Ngoại lệ import | 3 | 0 |
| File trong thư mục legacy | 27 | 0 |

Đo bằng `npm.cmd run arch:score -- --check` và `npm.cmd run check:boundaries`. Không thay đổi ngưỡng hoặc danh mục tiêu chí để đạt điểm. Cách đếm dòng và route giữ nguyên; thêm `--check` để trả mã lỗi nếu bất kỳ tiêu chí nào không đạt. CI đã dùng chế độ này. Đã kiểm tra trường hợp âm bằng fixture có trang legacy gọi Supabase: công cụ trả exit code 1.

Tỷ lệ này đo nơi đặt mã theo bộ quy tắc repo, không phải phần trăm tính năng hoàn thiện hay điểm chất lượng toàn hệ thống. Mã ngoài module còn lại chủ yếu là DTO `src/types`; app shell, platform và shared được bộ đo loại khỏi mẫu số.

## Tổ chức lại

- `exam-taking`: trang chủ, hướng dẫn và làm bài; use case tải phiên thi kiểm tra chủ bài trước khi tải đề, đọc câu hỏi và thời hạn đồng thời; upload ảnh tách nén ảnh và adapter Edge; hook điều phối phiên thi; component riêng cho câu hỏi và giám sát.
- `exam-reporting`: danh sách/kết quả của học viên, read model, ảnh vào thi và kiểm tra quyền xem. UI không gọi Supabase; tác vụ tải và retry đồng bộ nằm ở hooks/application.
- `elearning`: catalog và player legacy cùng luồng phiên bản; repository giữ truy cập database, application gom theo mô-đun, domain tính hoàn thành, hooks điều phối tiến độ/token/flush.
- `app/layouts`: layout học viên và admin. `shared/ui`: khung ứng dụng, icon, sortable options và hướng dẫn camera. `platform/media`: nén ảnh và kiểm tra URL dùng chung.
- `App.tsx` lấy toàn bộ component nghiệp vụ từ `modules/*/public.ts`; URL giữ nguyên. Xóa facade và nguồn legacy sau khi chuyển mọi consumer. `architecture-allowlist.json` đã rỗng.

Trang thi được tách thành view và hook; số vi phạm hiển thị bằng React state thay vì đọc ref trong render. Chính sách vi phạm, RPC chấm bài và ngưỡng được giữ nguyên. Lỗi tải phiên thi được chuyển thành thông báo thay vì promise bị bỏ rơi. Tải kết quả tránh cập nhật state từ truy vấn tổng điểm cũ sau khi đổi trang.

## Kiểm tra

- 33 file / **243 test đạt**, gồm database PGlite và các hồi quy đã bổ sung trong lượt sửa 6 vấn đề trước.
- Bổ sung ca quyền sở hữu trước tải đề, bài completed, deadline/đáp án đã lưu, lỗi tải câu hỏi, thứ tự câu ổn định, câu trả lời cấu trúc và bài học phải đủ các block thực tế mới hoàn thành.
- TypeScript/Vite build đạt; ESLint sạch; kiểm tra import và 10 tiêu chí đạt. `git diff --check` đạt.
- Browser local dùng tài khoản và API giả, không ghi Supabase thật: dashboard, danh sách thi → intro → xác nhận vào thi; lỗi từ chối camera; bài người khác bị chặn; completed redirect; hết giờ gọi finalize và chuyển kết quả; 69,6/100 với ngưỡng 70 vẫn Chưa đạt; link danh sách kết quả; bài đọc mở khóa bài tiếp; video không có nút hoàn thành tùy ý; viewport 390px không tràn ngang.

Kiểm tra local chưa thay thế nghiệm thu webcam/AI, Drive/video thật và đồng bộ TTDT trên hệ thống triển khai. Build vẫn cảnh báo chunk lớn (~733 KB, 976 KB, 1.561 KB). Hook phiên thi vẫn điều phối nhiều tác vụ; đạt tiêu chí kiến trúc không có nghĩa mọi component đã nhỏ hoặc mọi luồng đã được kiểm thử end-to-end.

## Triển khai và rollback

Lượt này không thêm migration. Tuy nhiên bản làm việc vẫn chứa migration sửa 6 vấn đề trước: `20261006151544_exam_audit_fixes.sql`; phải áp dụng trước khi deploy frontend này. Theo thứ tự và lưu ý tương thích tại [báo cáo sửa lỗi](2026-10-06-audit-fixes.md).

Các thay đổi OCR/API tồn tại trước refactor được giữ lại, không phải phần của việc tách module. Khi tạo commit cần phân biệt những thay đổi đó; chưa có commit rollback mới trong lượt này. Rollback refactor phải đi cùng router, module public API và các file đã chuyển, tránh khôi phục chỉ riêng một facade. Không xóa audit logs, snapshot hoặc bộ đếm vi phạm khi rollback frontend.
