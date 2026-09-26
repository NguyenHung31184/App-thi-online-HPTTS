# ROLLBACK — App thi online HPTTS

Mỗi dòng = 1 điểm khôi phục. Thêm entry MỚI Ở ĐẦU.

---

## 2026-09-26 — Giao diện app thi theo nhận diện HPTTS

**Commit:** _(commit này)_
**Branch:** main

Chỉ đổi giao diện (theme trong `src/index.css`, khung, trang đăng nhập, thẻ, nút). Rollback: `git revert <sha>`; chi tiết ở
`docs/rollback/2026-09-26-hptts-brand-identity.md`. Chỉnh màu thì sửa tiến ở `src/index.css`.

---

## 2026-09-26 — Chặn route giáo viên: `/admin` chỉ khớp chính nó

**Commit:** `5305972`, push 2026-09-26
**Branch:** main

Chỉ đổi code trình duyệt. Rollback: `git revert <sha>`; chi tiết ở `docs/rollback/2026-09-26-teacher-route-guard.md`.

---

## 2026-09-26 — Vitest và CI GitHub

**Commit:** `d502acc`, push 2026-09-26
**Branch:** main

Thêm dev dependency `vitest`, `vitest.config.ts`, test đầu tiên và `.github/workflows/ci.yml`; không đổi code chạy thật.
Rollback: `git revert <sha>`; chi tiết ở `docs/rollback/2026-09-26-vitest-and-ci.md`.

---

## 2026-09-26 — "Khóa đề thi" kiểm tra ngân hàng câu hỏi mà hàm bốc đề dùng

**Commit:** `e638b88`, push 2026-09-26
**Branch:** main

Chỉ đổi code phía trình duyệt, không đổi DB. Rollback: `git revert <sha>` rồi push; chi tiết ở
`docs/rollback/2026-09-26-lock-exam-checks-question-bank.md`. Đề đã khóa vẫn giữ `locked_at`; mở khóa bằng nút "Mở khóa đề".

---

## 2026-09-24 — Phase C2: một kho câu hỏi (ngân hàng theo mô-đun)

**Commit (push 2026-09-26):** `0e2e7de` gộp kho (migration `20260924111343`), `46fca4f` editor, `750902f` nhập Excel/ZIP, `77a07d7` bỏ màn cũ; cùng lần push: `ce1beb7` quyền từ `exam_role`
**Branch:** main

Mỗi bước có tài liệu rollback riêng trong `docs/rollback/`:
- `2026-09-24-phase-c2-single-question-store.md` (DB, sửa tiến bằng migration mới, không xóa dữ liệu)
- `2026-09-24-c2-question-editor.md`, `2026-09-24-c2-excel-zip-import.md`, `2026-09-24-c2-retire-old-question-store.md` (code: `git revert <sha>`)

Câu nhập từ file có `source = 'spreadsheet_import'`; câu xóa là xóa mềm, khôi phục bằng `is_deleted = false`.

---

## 2026-06-11 — Tính năng Học trực tuyến (E-Learning lát 1)

**Commit:** _(sau khi push)_
**Branch:** main

### Những gì đã thay đổi
- **DB:** bảng `elearning_*` do migration `20260611000000_elearning_module.sql` đặt tại **repo app chính** (QuanlyTTDT-HPTTS) — repo này KHÔNG có migration elearning riêng
- **Mới:** `src/services/elearningStudyService.ts` — đọc bài học/khối theo mô-đun lớp (enrollments → classes → course_modules), ghi `elearning_progress`
- **Mới:** `src/pages/StudentLearnPage.tsx` (danh sách bài, học tuần tự) + `src/pages/LessonPlayerPage.tsx` (player video/pdf/article)
- **Sửa:** `src/App.tsx` (route `/student/learn`, `/student/learn/:lessonId`), `src/pages/Layout.tsx` (nav "Học trực tuyến"), `src/types/index.ts` (types Elearning*)

### Cách rollback
```bash
git revert HEAD   # code app thi
```
```sql
-- DB (chạy ở repo app chính nếu cần gỡ hoàn toàn — mất dữ liệu e-learning):
DROP TABLE elearning_progress, elearning_quiz_items, elearning_lesson_blocks, elearning_lessons;
```

---

## 2026-05-24 — Fix get_my_role() nhận satellite_role, thêm module_id vào đề TH

**Commit:** _(sau khi push)_
**Branch:** main

### Những gì đã thay đổi
- **Migration:** `20260524150000_fix_get_my_role_satellite.sql` — sửa `get_my_role()`:
  - Ưu tiên `satellite_role` nếu là `'teacher'` hoặc `'admin'`
  - Fallback về `profiles.role` nếu `satellite_role` NULL (App thi online native users không bị ảnh hưởng)
  - Giải quyết: GV thực hành trong SCC không vào được `practical_exam_*` vì TTDT CHECK constraint chặn `role='teacher'`
- **Migration đã apply trước:** `20260524090000_practical_template_module_id.sql` — thêm `module_id TEXT` vào `practical_exam_templates`
- **Sửa:** `AdminOccupationQuestionsPage.tsx` + `src/types/index.ts` — thêm hỗ trợ inline-edit cho loại câu hỏi `true_false_multi` và `matching`

### Cách rollback
```sql
-- Khôi phục get_my_role() về bản gốc:
CREATE OR REPLACE FUNCTION get_my_role() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;
```
```bash
git revert HEAD
```

---

## 2026-05-23 — Nhập câu hỏi Excel true_false_multi & matching; essay key grading

**Commit:** `4503d5d`
**Nội dung:** Import Excel hỗ trợ true_false_multi & matching; lọc loại câu hỏi; essay key grading; module_id cho đề thi TH; cải tiến ngân hàng câu hỏi.

---

## 2026-05-21 — Per-student question selection, exam lock soft delete, fix RLS

**Commit:** `24cebbb` (approx)
**Nội dung:** Mỗi thí sinh có bộ câu hỏi riêng; soft delete exam lock; fix question bank RLS.
