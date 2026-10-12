# Nghiệm thu và vận hành App thi online HPTTS

Cập nhật 06/10/2026. Đây là quy trình cần thực hiện, không phải biên bản đã nghiệm thu. Mã nguồn đã qua kiểm thử tự động và browser local dùng dữ liệu giả; chưa xác nhận camera AI, media thật, TTDT thật hoặc tải đồng thời. Migration sửa lỗi và frontend/API mới chưa triển khai production trong phiên làm việc này.

## 1. Chuẩn bị môi trường

Người phụ trách kỹ thuật chuẩn bị URL HTTPS chạy cả frontend và các API trong `api/`. `npm run dev` và `npm run preview` của repo chỉ chạy Vite, không đủ nghiệm thu các API server.

Ưu tiên Vercel Preview với Supabase và đầu nhận TTDT dành riêng cho thử nghiệm. Preview phải dùng biến môi trường trỏ tới dữ liệu thử; một URL Preview dùng database production vẫn có thể ghi dữ liệu production. Vercel cho phép tách biến môi trường Preview/Production: [tài liệu môi trường](https://vercel.com/docs/deployments/environments), [biến môi trường](https://vercel.com/docs/environment-variables).

- Sao lưu database và file minh chứng/media, thử phục hồi trên môi trường riêng. Backup database Supabase không chứa file Storage: [tài liệu backup](https://supabase.com/docs/guides/platform/backups).
- Đối chiếu lịch sử migration với database đích; áp dụng migration còn thiếu theo thứ tự. Áp dụng `supabase/migrations/20261006151544_exam_audit_fixes.sql` trước frontend/API mới. Không chạy lại toàn bộ migration mù trên database đang có dữ liệu.
- Kiểm tra schema/RPC học theo phiên bản của TTDT đã có trên môi trường đích.
- Deploy frontend và API tương ứng cùng một bản mã nguồn. Ghi URL, phiên bản/commit và thời điểm deploy vào biên bản.
- Cấu hình server `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TTDT_RECEIVE_GRADES_URL`, `TTDT_VERIFY_CCCD_URL`, `TTDT_API_KEY`, `CRON_SECRET`; cấu hình OCR/Redis theo `.env.example` nếu nghiệm thu OCR. Khóa bí mật chỉ đặt phía server, không thêm tiền tố `VITE_`.
- Cấu hình Vault `exam_maintenance_url` là endpoint HTTPS `/api/exam-maintenance` của đúng môi trường và `exam_maintenance_secret` trùng `CRON_SECRET`. Sau đó áp dụng `scripts/schedule-exam-maintenance.sql` để chạy mỗi phút. Kiểm tra cron thực sự chạy và HTTP trả thành công; chỉ thấy tên job chưa đủ.

## 2. Chuẩn bị người và dữ liệu thử

Chuẩn bị một người quản trị, một giáo viên/giám thị và 3–5 học viên thử có mã học viên/lớp/mô-đun TTDT đúng. Dùng máy, camera, mạng và trình duyệt dự kiến dùng trong kỳ thi. Nếu hỗ trợ điện thoại, phải nghiệm thu riêng trên điện thoại thật.

Tạo lớp thử, đề ngắn 5–10 phút có đáp án và điểm kỳ vọng được giáo viên tính trước; có bài đạt, chưa đạt, sát ngưỡng và bị đình chỉ. Tạo cửa sổ **thi thử** để kiểm tra thao tác. Chuẩn bị riêng cửa sổ **không phải thi thử**, chỉ dành cho học viên thử, trên môi trường TTDT thử để kiểm tra gửi điểm: bài thi thử được bỏ qua khi gửi TTDT.

Chuẩn bị một chuỗi bài học được giao theo phiên bản gồm bài đọc/PDF, YouTube và video khác đang dùng thực tế. Giữ lại mã assignment/enrollment để đối chiếu. Quiz/SCORM chưa được nghiệm thu hoàn chỉnh; không đưa vào phạm vi vận hành như một chức năng đã hoàn tất.

## 3. Checklist nghiệm thu

Mỗi ca ghi: URL/phiên bản, thiết bị/trình duyệt, thời gian, mã tài khoản thử, attempt/assignment ID, kỳ vọng, kết quả, ảnh/log và người xác nhận. Không chép API key hay ảnh CCCD vào báo cáo công khai.

| Mã | Thao tác bằng tài khoản thật | Kết quả cần đối chiếu | Đạt/chưa đạt |
| --- | --- | --- | --- |
| T01 | Đăng nhập từng vai trò; học viên A mở link bài làm của B | Chặn xem/làm bài của người khác; giáo viên/giám thị chỉ xem trong phạm vi quyền | |
| T02 | OCR CCCD, kiểm tra liên kết học viên; thử CCCD không khớp | API thật hoạt động; danh tính, lớp, quyền thi đúng; trường hợp sai không được cấp quyền nhầm | |
| T03 | Nhập mã thi sai/đúng; thử ngoài giờ và sai lớp | Chỉ học viên hợp lệ trong thời gian cho phép vào bài | |
| T04 | Chọn đáp án, đợi autosave ít nhất 10 giây; F5 và đăng nhập lại | Tiếp tục đúng attempt, giữ đáp án đã lưu; thời gian không bắt đầu lại | |
| T05 | Mất mạng rồi nối lại; thử mất mạng đúng lúc nộp bài | Báo trạng thái rõ; đối chiếu đáp án đã lưu; khi kết nối lại xác định đúng trạng thái server, không tạo kết quả trùng | |
| T06 | Nộp bình thường, bấm nộp liên tiếp; hết giờ khi còn mở trang | Một kết quả cuối cùng; chấm đúng đáp án đã lưu; không sửa bài sau hoàn thành | |
| T07 | Đóng trình duyệt trước khi hết giờ; chờ deadline và cron | Server hoàn tất bài dựa trên đáp án đã lưu; kiểm tra log maintenance và trạng thái database, không dựa vào bộ đếm UI | |
| T08 | So điểm tính tay với chi tiết, danh sách, báo cáo và TTDT | Điểm và Đạt/Chưa đạt nhất quán; 69,6/100 với ngưỡng 70 là Chưa đạt; đình chỉ không Đạt | |
| T09 | Thoát fullscreen/chuyển tab, mỗi lần độc lập cách hơn 3 giây; F5 sau lần thứ 2; đủ 5 lần | Bộ đếm không mất khi tải lại; không đếm đôi một sự kiện; lần thứ 5 đình chỉ và điểm 0 phía server | |
| T10 | Cho/từ chối quyền camera; thử không mặt, nhiều mặt và vật cấm nếu bật nhận diện vật | Hướng dẫn quyền camera đúng; giám thị xác minh cảnh báo và minh chứng trên thiết bị thật, ghi cả cảnh báo nhầm | |
| T11 | Thử từng chế độ standard/strict/supervised dự kiến sử dụng | Hành vi theo chính sách thực tế; AI không dùng chung ngưỡng 5 vi phạm trình duyệt. Strict tự nộp khi risk đạt ngưỡng và đủ incident; thử tín hiệu kéo dài và phục hồi | |
| T12 | Lưu nháp tự luận thiếu khóa chấm, sau đó thử xuất bản/phát đề | Nháp được lưu; thiếu tiêu chí chấm bị chặn ở bước xuất bản/phát đề | |
| T13 | Phát đề, hoàn thành bài; sửa ngân hàng rồi xem lại bài trên môi trường thử | Bài có snapshot vẫn giữ câu hỏi/đáp án đã phát. Không kỳ vọng phục hồi snapshot của bài legacy chưa từng lưu | |
| T14 | Mở bài học sau trước; hoàn thành bài trước; thử assignment người khác/hết hạn | Đúng thứ tự, đúng enrollment/phiên bản; truy cập không hợp lệ bị chặn | |
| T15 | Phát video thật, tua tới cuối, tải lại, xem đủ ít nhất 90%; xác nhận bài đọc/PDF/YouTube | Tua không tự hoàn thành video theo dõi thời gian; giữ tiến độ; server xác nhận mở bài tiếp. Đọc/PDF/YouTube dùng xác nhận thủ công theo quy tắc hiện hành | |
| T16 | Xuất bản phiên bản bài học mới sau khi đã giao bản cũ | Học viên giữ đúng phiên bản đã giao; phân biệt assignment cũ và mới | |
| T17 | Nộp bài không phải thi thử; kiểm tra TTDT; làm lỗi đầu nhận rồi khôi phục trên môi trường thử | Outbox/log ghi đúng; gửi lại thành công; TTDT nhận đúng học viên/lớp/mô-đun/điểm và không nhân đôi bản ghi | |
| T18 | Chấm thực hành nếu đưa vào vận hành; đối chiếu từng tiêu chí và tổng với TTDT | Điểm, đình chỉ và trạng thái chấm/gửi khớp; không gửi trước khi chấm xong | |

T10–T11 cần người thật trước camera, đủ thời gian nhận diện và phục hồi; một ảnh hoặc một lần rời khung hình không đủ kết luận. Nếu AI báo nhầm nhiều trong phòng thi thực tế, chưa đưa chế độ tự đình chỉ bằng AI vào kỳ thi chính thức trước khi hiệu chỉnh và nghiệm thu lại.

Các vấn đề ngoài 6 sửa lỗi, gồm liên kết CCCD và thay đổi cấu hình ngưỡng ảnh hưởng kết quả lịch sử, vẫn cần kiểm tra. Trong kỳ thi, khóa việc sửa đề/blueprint/ngưỡng và quyền quản trị; không coi tỷ lệ modular monolith là tỷ lệ chức năng đã nghiệm thu.

## 4. Thi đồng thời và quyết định mở vận hành

Sau khi checklist với 3–5 người đạt, tổ chức buổi diễn tập với số máy đồng thời bằng quy mô lớp dự kiến. Mọi người cùng vào thi, lưu đáp án và nộp gần nhau; giám thị theo dõi trạng thái trực tiếp. Ghi thời gian mở đề/lưu/nộp, số lỗi, số bài đã hoàn thành, số job pending/failed và số điểm TTDT đã nhận. Chốt mức thời gian chấp nhận trước buổi diễn tập; không suy ra sức chịu tải từ build hoặc unit test.

Chỉ mở một lớp thí điểm khi toàn bộ luồng sử dụng bắt buộc đã đạt, không còn lỗi mất đáp án, sai điểm, truy cập nhầm, nộp thất bại hoặc gửi TTDT sai/trùng; backup và cron đã kiểm chứng. Bất kỳ ca nào chưa chạy thì ghi “chưa kiểm chứng”, không đánh dấu đạt. Sửa lỗi rồi chạy lại ca liên quan trước khi mở rộng sang các lớp khác.

## 5. Công việc mỗi ca thi

- **Trước ca:** kiểm tra URL/bản phát hành, danh sách lớp và mã học viên, cửa sổ thi, đề/ngưỡng, camera/mạng, cron, TTDT và chỗ lưu minh chứng. Không deploy hoặc chỉnh cấu hình đề khi đang có bài làm.
- **Trong ca:** giám thị theo dõi học viên mất kết nối/cảnh báo; kỹ thuật theo dõi API lỗi, bài quá hạn và outbox. Ghi thời gian và attempt ID khi có sự cố.
- **Sau ca:** đối chiếu danh sách dự thi với bài đã hoàn tất; kiểm tra điểm và Đạt/Chưa đạt; giải quyết job thất bại, đối chiếu TTDT; lưu biên bản và bản sao kết quả/minh chứng.
- **Khi sự cố:** ngừng mở lượt thi mới nếu ảnh hưởng tính đúng đắn; giữ dữ liệu bài làm/audit/snapshot, xác định trạng thái server trước khi cho thi lại. Không xóa attempt hoặc chỉnh điểm trực tiếp để chữa nhanh.

Rollback cần kiểm tra tương thích database: policy mới chặn cách ghi vi phạm của frontend cũ. Không chỉ đổi về frontend cũ và mặc định hệ thống sẽ hoạt động; ưu tiên bản sửa tương thích, giữ toàn bộ dữ liệu thi.

## 6. Kiểm tra mã nguồn trước mỗi bản phát hành

Chạy từ `D:\Data\App-thi-online-HPTTS`:

```powershell
npm.cmd run check:boundaries
npm.cmd run arch:score -- --check
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Các lệnh này không thay thế checklist với dịch vụ và thiết bị thật. Người phụ trách kỹ thuật chịu trách nhiệm môi trường/migration/API/cron/log; giáo viên xác nhận đề và điểm; giám thị và học viên thực hiện thao tác/camera trên máy thật.
