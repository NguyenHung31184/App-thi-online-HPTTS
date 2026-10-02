# Practical templates: field grading set-up, TTDT module, soft delete

- Status: migration applied 2026-10-02 with B0 after a dry run and the operator's approval; code not pushed yet.
- Database: `supabase/migrations/20261003100000_practical_field_config.sql`.
- Rollback: `docs/rollback/2026-10-03-practical-field-config.md`
- Plan: `So_chuyen_can/docs/implementation/2026-10-02-ke-hoach-cham-thuc-hanh-va-modular.md` (B1). The operator wants
  practical templates authored in the exam app, like theory exams; the TTDT app only receives final grades.

## Change

- `practical_exam_templates.config` (object): protective equipment list, disqualifying faults (defaults from section V
  of the 2026 RTG end-of-module test), steps (name, whether it is a timed lift–move–lower cycle, photo prompt), time
  rule (three band limits in seconds, points per band, 0 past the last; average, fastest or last cycle).
- `practical_exam_criteria.step_key`, `kind` (`score` or `time`), `deductions` ([{label, points}]).
- `practical_attempts.ppe_check`, `cycle_seconds`; `practical_attempt_scores.deductions`;
  `practical_attempt_photos.kind`, `step_key` (written by Sổ chuyên cần).
- `is_deleted` on templates, criteria and sessions. Deleting a template, criterion or session in the exam app now
  sets it; lists and the student's open sessions leave deleted rows out.
- Template form: TTDT module (none could be chosen in the exam app before), pass mark on 100, the "Chấm tại sân"
  section, and per criterion its step, kind and quick deductions. Weight is no longer shown (field totals are plain
  sums; existing weights stay 1).
- Domain `field-config.ts` with tests: reading and checking the set-up, equal bands, time score, counted cycle time,
  score after deductions, totals on 100 and 10.

## Checks

- Unit tests (`field-config.test.ts`), database test (config must be an object; defaults).
- Production dry run in a block that raises at the end; apply with B0 after approval.
- Edge, local build after applying: create the RTG Khóa 43 template from the score sheet (8 criteria, 100 points),
  steps, time bands, faults; reopen and check everything was kept; delete a throwaway template and check it leaves the
  list but stays in the table.

## Results (2026-10-02)

- Dry run of B0 and B1 together on production: 14 new columns, the existing template unchanged, everything undone by
  the raise. Applied; versions `20261003090000`, `20261003100000` recorded.
- Edge, local build on the production database (operator approved creating it): template "Vận hành cần trục giàn RTG –
  Khóa 43 (phiếu chấm 2026)" (`f4a4b816…`), module `mod1773151802309`, pass mark 70; 4 steps (the third a timed cycle
  with a photo after each lowering, the last with a photo of the parked spreader); bands 3:30 / 5:00 / 6:30 for
  20 / 10 / 5 points, average of cycles; default protective equipment (4) and disqualifying faults (10); 8 criteria
  from the score sheet totalling 100, each with its step, the time criterion as `time`, quick deductions drafted from
  the sheet for the RTG teachers to correct. Read back after reload and in the database. No page errors.
