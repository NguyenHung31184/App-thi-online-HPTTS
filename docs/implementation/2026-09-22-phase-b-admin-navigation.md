# Phase B — admin navigation and route labels

- Status: complete
- Baseline commit: `7b6ceb8`
- Scope: `src/pages/admin/AdminLayout.tsx`, report and sync page headings
- Rollback: `docs/rollback/2026-09-22-phase-b-admin-navigation.md`

## Intent

Arrange the administration menu around the actual examination workflow without changing database objects, permissions, or legacy URLs.

## Navigation delivered in this phase

- Tổng quan: Dashboard.
- Thi lý thuyết: Ngân hàng câu hỏi, Đề thi & ma trận, Kỳ thi, Chấm tự luận, Báo cáo lý thuyết.
- Thi thực hành: Mẫu đánh giá, Ca thi thực hành, Chấm thực hành.
- Hệ thống: Nhật ký đồng bộ TTDT.

`Ngân hàng câu hỏi` points to the P1 library route. The former `/admin/questions` route remains available for legacy deep links and the existing question workflow.

## Deferred items

- `Giám sát trực tuyến` belongs to Phase D because no presence or Realtime view exists yet.
- `Báo cáo thực hành` belongs to Phase E because the present report query is theory-only.

Neither item is added as a placeholder menu entry. A visible menu item must open a usable screen.

## Safety and validation

- No schema, API, RLS, or permission change.
- Existing URLs remain unchanged.
- Admin and teacher navigation remain role-scoped.
- Validate TypeScript, module boundaries, production build, keyboard focus, selected navigation state, and narrow-screen sidebar behavior.

## UI decisions

- The menu follows the work sequence used by exam staff: prepare the question bank and matrix, open a session, grade, then inspect reports. The grouping reduces scanning during operations.
- The existing sidebar palette and spacing remain unchanged. Phase B changes information architecture, not the product visual language.
- Native links expose the current route with `aria-current="page"`. Navigation, the mobile menu trigger, and logout receive visible keyboard focus indicators.

## Completion record

- Implemented on 2026-09-22.
- TypeScript, module-boundary check, `git diff --check`, and production build passed.
- Local route checks returned HTTP 200 for every Phase B destination and the retained legacy question route.
- The authenticated visual click-through is intentionally left to the next local admin session because Chrome was closed at the operator's request after Phase A.
