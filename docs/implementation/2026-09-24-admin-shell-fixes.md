# Admin shell fixes: session restore, page title, hidden sidebar focus

- Status: complete; verified on Edge with an admin session; student shell not yet re-tested
- Baseline commit: `178dbb5` (Phase C)
- Scope: `src/contexts/AuthContext.tsx`, `src/pages/admin/AdminLayout.tsx`, `src/components/AppLayout.tsx`
- Rollback: `docs/rollback/2026-09-24-admin-shell-fixes.md`
- Found during: Phase C click-through on Edge, 2026-09-24. All three predate Phase C.

## Problems

1. **Reload or deep link to any admin page lands on `/login`.** `AuthProvider` set `loading = false` as soon as `getSession()` resolved, while the profile lookup that decides the role was still running. `AdminLayout` saw `loading === false` and `user === null` and redirected.
2. **The header title always reads "Dashboard".** `getAdminTitle` checked `startsWith` in insertion order and the `'/admin'` entry matched every path. Present since `0de8bdb`.
3. **Keyboard focus enters the closed mobile sidebar.** Below the `lg` breakpoint the sidebar is moved off-screen with a transform but stays in the tab order, so Tab lands on links the user cannot see.

## Changes

1. `AuthProvider` keeps `loading` true until the profile for the current session is resolved. Each auth change gets a version number; a lookup that finishes after a newer change is dropped, so a slow lookup cannot restore a signed-out user. The `onAuthStateChange` handler defers the lookup with `setTimeout(0)`, following the Supabase guidance against calling Supabase inside that callback.
2. `getAdminTitle` picks the longest matching route prefix. The catch-all `'/admin'` entry is removed; unknown admin paths fall back to "Quản trị".
3. `AppLayout` marks the sidebar `inert` while it is closed on a narrow screen. The menu button exposes `aria-expanded` and `aria-controls`; opening the menu moves focus to the first link, and Escape closes it and returns focus to the button.

## Risk

- Auth change touches the student exam flow too. It can only remove false redirects to `/login`. If the profile request hangs, the loading screen stays up instead of redirecting.
- `AppLayout` is shared by the admin and student shells; both get the sidebar change. Desktop (`lg` and wider) is unaffected: the sidebar is never inert there.

## Validation

- `tsc -b`, `check:boundaries`, ESLint on touched files, production build.
- Edge, admin session: reload `/admin/question-libraries/<id>/questions` and stay on the page; title matches the page on several routes; at narrow width Tab skips the closed sidebar, the menu button opens it with focus inside, Escape closes it.
- Student shell: login page and dashboard still load.

## Completion record (2026-09-24)

- `tsc -b`, `check:boundaries`, ESLint on the three files, production build and `git diff --check` passed.
- Edge 153, admin session, full page loads (not client navigation):
  - Reloading `/admin/question-libraries/<id>/questions`, `/admin/exams`, `/admin/windows`, `/admin/report`, `/admin/dashboard`, `/admin/sync` and `/admin/questions` stays on the page.
  - Header titles: Ngân hàng câu hỏi, Đề thi & ma trận, Kỳ thi, Báo cáo lý thuyết, Dashboard, Nhật ký đồng bộ TTDT, Ngân hàng câu hỏi.
- Sidebar at 800 px: `inert` while closed, 16 Tab presses never reach it; "Mở menu" sets `aria-expanded="true"` and focuses the first link; Escape closes it and returns focus to the button. Switching 800 ↔ 1280 toggles `inert` both ways; at 1280 sidebar links open by Enter and by click.
- No browser console errors during the run.
- Not yet checked: student shell (`src/pages/Layout.tsx`) after sign-in, which uses the same `AuthContext` and `AppLayout`.
