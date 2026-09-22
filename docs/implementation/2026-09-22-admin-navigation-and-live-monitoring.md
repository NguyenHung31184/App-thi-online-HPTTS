# Admin navigation and live-monitoring implementation plan

- Status: active
- Started: 2026-09-22
- Baseline commit: `68c008d`
- Rollback record: `docs/rollback/2026-09-22-admin-navigation-and-live-monitoring.md`

## Goal

Make the admin menu match the examination workflow and add an operational view that updates while students are taking an exam.

## Approved navigation

- Tổng quan: Dashboard
- Thi lý thuyết: Ngân hàng câu hỏi, Đề thi & ma trận, Kỳ thi, Chấm tự luận, Báo cáo lý thuyết
- Thi thực hành: Mẫu đánh giá, Ca thi thực hành, Chấm thực hành, Báo cáo thực hành
- Hệ thống: Giám sát trực tuyến, Nhật ký đồng bộ TTDT

## Delivery order

### Phase A — stabilize P1 data foundation

- Reconcile the P1 migration with the database objects already created in Supabase.
- Preserve all existing `question_bank` records.
- Backfill library references only after validating legacy occupation identifiers.
- Verify RLS with an admin and a teacher session.

### Phase B — navigation and route labels

- Update `src/pages/admin/AdminLayout.tsx` and route titles only.
- Keep existing route URLs working; change labels before moving routes.
- Add empty-state links only where the destination route exists.
- Validate keyboard navigation, focus indicator, selected state, and mobile sidebar.

### Phase C — question-bank UI separation

- Keep `src/modules/question-bank` as the module boundary.
- Separate library management, document import, import review, and question listing into individual routes.
- Do not publish imported drafts automatically.

### Phase D — live monitoring

- Add a presence model for each in-progress attempt: `last_seen_at`, client state, current question, and event count.
- Student client sends a rate-limited heartbeat during an active attempt.
- Admin clients subscribe through Supabase Realtime to presence and proctoring events for a selected exam window.
- Student cards show status, elapsed time, remaining time, last activity, and warnings. No score is shown while the attempt remains in progress.
- RLS limits student writes to their own active attempt and staff reads to permitted exam windows.

### Phase E — practical reporting

- Add a separate practical-report route and query module.
- Report completion, grading progress, score distribution, and sync status by practical session.

## Acceptance checks

- Legacy menu URLs continue to open the same functions.
- P1 tables, policies, and client queries return no 404 or permission error.
- An active student appears or updates in monitoring within 15 seconds.
- A disconnected student becomes stale after the configured timeout.
- A student cannot inspect another student's presence or proctoring evidence.
- TypeScript build, boundary check, and focused browser checks pass before deployment.
