# ROLLBACK — App thi online HPTTS

Mỗi dòng = 1 điểm khôi phục. Thêm entry MỚI Ở ĐẦU.

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
