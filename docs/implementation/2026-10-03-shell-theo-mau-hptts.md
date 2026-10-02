# App shell following the practical-exam mock-up, HPTTS identity kept

- Status: done 2026-10-03, not pushed.
- Rollback: `docs/rollback/2026-10-03-shell-theo-mau-hptts.md`.
- Source: the RTG Score mock-up (Manus), DESIGN.md of the TTDT app, antislop UI. The operator approved the "lấy / đổi /
  bỏ" list on 2026-10-02 and asked for both apps now. Colours, Arial and the `indigo` → `brand` mapping already exist
  here since 2026-09-26, so this entry only changes the shell.

## Change

- Sidebar (`src/components/AppLayout.tsx`): group titles in sentence case Vietnamese ("Thi lý thuyết", not "THI LÝ
  THUYẾT"); English labels translated (Dashboard → Tổng quan, Exams → Bài thi, Result → Kết quả, STUDENT → Thí sinh);
  the active item as in Sổ chuyên cần (`brand-700` with a cyan inset bar marking the current page).
- Header: a breadcrumb ("Quản trị › Kỳ thi") and, on the admin area, two chips with real state only: the device's
  network (online/offline events) and the number of grades waiting in `exam_sync_jobs` (pending or processing; links to
  the sync log). No invented figures.
- Sign-out (`identity-access/data/auth-session.ts`): `scope: 'local'`. A global sign-out also ended the same account's
  sessions in Sổ chuyên cần and the TTDT app.

## Checks

`npm run check:boundaries`, `npm test`, `npx tsc -b`, `npm run lint`, `npm run build`; Edge at 412 px and 1280 px:
admin dashboard, windows, practical templates, sync log; the student start page.

Also: the admin dashboard drops its second heading "Dashboard báo cáo" (the header already says "Tổng quan") and its
uppercase card labels; the role choice and exam intro pages lose their wide-tracked uppercase labels.

## Results (2026-10-03)

Checks pass (209 tests). Edge, local build, 1280 px and 412 px: sidebar with sentence-case groups, active item in
`brand-700` with the cyan bar, header "Quản trị › Tổng quan" with "Mạng: đang kết nối" and "TTDT: đã gửi hết" (the
queue was empty); on the phone the chips hide while online and the menu button opens the drawer. No page errors.
