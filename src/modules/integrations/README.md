# integrations

Links with the TTDT management app. So far: the TTDT directory read by the exam app's admin forms (classes, modules,
modules by course, a student's classes). TTDT sync, its log and retry, and OCR join in phase 5 of
`docs/implementation/2026-10-01-modular-monolith-90-plan.md`.

- Domain: `ttdt-directory.ts` reads `course_modules` rows (object or array relations, deleted modules left out). Pure, tested.
- Data: `classes`, `modules`, `course_modules`, `enrollments`; a read that fails returns [] so the forms still open.
