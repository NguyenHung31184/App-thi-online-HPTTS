# Khôi phục sau đợt củng cố ca thi

Chưa triển khai: bỏ riêng các thay đổi của đợt này bằng diff đã rà soát; không dùng reset toàn repo vì hai file Word có thay đổi của người dùng.

Đã triển khai:

1. Tạm ngừng tạo lượt mới và ghi nhận các lượt đang làm. Tắt lịch `exam-maintenance` trước khi thay worker.
2. Có thể quay lại frontend/API cũ để xử lý lỗi giao diện, nhưng giữ các hàm chấm dùng snapshot và bảng `exam_private.attempt_papers`: lượt mới đã phát phụ thuộc dữ liệu này.
3. Không tự khôi phục policy `FOR ALL` cho học viên thực hành. Nếu RPC gặp lỗi, sửa tiến về phía trước hoặc tạm dừng luồng thực hành; khôi phục quyền cũ sẽ mở lại quyền sửa điểm.
4. Giữ `exam_sync_jobs` để bảo toàn việc chờ và trạng thái đã gửi. Chỉ bật lại worker sau khi xác minh endpoint/secret và quyền claim/finish.
5. `2026-09-29-exam-functions-before.sql` là bản thân hàm được đọc từ production trước thay đổi, dùng đối chiếu. Không chạy nguyên file sau khi đã có lượt dùng snapshot: chấm lại bằng ngân hàng hiện hành có thể làm sai kết quả.

Không xóa snapshots, điểm, nhật ký hoặc hàng đợi để rollback code.
