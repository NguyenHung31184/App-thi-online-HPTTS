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
   - Tạo bucket Storage `exam-uploads` (public) để upload ảnh CCCD cho OCR.

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
- **Tiếp theo (Phase 1):** Soạn đề, câu hỏi, kỳ thi (CRUD + UI admin).
