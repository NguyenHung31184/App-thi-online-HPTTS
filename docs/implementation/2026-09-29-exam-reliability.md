# Chốt bài, giữ nguyên đề đã phát và đồng bộ điểm

Trạng thái: bản sửa cục bộ, chưa áp dụng migration hoặc triển khai Vercel.

## Phạm vi

- `finalize_exam_attempt` khóa lượt thi, lưu đáp án nếu còn giờ và chấm trong cùng giao dịch. Quá giờ chỉ chấm đáp án đã lưu. Gọi lại sau khi mất phản hồi trả cùng kết quả. `grade_attempt` và `disqualify_attempt` cũ cũng khóa lượt thi để không chấm đè nhau.
- Trang thi tự thử lại mỗi 5 giây khi hết giờ mà chưa chốt được bài; chặn hai yêu cầu nộp đồng thời trong cùng trang. Nút nộp vẫn dùng được sau khi hết giờ để thử lại.
- Lượt mới chụp nội dung, phương án, đáp án, điểm và hạn nộp vào schema `exam_private`. RPC đọc đề không trả đáp án; chấm bài dùng bản chụp. Không backfill đề cũ bằng dữ liệu hiện tại vì không thể biết chắc nội dung tại lúc phát đề.
- Trigger ghi `exam_sync_jobs` cùng giao dịch hoàn thành bài lý thuyết/chấm xong thực hành. Thi thử không vào hàng đợi. Worker thuê công việc trong 2 phút, thử lại sau lỗi với thời gian chờ tăng dần, ghi log cả khi timeout. Mỗi đích học viên/lớp/mô-đun/loại thi chỉ có một việc được xử lý tại một thời điểm. Việc cũ được bỏ qua nếu kết quả mới hơn đã đồng bộ thành công.
- Worker chốt tối đa 50 lượt mới đã quá giờ và xử lý tối đa 10 việc đồng bộ mỗi lần. HTTP phải trả `success: true`, không chỉ HTTP 200. API dùng payload dựng từ database, không nhận điểm từ client.
- Học viên thực hành chỉ đọc bản ghi bài của mình; tạo/nộp đi qua RPC. Máy chủ kiểm tra mã, thời gian và ghi danh khi tạo, yêu cầu minh chứng khi nộp. Học viên không sửa điểm hoặc ảnh sau khi nộp. Quyền chấm của giáo viên SCC được giữ nguyên.
- TypeScript build kiểm tra thêm API, server và test database.

## Xác minh trước sửa

Đã đọc cấu trúc trên project `HPTTS-Unified` ngày 2026-09-29. Database thực tế còn policy học viên `FOR ALL` trên `practical_attempts`; không có trigger bảo vệ điểm. Hàm chấm vẫn đọc `question_bank` hiện hành. Chưa có `pg_cron` và `pg_net` trong project. Chỉ truy vấn metadata, không sửa bản ghi production.

## Kiểm thử

`tests/exam-database.test.ts` chạy migration thật trên PGlite với schema và tài khoản giả: trước/sau hạn, nộp lặp, sai chủ sở hữu, câu hỏi thay đổi, quyền đọc đáp án, đáp án sai ID, hủy bài, bỏ trình duyệt, thi thử, quyền sửa điểm thực hành, ghi danh, mã thi, khóa minh chứng, lease/retry/lease cũ và chống ghi đè kết quả mới hơn.

`server/exam-sync.test.ts` kiểm tra HTTP 200 nhưng báo lỗi, phản hồi HTML, timeout được ghi log và đưa lại hàng đợi, xác nhận thành công, lease hết hiệu lực và xác thực cron.

PGlite không mô phỏng nhiều kết nối độc lập, PostgREST hoặc trình duyệt/camera. Cần diễn tập trên staging trước ca thi thật; không dùng kết quả unit test để tuyên bố đã kiểm thử tải đồng thời.

Hai test Word đã lỗi trước lần sửa này do thay đổi chưa commit trong `question-import.ts` và `word-questions.ts`; các file đó được giữ nguyên.

Kết quả kiểm tra cục bộ: 29/29 test mới đạt; build/TypeScript, ranh giới module và `git diff --check` đạt. ESLint không có lỗi, còn 6 cảnh báo hooks đã có trước. Bộ test toàn repo vẫn có 2 lỗi Word nêu trên.

## Thứ tự triển khai

1. Database phải có schema TTDT hiện hành, gồm `profiles.exam_role`, `get_my_exam_role()` và bảo vệ `profiles.student_id` từ repo quản lý. Đây không phải bộ migration đủ để dựng database mới độc lập.
2. Áp dụng lần lượt `20260929090000_atomic_exam_submission.sql`, `20260929091000_secure_practical_submission.sql`, `20260929092000_exam_sync_outbox.sql`. Đợt triển khai phải ngoài ca thi: việc siết quyền thực hành yêu cầu frontend mới dùng RPC.
3. Triển khai frontend/API cùng bản này. Giữ biến môi trường Supabase/TTDT hiện có. Thêm `CRON_SECRET` ngẫu nhiên ít nhất 32 ký tự, chỉ phía máy chủ.
4. Trong Supabase Vault đặt `exam_maintenance_url` là HTTPS URL thật của `/api/exam-maintenance`, `exam_maintenance_secret` bằng `CRON_SECRET`. Áp dụng `scripts/schedule-exam-maintenance.sql` để chạy mỗi phút. Nếu endpoint có Deployment Protection, cấu hình scheduler được phép truy cập trước khi bật lịch.
5. Gọi thử worker có Authorization, kiểm tra HTTP 200 và kết quả chốt/đồng bộ trên tài khoản thử. Kiểm tra `cron.job_run_details` và phản hồi `net._http_response`; một lần lên lịch HTTP thành công chưa chứng minh endpoint xử lý thành công.
6. Diễn tập hai tab nộp cùng lượt, tắt mạng khi nộp, đóng trình duyệt đến quá giờ, đổi đáp án ngân hàng sau khi phát đề, học viên gọi API sửa điểm thực hành, timeout TTDT và gửi lại cùng lượt.

Không tự bật lịch bằng migration chính: URL và secret phải khớp deployment thật. Chưa bật scheduler thì chỉ có đồng bộ khi gọi API; chưa có đảm bảo tự xử lý khi học viên đóng trình duyệt.

## Giới hạn cần biết

- Lượt tạo trước migration giữ đường đọc/chấm cũ và không được worker tự chốt. Không tự gửi lại hàng loạt điểm lịch sử. Admin vẫn có thể yêu cầu đồng bộ một lượt cũ qua API.
- Vận chuyển điểm là at-least-once: timeout có thể xảy ra sau khi TTDT nhận điểm. Hệ nhận phải chịu được gửi lại cùng `attempt_id`; endpoint hiện tại upsert theo ghi danh/mô-đun. Không tuyên bố exactly-once qua HTTP.
- Chưa xây quy trình phúc khảo/chấm lại sau khi hàng đợi đã thành công; việc đổi điểm cần một sự kiện đồng bộ có phiên bản riêng.
- Chưa thay đổi thời điểm bắt đầu tính giờ, lưu nháp offline, cơ chế AI hoặc phần nhập Word đang làm dở. Đây là các hạng mục tiếp theo, không thuộc đợt củng cố năm ưu tiên này.

Tham khảo: [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions), [Vercel duration](https://vercel.com/docs/functions/configuring-functions/duration).
