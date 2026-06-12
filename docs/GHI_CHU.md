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

## Hai luồng auth (từ trước)

| Luồng | Ai | Cách |
|-------|----|------|
| Admin/Teacher | Staff | Supabase Auth → role từ `profiles` (`get_my_role()` ưu tiên `satellite_role`) |
| Học viên thi | Thí sinh | Đăng nhập `@hptts.vn` + xác thực CCCD qua Edge Function `verify-cccd-for-exam` |
