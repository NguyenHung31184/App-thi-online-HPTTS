# Ghi Chú — App Thi Online HPTTS

> Ghi chú kỹ thuật lâu dài: quyết định thiết kế, bài học từ sự cố, cảnh báo cần nhớ.
> Không phải nhật ký (DIARY.md), không phải cấu trúc (PROJECT_STRUCTURE.md).

---

## Xuất Excel (2026-10-20)

- Mọi file Excel xuất ra đi qua `src/shared/lib/excel-workbook.ts` (exceljs, học theo app quản lý): Times New Roman,
  bảng kẻ khung, dòng tiêu đề tô màu, cố định và lặp lại khi in, có nút lọc, A4 ngang vừa khổ, số và ngày giữ đúng kiểu.
- Báo cáo (kết quả thi, tín hiệu giám sát, ngân hàng của đề) có phần đầu: tên đơn vị, tên báo cáo, phạm vi, giờ xuất.
- File được nhập lại (xuất câu hỏi, mẫu nhập câu hỏi, mẫu phiếu chấm thực hành) KHÔNG có phần đầu: trình đọc tìm tên cột
  ở dòng 1. Có test đọc lại bằng chính hàm nhập (`excel-roundtrip.test.ts`, `excel-template.test.ts`).
- Ngày giờ: exceljs ghi Date theo UTC, nên cột ngày giờ nhận epoch ms và builder dời theo múi giờ máy để Excel hiện
  đúng giờ Việt Nam.
- Đọc file nhập vẫn dùng SheetJS (`xlsx`); không thêm `file-saver`, tải file bằng `saveBlob`.

## Mã truy cập kỳ thi và khóa sau 5 lần sai (2026-10-16)

- Mỗi cửa sổ thi có mã riêng; kỳ thi thử và kỳ thi thật là hai cửa sổ khác nhau, khác mã. Học viên đã thi thử dễ nhập
  lại mã cũ. Giám thị đọc mã mới lúc vào phòng và nói rõ không dùng mã thi thử.
- `start_exam_attempt` sai mã thì trả NULL (PostgREST gửi về một dòng toàn cột null); app phải kiểm tra `attempt.id`.
- Sai 5 lần trong 10 phút thì khóa 10 phút ở cửa sổ đó (`exam_access_failures`). Người bị khóa chưa có lượt làm bài nên
  không hiện ở bảng giám sát; xem và mở khóa ở khối "học viên đang nhập sai mã" đầu màn Giám sát trực tiếp. Mỗi lần mở
  khóa ghi vào `exam_access_unlocks`.

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
