# Exam app follows the HPTTS brand identity

- Status: committed locally 2026-09-26, not pushed.
- Date: 2026-09-26
- Database: none.
- Rollback: `docs/rollback/2026-09-26-hptts-brand-identity.md`
- Source of rules: `QuanltTTDT-HPTTS/DESIGN.md` (section 1 brand identity, sections 3–8 app rules). The operator chose
  "Toàn app, trước tổng duyệt": the whole exam app, before the trial-exam rehearsal.

## Problem

The exam app still uses its own look, which the main app dropped on 2026-09-25/26:

- 210 `indigo-*` classes as the accent, and 22 decorative gradients: the sidebar (navy), the logo tile, the active menu
  item (indigo → blue → cyan with a glow), the page background, the login and "Vào thi" buttons, a colored band on top
  of every exam and window card, chart bars.
- No HPTTS logo anywhere; the sidebar shows a graduation-cap icon on a gradient tile.
- Font `system-ui`; the brand's web font is Arial.
- The violation alert button is white text on `sky-400` (about 2.1:1).
- "Sắp tới" uses sky, while the brand's status convention is amber for upcoming; the "Đang diễn ra" dots pulse forever.

## Change

Theme (`src/index.css`, Tailwind v4 `@theme`), same mapping as the main app's `tailwind.config.js`:

- `brand` 50–900 and `brand-cyan` 100–500 with the main app's values.
- `indigo-*` points to `brand` by role, not by number: 600 (main button/link) and 500 → `brand-500`, 700 → `brand-600`,
  800 → `brand-700`, 900/950 → `brand-900`, 50–400 keep their number. All 210 classes change color without editing files.
  New code writes `brand-*`.
- `slate-*` points to `gray-*`, the main app's neutral, so both apps share one neutral scale.
- Font: `Arial, Helvetica, sans-serif` for `body` and `font-sans`.

Frame:

- `public/brand/hptts-logo.png`: the main app's web copy of the standard logo (219×160, 12.7 KB).
- Sidebar (`components/AppLayout.tsx`): flat `brand-900`; logo 40px high on a white strip at the top (no negative logo
  exists yet, DESIGN.md 1.6) with "App Thi Online" in `brand-700`; active item white with `brand-700` text; avatar
  `brand-500`; no glow, no slide-in offsets; main area flat `slate-50`.
- Login (`pages/LoginPage.tsx`): flat `brand-50` page, logo 80px high, button `brand-500`/`brand-600`, no glow.
- Loading screens and the role picker: flat backgrounds; role labels at AA contrast.

Work area:

- Exam and window cards: the gradient band goes; the lock, trial and status badges move into the card body.
- Buttons ("Xác thực CCCD", "Vào thi"): flat `brand-500`; "Vào thi thực hành": flat `emerald-600`. Chart bars flat.
- Violation alert button: `brand-500`, white text 5.19:1.
- Role picker copy fixed while there: "Instruction" → "Instructor", and the literal `\"` around “Xác thực CCCD”.
- Window status: "Sắp tới" amber; the live dot stays, without the endless pulse (MOTION 1).

Not done, needs files from the designer (DESIGN.md 1.6–1.7): favicon (still Vite's), negative logo for the dark
sidebar, the "Tín – Tâm – Trí" band at the login footer, the brand display font.

## Checks (2026-09-26)

- `npm test` 35/35, `check:boundaries`, `lint` (0 errors, 6 existing warnings), `npm run build` pass. No
  `bg-gradient-to`, `radial-gradient`, colored glow or `animate-pulse` left in `src/`.
- Built CSS carries `--color-brand-500:#286fb7`, `--color-indigo-600:#286fb7`, `--font-sans:Arial…`.
- Edge, local build (`vite preview`), 1280px and 375px: login shows the logo 110×80, page `rgb(234,246,253)`
  (`brand-50`), button `rgb(40,111,183)` with white text, body font Arial, no horizontal scroll; role picker the same.
  The sidebar and signed-in screens need a session, so they are checked on production after deploy.
- After deploy, Edge with the operator's session: dashboard, question library, exams, windows; the student screens are
  covered by the rehearsal.
