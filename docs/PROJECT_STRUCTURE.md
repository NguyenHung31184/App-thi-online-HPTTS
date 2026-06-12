# Cấu Trúc Dự Án — App Thi Online HPTTS

> Cập nhật khi thêm/xóa service, route, bảng DB, hoặc đổi luồng dữ liệu.

## Tech Stack

- React + Vite + TypeScript (types viết tay trong `src/types/index.ts` — không gen từ Supabase)
- Supabase JS (chung project `vmtztbmlzszuxkglubro` với app quản lý TTDT)
- TensorFlow.js (BlazeFace + coco-ssd) cho giám sát thi
- Tailwind CSS, sonner (toast)

## Thư mục chính

```
src/
  App.tsx              # Toàn bộ routes (import trực tiếp, không lazy)
  contexts/AuthContext.tsx   # Supabase Auth + StudentSession (CCCD)
  lib/supabaseClient.ts
  types/index.ts       # Domain types viết tay
  pages/               # Trang học viên + admin/
  components/          # ExamCard, proctoring/, CccdCameraCapture...
  services/            # 1 file / domain — mọi call Supabase ở đây
supabase/migrations/   # Migration riêng app thi (KHÔNG chứa elearning_*)
docs/                  # 4 file chuẩn: PROJECT_STRUCTURE, DIARY, ROLLBACK, GHI_CHU
```

## Routes học viên

| Route | Trang | Mô tả |
|-------|-------|-------|
| `/student/exams` | StudentExamsPage | Kỳ thi đang mở (lọc theo lớp TTDT) |
| `/student/results` | StudentResultsPage | Kết quả thi |
| `/student/learn` | StudentLearnPage | **Học trực tuyến** — bài học theo mô-đun lớp, học tuần tự |
| `/student/learn/:lessonId` | LessonPlayerPage | Học 1 bài: video/pdf/bài viết + ghi tiến độ |
| `/verify-cccd` | VerifyCccdPage | Xác thực CCCD trước khi thi |

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

- Riêng app thi: `exams`, `questions`, `question_bank` (số ít), `exam_windows`, `attempts`, `practical_*`, `profiles`, `occupations`
- Chung TTDT: `students`, `classes`, `enrollments`, `courses`, `course_modules`, `modules`
- E-Learning (migration ở repo app chính): `elearning_lessons`, `elearning_lesson_blocks`, `elearning_quiz_items`, `elearning_progress`
