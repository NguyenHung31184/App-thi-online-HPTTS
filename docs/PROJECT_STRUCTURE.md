# Cấu Trúc Dự Án — App Thi Online HPTTS

> Cập nhật khi thêm/xóa service, route, bảng DB, hoặc đổi luồng dữ liệu.

## Tech Stack

- React + Vite + TypeScript (types viết tay trong `src/types/index.ts` — không gen từ Supabase)
- Supabase JS và React Query (chung project `vmtztbmlzszuxkglubro` với app quản lý TTDT)
- TensorFlow.js (BlazeFace + coco-ssd) cho giám sát thi
- Tailwind CSS, sonner (toast)

## Thư mục chính

```
src/
  app/providers/       # Provider toàn ứng dụng, gồm React Query
  platform/supabase/   # Adapter Supabase dùng chung
  modules/             # Domain theo lát dọc; chỉ import chéo qua public.ts
    exam-taking/        # Luồng kỳ thi lý thuyết P0
      domain/ application/ data/ queries/ public.ts
    question-bank/      # Ngân hàng câu hỏi: một ngân hàng mỗi mô-đun (Phase C, C2)
      domain/ application/ data/ queries/ ui/ public.ts
  App.tsx              # Toàn bộ routes (import trực tiếp, không lazy)
  contexts/AuthContext.tsx   # Supabase Auth + StudentSession (CCCD)
  lib/supabaseClient.ts
  types/index.ts       # Domain types viết tay
  pages/               # Trang học viên + admin/
  components/          # ExamCard, proctoring/, CccdCameraCapture...
  services/            # Facade chuyển tiếp cho màn chưa chuyển module
supabase/migrations/   # Migration riêng app thi (KHÔNG chứa elearning_*)
docs/                  # 4 file chuẩn: PROJECT_STRUCTURE, DIARY, ROLLBACK, GHI_CHU
```

## Quy tắc modular monolith

Luồng mới phải theo `ui → queries → application → data → Supabase`. `data/` là nơi duy nhất
gọi `supabase.from`, `rpc`, Storage hoặc Edge Function cho lát nghiệp vụ đó. Module khác và route
chỉ import qua `src/modules/<name>/public.ts`. Chạy `npm run check:boundaries` trước khi merge.

Lát `exam-taking` đã chuyển luồng danh sách kỳ thi, vào thi, lưu đáp án và ngữ cảnh cửa sổ thi.
Lát `question-bank` giữ toàn bộ ngân hàng câu hỏi: danh sách ngân hàng, cây kiến thức, danh sách câu
(lọc, chọn nhiều để đổi trạng thái hoặc xóa, xuất Excel), editor 7 loại câu, nhập Excel/CSV/ZIP,
phiếu nhập tài liệu (P1). Các trang cũ `/admin/questions/...` đã bỏ; URL cũ chuyển hướng sang ngân hàng.
Các CRUD quản trị đề/cửa sổ thi, thi thực hành, chấm và báo cáo vẫn là facade cũ; sẽ chuyển từng
use case, không di chuyển hàng loạt file.

## Routes học viên

| Route | Trang | Mô tả |
|-------|-------|-------|
| `/student/exams` | StudentExamsPage | Kỳ thi đang mở (lọc theo lớp TTDT) |
| `/student/results` | StudentResultsPage | Kết quả thi |
| `/student/learn` | StudentLearnPage | **Học trực tuyến** — bài học theo mô-đun lớp, học tuần tự |
| `/student/learn/:lessonId` | LessonPlayerPage | Học 1 bài: video/pdf/bài viết + ghi tiến độ |
| `/verify-cccd` | VerifyCccdPage | Xác thực CCCD trước khi thi |

## Routes ngân hàng câu hỏi (admin, giáo viên)

| Route | Trang |
|-------|-------|
| `/admin/question-libraries` | Danh sách ngân hàng, tạo ngân hàng cho mô-đun |
| `/admin/question-libraries/:libraryId` | Cây kiến thức |
| `.../questions` | Danh sách câu: lọc, chọn nhiều, xuất Excel |
| `.../questions/new`, `.../questions/:questionId` | Editor câu hỏi |
| `.../questions/import` | Nhập Excel/CSV/ZIP |
| `.../imports`, `.../imports/:jobId` | Phiếu nhập tài liệu (DOCX/PDF/ảnh, worker chưa bật) |
| `/admin/questions/...` | Chuyển hướng tới ngân hàng tương ứng |

## Services chính

| File | Domain |
|------|--------|
| `attemptService.ts` | Bài làm (RPC `create_attempt_with_questions`, `grade_attempt`) |
| `examWindowService.ts` | Cửa sổ thi, `getAllowedWindows` theo lớp |
| `ttdtDataService.ts` | Đọc dữ liệu TTDT: classes, modules, enrollments |
| `elearningStudyService.ts` | **E-Learning**: bài học theo mô-đun lớp, blocks, tiến độ (`elearning_progress`) |
| `essayGradingService.ts` | Chấm tự luận |

## Luồng dữ liệu E-Learning

```
App chính (soạn bài /elearning)
  → elearning_lessons / elearning_lesson_blocks   (Supabase chung)
    → App thi: StudentLearnPage (enrollments → classes → courses → course_modules → modules → lessons)
      → LessonPlayerPage → elearning_progress (RLS user_id = auth.uid())
        → App chính đọc progress để báo cáo giáo vụ (lát sau)
```

## Bảng DB liên quan

- Riêng app thi: `exams`, `questions`, `question_bank` (số ít), `question_libraries` (một ngân hàng đang dùng mỗi mô-đun), `question_taxonomy_nodes`, `question_import_jobs`, `exam_windows`, `attempts`, `practical_*`, `profiles`, `occupations`
- Ảnh câu hỏi: Storage `exam-uploads/question-bank/<library>/` (không xóa tay)
- Chung TTDT: `students`, `classes`, `enrollments`, `courses`, `course_modules`, `modules`
- E-Learning (migration ở repo app chính): `elearning_lessons`, `elearning_lesson_blocks`, `elearning_quiz_items`, `elearning_progress`
