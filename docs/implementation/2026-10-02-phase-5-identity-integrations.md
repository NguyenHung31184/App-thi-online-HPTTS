# Modular monolith phase 5: `identity-access` and `integrations`

- Status: in progress.
- Date: 2026-10-02
- Database: none. Behaviour and screens unchanged (moves only).
- Rollback: `docs/rollback/2026-10-02-phase-5-identity-integrations.md`
- Plan: `docs/implementation/2026-10-01-modular-monolith-90-plan.md`, phase 5. Progress: `docs/MODULAR_MONOLITH_TIEN_DO.md`.
- Phase 4 (`learning`) is deferred by the operator (2026-10-02): the E-LEARNING stash in this repo changes the same
  files; e-learning is developed later.

## Scope (about 1,900 lines on 2026-10-02)

`identity-access`:

- `src/contexts/AuthContext.tsx` (219): Supabase session, role from `profiles.exam_role`, CCCD student session in
  `sessionStorage`; imported by 18 files.
- `src/services/profileService.ts` (34), `src/services/verifyCccdService.ts` (37).
- `src/pages/LoginPage.tsx` (92), `src/pages/RoleSelectPage.tsx` (55), `src/pages/VerifyCccdPage.tsx` (373),
  `src/components/CccdCameraCapture.tsx` (302).
- Route guards inside `src/pages/Layout.tsx` and `src/pages/admin/AdminLayout.tsx`; `src/utils/adminAccess.ts` (teacher
  sections, tested).

`integrations` (already holds the TTDT directory since phase 1b):

- `src/services/ttdtSyncService.ts` (49), `src/services/syncLogService.ts` (127), `src/services/ocrService.ts` (110).
- `src/pages/admin/AdminSyncPage.tsx` (502): reads `profiles` directly and uses `attemptService.getAttempt`.

## Steps (one commit each)

1. **Domain.** Pure rules with tests: role from `exam_role`, login email from a student code, landing page after login,
   the two guards (admin area by role and teacher sections; student area needs a user or a CCCD student session),
   CCCD input normalisation, TTDT sync error explanations, OCR response mapping.
2. **`identity-access` core.** `data/` (auth session adapter over `platform/supabase`, own profile, CCCD check call,
   student session storage), `application/`, `ui/AuthProvider` with `useAuth`; `public.ts`. The 18 importers switch
   to `identity-access/public`; `contexts/AuthContext`, `profileService`, `verifyCccdService` are deleted; the phase-5
   allowlist entries for `useAuth` go away. Layouts keep their markup and call the guard rules from the module.
3. **`identity-access` pages.** Login, role choice, CCCD check and the camera into `identity-access/ui/`, each file at
   most 350 lines; routes `/start`, `/login`, `/verify-cccd` from `public.ts`.
4. **`integrations` sync and OCR.** `ttdtSyncService`, `syncLogService`, `ocrService` and the sync log page move into
   `integrations`; route `/admin/sync` from `public.ts`; `practical-exams` uses the sync through `integrations/public`
   (its allowlist entry goes away). The theory retry reads the attempt through `integrations/data`; the window and
   profile lookups the old page made are dropped because the server sync uses only the attempt id (same messages).
5. **Facades and docs.** Delete what is left, regenerate the allowlist, module READMEs, score.

Kept as is (to decide separately): "Dọn log lỗi cũ" deletes failed sync logs older than 30 days (hard delete).

Step 2 notes: `useAuth()` no longer returns the raw Supabase `session` (no file used it); the Supabase types stay in
`identity-access/data`. `src/contexts/AuthContext.tsx` remains as a re-export for `StudentLearnPage` and
`LessonPlayerPage`, which the E-LEARNING stash changes (phase 4). Edge, local build: signed out, `/admin/report` goes to
`/login` and `/dashboard` to `/start`; `/start`, `/login`, `/verify-cccd` render; as admin, dashboard, windows, sync,
practical grading and `/dashboard` open, and F5 on `/admin/windows` stays there. Sign-out was not clicked: Supabase's
sign-out would also end the production tab's session.

## Checks (each step)

`npm run check:boundaries`, `npm run arch:score`, `npm test`, `npx tsc -b`, `npm run lint`, `npm run build`.
Edge, local build: sign out and sign in as admin; open admin pages after F5 (no bounce to /login); a teacher-only path
check through the tested guard; `/start`, `/login`, `/verify-cccd` render; sync log page lists the same rows as
production. No CCCD check, retry or cleanup on real data without the operator.
