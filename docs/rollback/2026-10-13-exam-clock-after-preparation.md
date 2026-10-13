# Rollback: đồng hồ làm bài chạy sau bước chuẩn bị (2026-10-13)

Migration: `supabase/migrations/20261013100000_exam_clock_starts_after_preparation.sql`.
Quyết định của chủ dự án ngày 13/10/2026: giờ làm bài tính từ lúc chụp xong ảnh khuôn mặt; chuẩn bị tối đa 5 phút,
quá thì đồng hồ tự chạy; hạn nộp không vượt giờ đóng kỳ thi.

## Cách hoạt động

- Lượt thi mới: `exam_private.attempt_papers.deadline` = bắt đầu + 5 phút + thời lượng (không quá giờ đóng kỳ thi).
- Trang thi gọi `begin_exam_clock(attempt_id)` khi chụp xong ảnh khuôn mặt. Máy chủ kéo hạn nộp về
  (lúc gọi, không muộn hơn bắt đầu + 5 phút) + thời lượng, ghi `clock_started_at` và một dòng `exam_clock_started`.
  Gọi lại không đổi gì.
- Trang không gọi được (bản cũ còn trong bộ nhớ đệm, mất mạng): học viên giữ hạn muộn nhất, tức dư tối đa 5 phút.
- Lượt thi có trước migration: `clock_started_at` = `started_at`, hạn nộp giữ nguyên.

## Lùi code

`git revert` commit frontend. Trang không còn gọi `begin_exam_clock`; nếu migration vẫn còn thì mọi lượt thi mới
được dư 5 phút. Vì vậy lùi code thì lùi luôn database bằng migration sửa tiến dưới đây.

## Lùi database (migration mới, chạy thử trước, cần chủ dự án duyệt)

1. `CREATE OR REPLACE FUNCTION exam_private.capture_attempt_paper()` với công thức cũ:
   `LEAST(w.end_at, NEW.started_at + e.duration_minutes::bigint * 60000)` (bản đầy đủ ở
   `20260929090000_atomic_exam_submission.sql`).
2. `DROP FUNCTION public.begin_exam_clock(uuid);` sau khi frontend đã lùi.
3. Giữ cột `clock_started_at` và hàm `preparation_allowance_ms()`; chúng không ảnh hưởng gì khi không ai dùng.
4. Lượt thi đang làm dở lúc lùi: không sửa `deadline` của chúng.

Không xóa dòng `exam_clock_started` trong `attempt_audit_logs`.
