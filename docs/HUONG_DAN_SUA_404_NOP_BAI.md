# Sửa lỗi 404 khi nộp bài (grade_attempt)

## Tại sao phiên bản trước nộp được?

Thường do một trong các lý do sau:

1. **Project Supabase khác**  
   Phiên bản trước (local hoặc bản deploy cũ) có thể đang dùng **một project Supabase khác** (URL trong `.env` hoặc biến môi trường Vercel). Project đó đã được chạy migration / script tạo sẵn function `grade_attempt`.  
   Bản hiện tại (ví dụ Vercel) đang trỏ tới project **vmtztbmlzszuxkglubro** – nếu project này **chưa từng chạy** script tạo RPC thì sẽ bị 404.

2. **Project mới hoặc đã reset**  
   Tạo project Supabase mới hoặc restore từ backup mà không có bảng/function từ migration → không có `grade_attempt` → 404.

3. **Script chưa chạy trên đúng project**  
   Script `FIX_404_grade_attempt_run_in_supabase.sql` phải chạy trên **đúng project** mà app đang gọi (xem URL trong lỗi: `https://vmtztbmlzszuxkglubro.supabase.co/...`).

---

## Cách xử lý (bắt buộc làm trên đúng project)

### Bước 1: Xác định project app đang dùng

- Mở app → F12 → Network → nộp bài → xem request bị 404.
- URL sẽ dạng: `https://**xxxx**.supabase.co/rest/v1/rpc/grade_attempt`  
  → Project ID là **xxxx** (ví dụ `vmtztbmlzszuxkglubro`).

### Bước 2: Kiểm tra function đã tồn tại chưa

1. Vào [Supabase Dashboard](https://supabase.com/dashboard) → chọn **đúng project** (xxxx).
2. Menu trái: **SQL Editor** → New query.
3. Chạy:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'grade_attempt';
```

- **Có 1 dòng** → function đã có, 404 có thể do quyền (xem Bước 4).
- **Không có dòng** → cần chạy script ở Bước 3.

### Bước 3: Tạo function và quyền (khi chưa có)

1. Vẫn trong **SQL Editor** của **đúng project**.
2. Mở file `docs/FIX_404_grade_attempt_run_in_supabase.sql` trong repo.
3. Copy **toàn bộ** nội dung file vào ô soạn thảo.
4. Bấm **Run**.
5. Nếu báo lỗi: chụp/ghi lại nội dung lỗi (có thể thiếu bảng `attempts`, `questions`, `profiles`…).

### Bước 4: Reload schema (nên làm sau khi tạo function)

1. Trong project đó: **Project Settings** (icon bánh răng) → **API**.
2. Kéo xuống tìm **Reload schema** (hoặc tương tự) và bấm reload.
3. Đợi vài giây rồi thử nộp bài lại.

### Bước 5: Nếu deploy Vercel – kiểm tra biến môi trường

- Vercel → Project App Thi → **Settings** → **Environment Variables**.
- Kiểm tra `VITE_SUPABASE_URL`: phải trùng với project mà bạn vừa chạy script (ví dụ `https://vmtztbmlzszuxkglubro.supabase.co`).
- Nếu sửa biến thì cần **Redeploy** để app dùng URL mới.

---

## Tóm tắt

| Triệu chứng | Nguyên nhân | Hành động |
|-------------|-------------|-----------|
| POST .../rpc/grade_attempt 404 | Chưa có function trên project đó | Chạy `FIX_404_grade_attempt_run_in_supabase.sql` trên **đúng** project (Bước 3). |
| Đã chạy script vẫn 404 | Sai project hoặc schema chưa reload | Kiểm tra URL 404 = đúng project → Reload schema (Bước 4). |
| Phiên bản trước nộp được | Trước dùng project đã có sẵn `grade_attempt` | Đảm bảo project hiện tại (theo `VITE_SUPABASE_URL`) cũng đã chạy script. |

Script nằm tại: **`docs/FIX_404_grade_attempt_run_in_supabase.sql`**.
