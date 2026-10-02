# Missing TTDT grades (March, April 2026) and the "Dọn lỗi cũ" button

- Status: step 1 done and pushed 2026-10-02 (`2a89559`); step 2 waiting for operator confirmation.
- Date: 2026-10-02
- Database: no migration. Step 2 writes TTDT grades through the existing `/api/sync-ttdt` endpoint.
- Rollback: `docs/rollback/2026-10-02-ttdt-resend-and-sync-log-cleanup.md`

## Findings (read only, 2026-10-02)

- Before 2026-09-29 the grade went to TTDT from the student's browser right after submitting, once, without retry.
  Whole days never reached TTDT (13/03 mostly, 11/04, 21–22/04), with no log row: the call stopped before logging.
- 229 real completed theory attempts have no `synced_to_ttdt_at`. 155 of them are older attempts of a student who has
  a newer attempt for the same class and module; only the newest attempt per student, class and module is sent.
- That leaves 74, all March and April:
  - 66: TTDT has no `grade_details` row for the enrollment and module; none disqualified. These are sent.
  - 6: TTDT already holds a different final exam score (entered by hand or later). Not sent: TTDT overwrites
    `final_exam_score` on receipt. Operator decides.
  - 2: the student is no longer enrolled in that class in TTDT; TTDT would refuse them.
- May and July: the newest attempt of every student is in TTDT with the same score (May 107 match, 2 differ; July 56
  match; 4 July students no longer enrolled in Container K91).
- List with names: `D:\Data\App-thi-online-HPTTS-bao-cao\2026-10-02-gui-lai-diem-TTDT.csv` (outside git).
- "Dọn lỗi cũ (30 ngày)": `exam_sync_log` and `practical_sync_log` have no DELETE policy, so the delete removed nothing
  while the page reported success. It was also a hard delete.

## Steps

1. **Remove the button.** The sync log page loses "Dọn lỗi cũ (30 ngày)"; `cleanupOldSyncLogs`,
   `useCleanupSyncLogs`, `deleteSyncLogsBefore` and `syncLogCutoff` go. Logs are kept (few rows, a technical trail).
2. **Resend 66 attempts** (operator confirms first). One POST per attempt to production `/api/sync-ttdt` as admin, in
   order. The endpoint adds the attempt to `exam_sync_jobs`, sends it, sets `synced_to_ttdt_at` and writes a log row.
   Before: snapshot of the `grade_details` rows for those enrollments and modules
   (`D:\Data\App-thi-online-HPTTS-bao-cao\2026-10-02-grade_details-truoc-khi-gui-lai.json`; none existed).
   After: count log rows and `grade_details` rows; failures show on the sync log page with "Thử lại".

## Checks

Step 1: `npm run check:boundaries`, `npm test`, `npx tsc -b`, `npm run lint`, `npm run build`; Edge, local build:
`/admin/sync` without the button, tabs and filter unchanged.

Step 1 notes: checks pass (195 tests, the cutoff test went with the function). Edge, local build with
`VITE_TTDT_SYNC_ENABLED=1`: no "Dọn lỗi cũ", "Tải lại" there, theory tab 13/13, failed filter shows 13 "Thử lại",
practical tab empty as in production, no page errors.
