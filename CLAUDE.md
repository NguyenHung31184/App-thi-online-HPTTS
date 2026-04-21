# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication

Luôn nói chuyện với tôi bằng tiếng Việt.

## Project Overview

App Thi Online HPTTS — ứng dụng thi trắc nghiệm trực tuyến, tích hợp với hệ thống TTDT-HPTTS (điểm tự động đổ về TTDT). Hỗ trợ nhiều loại câu hỏi, giám sát thi qua camera (TensorFlow BlazeFace), và module thi thực hành.

Repo này **độc lập** với `QuanlyTTDT-HPTTS` nhưng dùng chung Supabase project (hoặc project riêng). Kế hoạch tổng thể: `QuanlyTTDT-HPTTS/docs/KE_HOACH_APP_THI_ONLINE_TU_DAU.md`.

## Commands

```bash
npm run dev      # Dev server (Vite)
npm run build    # tsc -b && vite build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Architecture

### Folder Structure

```
src/
  App.tsx              # All routes (no lazy loading — direct imports)
  contexts/
    AuthContext.tsx    # Supabase Auth session (admin/teacher flow)
  lib/
    supabaseClient.ts  # Supabase client + isSupabaseConfigured()
  types/
    index.ts           # All domain types (Exam, Question, Attempt, ExamWindow, etc.)
  pages/
    LoginPage.tsx
    RoleSelectPage.tsx
    VerifyCccdPage.tsx           # Student entry — no Supabase Auth required
    DashboardPage.tsx / StudentExamsPage.tsx / StudentResultsPage.tsx
    ExamIntroPage.tsx / ExamTakePage.tsx / ExamResultPage.tsx
    PracticalTakePage.tsx
    admin/                       # Full admin CRUD (exams, questions, windows, grading, etc.)
  components/
    proctoring/
      AiObjectProctorBurst.tsx   # TensorFlow.js snapshot proctoring
      ProctoringEvidenceCapture.tsx
      ViolationAlertModal.tsx
    CccdCameraCapture.tsx        # Camera UI for CCCD verification
  services/                      # One file per domain — all Supabase calls here
  utils/
    blazeFaceProctor.ts          # BlazeFace face detection wrapper
    examImageCompress.ts         # Compress question/evidence images
    mediaUrlValidator.ts         # Validate Storage URLs before render
supabase/
  migrations/                    # Apply in numbered order (001 → latest)
```

### Two Auth Flows

| Flow | Who | How |
|------|-----|-----|
| Admin/Teacher | Staff | Supabase Auth (email+password) → role from `profiles` table |
| Student | Exam taker | CCCD verification via `verify-cccd-for-exam` Edge Function (no Supabase auth needed) |

Student session is stored in local state as `StudentSession` (id_card_number, student_id, student_code, student_name) — not in Supabase auth.

### Question Types

`QuestionType` in `src/types/index.ts`: `single_choice` | `multiple_choice` | `drag_drop` | `video_paragraph` | `main_idea`

`drag_drop`, `video_paragraph`, `main_idea` are defined in types but **not yet fully implemented** in exam-taking UI.

### Exam Grading

Server-side RPC `grade_attempt` in Supabase handles scoring. Essay questions use `attempt_question_scores` table for manual grading by teachers. After grading, results sync to TTDT via `receive-exam-results` Edge Function.

### Proctoring

`AiObjectProctorBurst.tsx` uses `@tensorflow-models/blazeface` (face detection) and `@tensorflow-models/coco-ssd` (object detection) to capture violation evidence. TensorFlow.js models load lazily on exam start. Evidence uploads to `exam-uploads/` Storage bucket.

### Storage Bucket (`exam-uploads`, public)

| Prefix | Contents | Notes |
|--------|---------|-------|
| `question-bank/` / `questions/` | Question media | **DO NOT delete** |
| `exam-snapshots/` | Question paper snapshots | Keep |
| `cccd/` / `proctoring/` | CCCD + proctoring images | Cleared April 2026 |

## Database Schema (Key Tables)

All tables prefixed logically under `exam_*` pattern:

| Table | Purpose |
|-------|---------|
| `exams` | Exam definitions (blueprint, duration, pass threshold, `module_id` FK to TTDT) |
| `questions` | Per-exam questions (or from question bank via `question_bank_id`) |
| `question_banks` | Reusable question pools (linked to `occupation_id` / `module_id`) |
| `exam_windows` | Scheduled exam sessions (`exam_ids[]` for random draw, `class_id`, `access_code`) |
| `attempts` | Student attempts (answers jsonb, score, `disqualified`, proctoring flags) |
| `attempt_question_scores` | Per-question scores for essay/manual grading |
| `practical_templates` / `practical_sessions` | Practical exam module |
| `profiles` | User roles (`admin`, `teacher`, `student`, `proctor`) |
| `occupations` | Occupation categories for question banks |

## Migrations

Apply in order: `001_mvp_tables.sql` → `002` → ... → latest dated file.

After adding a migration, test locally with `npx supabase db push` (if using local Supabase). RLS policies are in `003_rls_policies.sql` and `20260410000000_fix_security_rpc_rls.sql`.

## Environment Variables

```
VITE_SUPABASE_URL             # Supabase project URL
VITE_SUPABASE_ANON_KEY        # Anon key (respects RLS)
VITE_OCR_CCCD_URL             # OCR proxy endpoint (shared standard with Chatbot repo)
VITE_OCR_CCCD_API_KEY         # Optional: x-api-key for OCR proxy
VITE_TTDT_VERIFY_CCCD_URL     # TTDT Edge Function verify-cccd-for-exam
VITE_TTDT_API_KEY             # API key for TTDT Edge Functions
```

## Sync with TTDT

After an exam attempt is graded, results POST to TTDT's `receive-exam-results` Edge Function. Sync status tracked in `exam_sync_log` table. Admin can manually re-trigger sync from `/admin/sync` page.
