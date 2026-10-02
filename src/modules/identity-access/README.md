# identity-access

Who is using the exam app: Supabase sign-in, the exam role, the CCCD check before an exam, and the guards of the admin
and student areas.

- Domain: `access.ts` (role from `profiles.exam_role`, login email from a student code, landing page, admin and student
  area guards), `admin-access.ts` (teacher sections), `cccd.ts` (typed CCCD, request, failure message, student session).
  Pure, tested.
- Data: `auth-session.ts` (the only place that calls `supabase.auth` for sign-in; Supabase types stay here),
  `profile-repository.ts` (own profile, link to the TTDT student), `cccd-check.ts` (`/api/verify-cccd-for-exam`),
  `student-session-storage.ts` (`sessionStorage`, same keys as before the move).
- Application: `session.ts` (user of an account, sign in and out, remember the verified student, CCCD check).
- Queries: `auth-context.tsx` (`AuthProvider`, `useAuth`), `use-cccd-check.ts`.
- UI: login, role choice, CCCD check with camera and typed fallback.
- Other modules: `integrations` for OCR, through `public.ts`.

The role comes only from `profiles.exam_role`, which the management app sets; `user_metadata` is editable by the user.
`src/contexts/AuthContext.tsx` is a re-export kept for the e-learning pages until phase 4.

Testing note: Supabase's sign-out ends the user's other sessions too; tests that copy a production session into a local
build must not click "Đăng xuất".

See `docs/implementation/2026-10-02-phase-5-identity-integrations.md`.
