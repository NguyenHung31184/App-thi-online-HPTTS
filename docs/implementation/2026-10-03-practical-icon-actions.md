# Icon actions on the practical pages

- Status: done 2026-10-03, pushed (`5056c86`); checked in Edge on production.
- Rollback: `docs/rollback/2026-10-03-practical-icon-actions.md`.
- Database: none.
- Operator request 2026-10-03: the edit and delete actions of the practical pages are words; theory uses icons.

## Change

- `src/shared/ui/IconAction.tsx`: the icon button of the theory exam cards (`ExamsPage` `ActionBtn`: 28 px, tone
  colours, tooltip), as a link or a button, with `aria-label` from its title. Icons from `lucide-react`, already a
  dependency.
- Mẫu đánh giá (`TemplatesPage`): "Sửa / Tiêu chí" → pencil, "Xóa" → bin.
- Kỳ thi thực hành (`SessionsPage`): "Chấm bài" → clipboard check, "Sửa" → pencil, "Xóa" → bin.
- Tiêu chí (`CriteriaEditor`): "Xóa" → bin.
- The theory pages are not touched.

## Checks

`npm test`, `npx tsc -b`, `npm run lint`, `npm run check:boundaries`, `npm run build`; Edge on the local build: tooltips,
links and the delete confirmation still open.
