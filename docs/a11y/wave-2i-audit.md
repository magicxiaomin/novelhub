# Wave 2I Accessibility Audit

Linked issue: #324
Kanban task: t_8733ef55

## Scope

This audit covers the reader and book-detail primitives named in the Wave 2I accessibility acceptance criteria:

- `SettingsDrawer` (`apps/web/src/components/reader/settings-drawer.tsx`)
- `ReaderContent` scroll/tap affordances (`apps/web/src/components/reader/reader-content.tsx`)
- `ChapterList` (`apps/web/src/components/book/chapter-list.tsx`)

No axe, jest-axe, Playwright axe, package, production, deploy, environment, schema, data, Stripe, R2, drama, search-reactivation, or build-output changes were introduced.

## Findings and coverage

### Drawer focus

- The settings drawer already exposes `role="dialog"`, `aria-modal="true"`, and a localized `aria-label`.
- Wave 2I adds a programmatic focus target on the dialog container (`tabIndex={-1}`) and focuses it when the drawer opens. This gives keyboard and assistive-technology users a deterministic landing point when the drawer appears.
- Targeted coverage: `settings-drawer.spec.tsx` verifies the dialog role/label, the focus target, radiogroup labels, pressed state, checkbox control, and hidden state when closed.

### Icon button and icon affordance labels

- Reader top/bottom controls already use localized `aria-label` values for icon-only buttons and links.
- The central transparent reader tap target is a real `button` with the localized `Toggle reader controls` label.
- Chapter locked icons expose the localized `Locked` label; free chapters use visible text.
- Targeted coverage: `reader-content.spec.tsx` verifies the labeled reader tap target. `chapter-list.spec.tsx` verifies locked chapter icon labeling and that chapter rows remain links without unlabeled icon-only buttons.

### Reduced-motion conditional behavior

- The reader scroll progress bar conditionally omits width transition classes when `prefers-reduced-motion: reduce` is active.
- Targeted coverage: `reader-content.spec.tsx` stubs `matchMedia` and verifies the reduced-motion branch removes the transition class while keeping the progressbar label.

## Required test commands

Pin these commands in the PR description:

```bash
pnpm --filter @novelhub/shared build && pnpm --filter @novelhub/web typecheck
pnpm --filter @novelhub/web lint
pnpm --filter @novelhub/web test -- src/components/reader/settings-drawer.spec.tsx src/components/reader/reader-content.spec.tsx src/components/book/chapter-list.spec.tsx
```
