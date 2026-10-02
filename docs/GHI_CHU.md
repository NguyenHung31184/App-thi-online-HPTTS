# Ghi Chú — App Thi Online HPTTS

> Ghi chú kỹ thuật lâu dài: quyết định thiết kế, bài học từ sự cố, cảnh báo cần nhớ.
> Không phải nhật ký (DIARY.md), không phải cấu trúc (PROJECT_STRUCTURE.md).

---

## E-Learning (2026-06-11)

- **Migration `elearning_*` CHỈ ở repo app chính** (QuanlyTTDT-HPTTS/supabase/migrations). Repo này dùng chung bảng qua Supabase chung — không tạo migration elearning ở đây để tránh lệch schema.
- Repo này dùng **types viết tay** (`src/types/index.ts`), không gen từ Supabase — khi app chính đổi schema elearning phải cập nhật tay types tương ứng.
- Học viên có **Supabase auth thật** (`username@hptts.vn`) — RLS `elearning_progress` dựa `auth.uid()`. Phiên CCCD (VerifyCccdPage) chỉ là xác minh danh tính khi thi, không thay thế auth.
- `modules.id`, `students.id` bên TTDT là **TEXT**, không phải uuid.
- Video iframe (YouTube/Drive) không tracking được thời gian xem → hoàn thành bằng nút bấm tay; video HTML5 (mp4 trực tiếp) tự hoàn thành ở 90%.

---

## Kiểm thử đăng nhập trên bản local (2026-10-02)

- Kịch bản Edge chép phiên Supabase của tab production sang `localhost` để xem bản local bằng tài khoản admin.
  **Không bấm "Đăng xuất" trên bản local**: `supabase.auth.signOut()` mặc định thu hồi mọi phiên của tài khoản, kể cả
  tab production. Muốn thử trạng thái chưa đăng nhập thì xóa các khóa `sb-*` trong `localStorage` của localhost.
- Nhật ký đồng bộ chỉ hiện khi `VITE_TTDT_SYNC_ENABLED=1` (đặt trên Vercel); bản local cần biến này để so với production.

## Hai luồng auth (từ trước)

| Luồng | Ai | Cách |
|-------|----|------|
| Admin/Teacher | Staff | Supabase Auth → role trong app thi chỉ lấy từ `profiles.exam_role` (`identity-access/domain/access.ts`); `get_my_role()` phía database ưu tiên `satellite_role` |
| Học viên thi | Thí sinh | Đăng nhập `@hptts.vn` + xác thực CCCD qua Edge Function `verify-cccd-for-exam` |
