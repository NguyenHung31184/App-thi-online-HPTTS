# integrations

Links with the TTDT management app and outside services: the TTDT directory (classes, modules, a student's classes),
the grade sync to TTDT with its log, retry and cleanup, and CCCD OCR.

- Domain: `ttdt-directory.ts` reads `course_modules` rows (object or array relations, deleted modules left out);
  `sync-errors.ts` (help per TTDT error, cleanup cutoff), `sync-log.ts`, `ocr.ts` (proxy fields and error messages).
  Pure, tested.
- Data: `classes`, `modules`, `course_modules`, `enrollments` (a read that fails returns [] so the forms still open);
  `exam_sync_log`, `practical_sync_log` (latest 500); `ttdt-sync-client.ts` calls `/api/sync-ttdt` with the attempt id
  only, the server reads the rest; `ocr-proxy.ts` calls `/api/scan-id-card`, which keeps the OCR key on the server.
  "Dọn lỗi cũ" deletes failed logs older than 30 days (hard delete kept from before the move).
- UI: the sync log page `/admin/sync`.
- Used by `exam-management`, `practical-exams`, `identity-access` and the theory exam pages, through `public.ts`.
