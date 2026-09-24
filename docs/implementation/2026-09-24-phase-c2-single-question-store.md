# Phase C2 — single question store

- Status: step 1 applied 2026-09-24; step 2 slice 1 (question editor) complete; slice 2 (Excel/ZIP import) next
- Date: 2026-09-24
- Depends on: Phase C, question-library scope contract, draw-excludes-duplicate-content fix
- Migration (step 1): `supabase/migrations/20260924111343_c2_single_question_store.sql`
- Rollback: `docs/rollback/2026-09-24-phase-c2-single-question-store.md`
- Baseline commit: `b4f65a1`

## Why

The "old store" (`/admin/questions`) and the new libraries (`/admin/question-libraries`) read the same table, `question_bank`. They look like two stores because:

- The P1 backfill only linked rows whose occupation id was a UUID. Real ids are text (`kh01`…), so none of the 1,550 active questions has a `library_id`, and every library screen is empty for real data.
- Create, edit and Excel/ZIP import still live only in the old screens, and they do not set `library_id`.

## Decisions (operator, 2026-09-24)

1. One library per module. Production has 7 modules with questions:

   | Module | Courses | Rows | Distinct questions |
   |---|---|---|---|
   | NLĐK-CO | Container | 150 | 150 |
   | NLĐK-FL | Forklift | 150 | 150 |
   | NLĐK-RTG | RTG | 150 | 150 |
   | NLĐK-QC | QC (STS) | 150 | 150 |
   | HH-GN | Giao nhận | 200 | 200 |
   | KT-GN | Giao nhận | 150 | 150 |
   | QTHH-AT (`m07`) | Container, Forklift, RTG, QC | 600 | 150 |

2. QTHH-AT becomes one shared library. Keep one row per distinct question (stem + options), preferring the copy with an image; set the other 450 copies to `status = 'retired'`, never delete them. `grade_attempt` does not filter by status, so past attempts still grade and display; the draw only takes `published` rows.
3. New questions get a library automatically: a database trigger links a `question_bank` row without `library_id` to its module's library, creating the library if it does not exist.
4. The old screen stops being a separate entry point once create, edit and import work inside the library screens.

## Design items resolved (2026-09-24)

- `question_libraries.occupation_id` becomes nullable. A module library fills it only when all of the module's questions belong to one course; QTHH-AT has none and its description says it is shared by 4 courses. Course names for display come from `course_modules`.
- One active library per module, enforced by the partial unique index `question_libraries_one_active_per_module`. The two `[TEST] Phase C 2026-09-24…` libraries (no questions, no import jobs, 2 taxonomy nodes) are deleted first.
- Duplicates are detected with the same key as the exam draw (stem + options, case and whitespace ignored). Checked before writing: the 150 QTHH-AT groups each have exactly 4 copies in 4 courses, with identical answer key, points, type, difficulty and topic; 7 groups have an image on some copy, and the copy with the image is kept.
- Legacy screens still list the retired QTHH-AT copies under their course until step 3 removes those screens.

## Dry run on production data (2026-09-24, read-only)

| Library | Course | Live rows | Rows linked (incl. soft-deleted) | Stay published | Retired |
|---|---|---|---|---|---|
| HH-GN · Nghiệp vụ giao nhận hàng hoá | Giao nhận | 200 | 200 | 200 | 0 |
| KT-GN · Nghiệp vụ kết toán hàng hoá | Giao nhận | 150 | 150 | 150 | 0 |
| NLĐK-CO · Kết cấu và kỹ thuật điều khiển xe nâng hàng Container | Container | 150 | 297 | 150 | 0 |
| NLĐK-FL · Kết cấu và kỹ thuật điều khiển xe nâng hàng Forklift | Forklift | 150 | 325 | 150 | 0 |
| NLĐK-QC · Cấu tạo và nguyên lý vận hành cần trục QC | QC (STS) | 150 | 450 | 150 | 0 |
| NLĐK-RTG · Cấu tạo và nguyên lý vận hành RTG | RTG | 150 | 677 | 150 | 0 |
| QTHH-AT · Quy trình xếp dỡ, hàng hóa và ATVSLĐ | shared by 4 | 600 | 699 | 150 | 450 |

All 2,798 rows get a library; 1,100 rows stay published. The QTHH-AT exam rule (`*`/`medium`, 50 questions) keeps a pool of 150.

## Planned steps

1. Migration: library per module, link the 1,550 rows, retire the 450 QTHH-AT copies, unique index, trigger. Dry-run counts first; applied only after approval.
2. Library screens: add, edit and import (Excel/ZIP) inside the library; edits keep `library_id`.
3. Remove "Mở kho câu hỏi cũ"; redirect `/admin/questions` to `/admin/question-libraries`; keep deep links to single questions working.
4. Click-through as admin and teacher; exam draw check on a locked trial exam.

## Step 1 application record (2026-09-24)

- Operator confirmed the QTHH-AT merge after seeing the four copies of one question side by side (same stem, answer C, 2 points, one row per course).
- Pre-check at 11:13:06 UTC matched the dry run: 2 libraries, 0 linked rows, 0 retired, 1,550 live of 2,798.
- Applied with the Supabase migration tool at 11:13:43 UTC; recorded as `20260924111343 c2_single_question_store`. The repo file was renamed to that version.
- Result equals the dry run: 7 libraries, 0 unlinked rows, 1,100 published, 450 retired (all QTHH-AT), test libraries and their 2 taxonomy nodes gone, `occupation_id` nullable, unique index and trigger present. QTHH-AT keeps 150 published rows with 150 distinct stems; no image-less copy was kept where an image copy existed.
- Trigger check in a block that raises at the end, so nothing persisted: an insert into `m07` got the QTHH-AT library; moving it to NLĐK-CO switched the library; an insert into an unknown module created a library for it. Afterwards: 7 libraries, no test rows.
- Known UI gaps until step 2: the QTHH-AT library has no course, so the Phase C header shows "Nghề chưa xác định" and its "Sửa" links lack a course segment; the create form still asks for a course and cannot create a second library for a module.
