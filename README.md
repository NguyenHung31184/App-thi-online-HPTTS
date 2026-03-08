# App Thi Online HPTTS

**Repo riêng** — ứng dụng thi trực tuyến, tích hợp với hệ thống **Quản lý TTDT-HPTTS** (điểm tự động đổ sang TTDT).  
Tương tự cách **Chatbot tuyển sinh** là repo riêng (`Chatbot_HPTTS_2025`), app thi online nằm tại repo này, không nằm trong repo QuanlyTTDT-HPTTS.

Kế hoạch tổng thể (phase 0 → 6) nằm trong repo TTDT:  
`QuanlyTTDT-HPTTS/docs/KE_HOACH_APP_THI_ONLINE_TU_DAU.md`.

## Tech stack

- React 18, Vite, TypeScript, Tailwind CSS
- Supabase (Auth, Database, Storage)
- OCR CCCD: tận dụng server Chatbot tuyển sinh (`VITE_OCR_CCCD_URL`)

## Cấu hình

1. Copy `.env.example` thành `.env` và điền:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (cùng project TTDT hoặc project riêng)
   - `VITE_OCR_CCCD_URL`: proxy OCR (mặc định `https://chatbot-hptts-2025.vercel.app/api/ocr`)
   - `VITE_TTDT_VERIFY_CCCD_URL`, `VITE_TTDT_API_KEY` (khi TTDT đã có Edge Function `verify-cccd-for-exam`)

2. Supabase:
   - Chạy migration trong `supabase/migrations/001_mvp_tables.sql` (SQL Editor).
   - Chạy `supabase/migrations/002_grade_attempt_rpc.sql` (RPC chấm bài Phase 2).
   - Chạy `supabase/migrations/003_rls_policies.sql` (RLS Phase 3: bảng `profiles`, view `questions_for_student`, RPC `get_questions_for_student`, policy từng bảng). Cần bảng `enrollments` (TTDT) hoặc tạo bảng trống nếu chưa có.
   - Chạy `supabase/migrations/004_attempt_question_scores_and_multiple_choice.sql` (Phase 4: bảng chấm tay câu tự luận, grade_attempt hỗ trợ multiple_choice).
   - Tạo bucket Storage `exam-uploads` (public) để upload ảnh CCCD và snapshot đề thi.
   - Phân quyền: Đặt role admin/teacher trong bảng `profiles`: `UPDATE profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email');`

## Chạy

```bash
npm install
npm run dev
```

## Cấu trúc thư mục

- `src/lib` — Supabase client
- `src/types` — Định nghĩa TypeScript (Exam, Question, Attempt, …)
- `src/services` — OCR, verify CCCD, (sau) exam, attempt
- `src/contexts` — Auth
- `src/pages` — Login, Xác thực CCCD, Dashboard, (sau) Làm bài, Kết quả

## Phase hiện tại

- **Phase 0:** Repo độc lập, Tailwind, Supabase client, types, migration MVP, Auth, OCR (proxy Chatbot), Verify CCCD, màn Login / Xác thực CCCD / Dashboard.
- **Phase 1 (đã làm):** Soạn đề (CRUD exams + blueprint + module_id), ngân hàng câu hỏi single_choice (CRUD + upload ảnh), kiểm định đề (blueprint + snapshot Storage), CRUD kỳ thi (exam_windows). Admin/teacher: `/admin/exams`, `/admin/windows`.
- **Phase 2 (đã làm):** Dashboard thí sinh (danh sách cửa sổ được phép theo lớp/enrollments), nhập mã truy cập → tạo attempt → màn làm bài (timer, autosave, audit focus/visibility), nộp bài → chấm server-side (RPC `grade_attempt`), trang kết quả (điểm %, đạt/chưa đạt, In), gọi API TTDT nhận điểm + `exam_sync_log`.
- **Phase 3 (đã làm):** RLS đầy đủ (profiles, role, student_id); view `questions_for_student` + RPC `get_questions_for_student`; `grade_attempt` chỉ chủ attempt được gọi; cập nhật profile khi verify CCCD; role đọc từ `profiles`.
- **Phase 4 (một phần):** **Import ngân hàng câu hỏi từ Excel/Google Sheets** (mẫu cột: Nội dung, A/B/C/D, Đáp án đúng, Chủ đề, Độ khó, Điểm); **trắc nghiệm nhiều đáp án đúng** (multiple_choice) — soạn, làm bài (checkbox), chấm tự động; bảng `attempt_question_scores` (cho chấm tự luận sau). Chưa làm: drag_drop, video_paragraph/main_idea, màn chấm tự luận.
- **Tiếp theo:** drag_drop (sắp thứ tự/ghép cặp), câu tự luận + màn chấm GV; Phase 5 (thi thực hành).
