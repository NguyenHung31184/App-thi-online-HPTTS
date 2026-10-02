# integrations

Links with the TTDT management app and outside services: the TTDT directory (classes, modules, a student's classes),
the grade sync to TTDT with its log and retry, and CCCD OCR.

- Domain: `ttdt-directory.ts` reads `course_modules` rows (object or array relations, deleted modules left out);
  `sync-errors.ts` (help per TTDT error), `sync-log.ts`, `ocr.ts` (proxy fields and error messages).
  Pure, tested.
- Data: `classes`, `modules`, `course_modules`, `enrollments` (a read that fails returns [] so the forms still open);
  `exam_sync_log`, `practical_sync_log` (latest 500); `ttdt-sync-client.ts` calls `/api/sync-ttdt` with the attempt id
  only, the server reads the rest; `ocr-proxy.ts` calls `/api/scan-id-card`, which keeps the OCR key on the server.
  Logs are never deleted from the app (the old "Dọn lỗi cũ" button had no DELETE policy behind it; removed 2026-10-02).
- UI: the sync log page `/admin/sync`.
- Used by `exam-management`, `practical-exams`, `identity-access` and the theory exam pages, through `public.ts`.
