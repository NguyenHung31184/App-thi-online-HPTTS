# Giáo viên chuyên ngành Lý thuyết — Tìm trong App quản lý & Đăng nhập App thi online

## 1. Tìm các tài khoản GV chuyên ngành "Lý thuyết" trong App quản lý

Trong **app quản lý TTDT** (QuanlyTTDT-HPTTS), giảng viên được lưu ở bảng **`instructors`**. Cột **`specialization`** lưu chuyên ngành (ví dụ: "Lý thuyết", "Thực hành").

### SQL: Liệt kê GV có chuyên ngành Lý thuyết

Chạy trên **cùng Supabase** mà app quản lý và app thi online đang dùng:

```sql
-- GV chuyên ngành Lý thuyết (có thể tham gia xây dựng bộ câu hỏi / ngân hàng câu hỏi)
SELECT id, name, email, phone, specialization
FROM public.instructors
WHERE (is_deleted IS NULL OR is_deleted = false)
  AND (
    TRIM(specialization) ILIKE '%lý thuyết%'
    OR TRIM(specialization) = 'Lý thuyết'
  )
ORDER BY name;
```

- **`id`**: mã GV (dùng để đối chiếu nếu sau này gắn với profile).
- **`email`**: dùng làm **tài khoản đăng nhập** App thi online (bắt buộc phải có email).
- Những GV này là ứng viên để được cấp quyền **teacher** trong App thi online, dùng Soạn câu hỏi / Ngân hàng câu hỏi.

---

## 2. Cách GV này đăng nhập App thi online

App thi online dùng **Supabase Auth** (email + mật khẩu). Vai trò hiển thị và phân quyền lấy từ bảng **`profiles`** (cột **`role`**).

### Điều kiện để GV lý thuyết đăng nhập được

1. **Tài khoản Supabase Auth** (bảng `auth.users`):
   - Tồn tại user có **email** trùng với `instructors.email` (ví dụ `gvlythuyet@hptts.vn`).
   - User đó có **mật khẩu** đã được đặt (qua Supabase Dashboard, Admin API, hoặc chức năng "Tạo user cho GV" trong app quản lý nếu có).

2. **Bảng `profiles`** (public):
   - Có một dòng với **`id` = UUID của user trong `auth.users`**.
   - Cột **`role`** = **`'teacher'`** (để App thi online nhận diện là Giáo viên).

Khi đó GV vào App thi online → chọn vai trò **Giáo viên** → nhập **email + mật khẩu** → đăng nhập. App sẽ đọc `profiles.role = 'teacher'` và cho vào Dashboard giáo viên (thống kê, có thể mở rộng Soạn câu hỏi / Ngân hàng câu hỏi theo phân quyền bạn thiết kế).

---

## 3. Quy trình cho Admin: Cấp quyền GV lý thuyết vào App thi online

### Bước 1: Lấy danh sách GV lý thuyết (có email)

Chạy câu SQL ở mục 1 để export danh sách `id, name, email`.

### Bước 2: Tạo tài khoản đăng nhập (nếu chưa có)

- **Cách A — Supabase Dashboard:**  
  Authentication → Users → Add user → nhập **email** (đúng với `instructors.email`) và **password** → gửi link xác thực hoặc set "Auto Confirm User" tùy cấu hình.

- **Cách B — App quản lý:**  
  Nếu app quản lý có chức năng "Tạo tài khoản đăng nhập cho giảng viên" (tạo user Supabase + profile), dùng chức năng đó với email GV lý thuyết và set role tương ứng (xem bước 3).

- **Cách C — Script/Edge Function:**  
  Gọi Supabase Admin API `auth.admin.createUser({ email, password })` rồi insert `profiles` (xem bước 3).

Sau khi tạo, có **UUID** của user trong `auth.users`.

### Bước 3: Gắn role `teacher` trong bảng `profiles`

- Nếu **trigger** của app quản lý đã tạo sẵn dòng trong `profiles` khi tạo user: chỉ cần **cập nhật** role:

```sql
UPDATE public.profiles
SET role = 'teacher'
WHERE id = '<uuid_user_vừa_tạo>' AND (role IS NULL OR role != 'teacher');
```

- Nếu **chưa có** dòng trong `profiles`: thêm mới (cần có `id` = auth user id):

```sql
INSERT INTO public.profiles (id, email, name, role)
VALUES (
  '<uuid_user_vừa_tạo>',
  'email_gv@hptts.vn',
  'Tên GV Lý thuyết',
  'teacher'
)
ON CONFLICT (id) DO UPDATE SET role = 'teacher', name = EXCLUDED.name, email = EXCLUDED.email;
```

Lưu ý: Bảng `profiles` trong app thi online có thể chỉ có cột `id, role, student_id`; nếu app quản lý có thêm `email, name` thì dùng cho đồng bộ, không ảnh hưởng đăng nhập.

### Bước 4: Hướng dẫn GV đăng nhập App thi online

1. Mở App thi online (URL bạn triển khai).
2. Chọn **"Chọn vai trò"** → **Giáo viên (Instruction)**.
3. Nhập **email** (đúng với email đã cấp) và **mật khẩu**.
4. Sau khi đăng nhập, GV sẽ thấy Dashboard giáo viên; bạn có thể cấp thêm quyền Soạn câu hỏi / Ngân hàng câu hỏi cho role `teacher` trong App thi online.

---

## 4. Kiểm tra nhanh: GV đã có tài khoản App thi online chưa?

Nếu **app quản lý và app thi online dùng chung Supabase**, có thể kiểm tra GV lý thuyết nào đã có profile với role teacher:

```sql
SELECT i.id, i.name, i.email, i.specialization,
       p.id AS profile_id, p.role
FROM public.instructors i
LEFT JOIN public.profiles p ON LOWER(TRIM(p.email)) = LOWER(TRIM(i.email))
WHERE (i.is_deleted IS NULL OR i.is_deleted = false)
  AND (TRIM(i.specialization) ILIKE '%lý thuyết%' OR TRIM(i.specialization) = 'Lý thuyết')
ORDER BY i.name;
```

- `profile_id` và `role` NULL → chưa có tài khoản; cần tạo user + profile như bước 2–3.
- `role = 'teacher'` → đã cấp quyền GV, có thể đăng nhập App thi online bằng email đó.

---

## Tóm tắt

| Việc | Nơi thực hiện |
|------|----------------|
| Tìm GV chuyên ngành Lý thuyết | App quản lý / SQL: bảng `instructors`, cột `specialization` = "Lý thuyết" (hoặc ILIKE '%lý thuyết%'). |
| Tài khoản đăng nhập | Supabase Auth: email = `instructors.email`, có mật khẩu. |
| Vai trò Giáo viên trong App thi online | Bảng `profiles`: `role = 'teacher'` cho user tương ứng. |
| Cách GV đăng nhập | Vào App thi online → Chọn vai trò Giáo viên → Nhập email + mật khẩu đã cấp. |

Những GV này sau khi đăng nhập với role `teacher` có thể được bạn cấu hình thêm quyền truy cập **Soạn câu hỏi** và **Ngân hàng câu hỏi** trong App thi online (tùy cách bạn phân quyền cho role `teacher` trong code).
