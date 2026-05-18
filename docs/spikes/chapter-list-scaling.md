# Chapter List Scaling Spike

## 1. Traceability

- **Spike issue:** [#325 — \[Wave 2I\]\[W2I-5\] Chapter list scaling spike](https://github.com/magicxiaomin/novelhub/issues/325)
- **Parent:** [#320](https://github.com/magicxiaomin/novelhub/issues/320)
- **Umbrella:** [#230](https://github.com/magicxiaomin/novelhub/issues/230)
- **Status:** Planning only — no code, schema, dependency, data, secret, environment, or infra changes in this PR.
- **Decision target:** Follow-up RFC referenced from this document; implementation tracked in a new issue once a path is selected.

## 2. Scope & Non-Goals

### In scope

- Quantify current chapter-list behavior on the book detail page (`apps/web/src/app/book/[id]/page.tsx`, `apps/web/src/components/book/chapter-list.tsx`).
- Compare three rendering strategies for very long chapter lists (1k–10k+ chapters): server-paged status quo, chunked client render, and virtualization.
- Identify dependency, accessibility, SEO, analytics, and API implications of each option.
- Propose a measurement/perf-harness plan to validate the chosen path before implementation.

### Out of scope / non-goals

- Any code, dependency, schema, environment, secret, R2, Stripe, drama, search, production data, or deploy changes.
- Reader-drawer virtualization (`apps/web/src/components/reader/chapter-list-drawer.tsx`) — noted as an adjacent risk but tracked separately unless the RFC expands scope.
- API pagination contract changes (`/books/:id/chapters?page&limit`) — may surface in the follow-up RFC but is not decided here.
- Mobile-app or SSR-streaming work.
- Final selection between options — deferred until measurement data exists.

## 3. Current Behavior

### Server/API

- `BooksService.getById` returns the book plus the first `DETAIL_CHAPTER_PREVIEW = 10` chapters via Prisma `chapters: { where: { deletedAt: null }, orderBy: { order: 'asc' }, take: 10 }`.
- `BooksService.listChapters` validates the book exists, then calls Prisma `chapter.findMany({ where, orderBy: { order: 'asc' }, skip, take })` plus a parallel `count`.
- `DEFAULT_CHAPTER_PAGE_SIZE = 50` is the server default when the caller omits `limit`; the current book-page client explicitly requests 10.
- Prisma schema: `Chapter` has `@@unique([bookId, order])`, `@@index([bookId])`, and `deletedAt` soft delete. `Book.totalChapters` is denormalized.

### Web (RSC + client)

- `book/[id]/page.tsx` fetches book detail server-side, computes displayed word count from preview chapters with a `totalChapters * 2500` fallback, and renders `<ChapterList bookId={book.id} chapters={book.chapters} totalChapters={book.totalChapters} />`.
- `chapter-list.tsx` seeds client state with the 10 preview chapters, uses `CHAPTER_PAGE_LIMIT = 10`, and fetches additional pages through React Query (`fetchBookChapters` -> `/books/:id/chapters?page&limit`).
- Loaded chapters are appended, deduped by `id`, sorted by `order`, and rendered via `loaded.map(...)`; every loaded row remains in the DOM.
- `chapter-list-drawer.tsx` currently maps every provided chapter in a scroll drawer. This has the same DOM-bloat shape but is an adjacent reader-surface risk, not the primary book-detail scope for #325.

### Implicit assumptions today

- Most visible books have at most a few hundred chapters, making manual "Load more" acceptable.
- Browser layout/paint remains acceptable for the number of rows a user is likely to load.
- API pagination throttles both network and DOM growth.
- Users rarely need an immediate jump to chapter 1000+ from the detail page.

## 4. Scaling Risks

| Risk | Trigger | Impact |
|---|---|---|
| DOM size grows linearly with loaded chapters | Long serials (3k–10k+ chapters) and repeated "Load more" taps | Layout/paint cost, mobile jank, memory pressure |
| `loaded.map` re-renders all rows on append | Every new page changes the array | O(n) reconciliation per page load |
| Sort/dedupe on every fetch | `extraChapters` merge rebuilds list | O(n log n) merge work; trivial at 100, noticeable at 10k |
| Deep access to chapter N is awkward | Page size 10 means 100 fetches/taps to reach chapter 1000 | Latency, request volume, poor UX |
| API `count(*)` on every chapter page | Large chapter tables plus soft-delete filtering | Latency tail under load unless index/plan remains healthy |
| SEO/crawl surface remains preview-only | Initial HTML includes only preview chapters | Long-tail chapter discoverability is limited |
| A11y trade-off | Non-virtualized lists are slow; virtualization can disrupt focus/find/screen readers | Regression risk without explicit testing |
| Adjacent reader drawer | Drawer maps all supplied chapters | Reader open jank if future callers pass thousands |

## 5. Options

| Dimension | A. Server-paged status quo | B. Chunked client render | C. Virtualization |
|---|---|---|---|
| Sketch | Keep `/books/:id/chapters?page&limit`; tune page size if needed; render all loaded rows | Fetch larger chunks or all chapters under a threshold; render/append in chunks using browser primitives such as `IntersectionObserver` and/or `content-visibility: auto` | Windowed list with a small visible DOM using a library such as `@tanstack/react-virtual` or `react-virtuoso` |
| DOM size | Grows with pages tapped | Grows with chunks shown; cheaper if `content-visibility` is effective | Bounded to visible window + overscan |
| Initial paint | Fast: 10 preview rows | Fast to medium depending on first chunk | Fast if SSR fallback is controlled |
| Deep access to N | Poor without jump/search | Better if paired with larger chunks or search/jump | Strong if scroll-to-index/jump is supported |
| Memory | Linear in loaded rows | Linear in stored rows; render cost can be reduced | Bounded render memory; data memory depends on fetch strategy |
| Network | Many small calls | Fewer larger calls | One slim full index, range fetches, or hybrid |
| API changes | None | Maybe higher `limit` cap or slim index endpoint | Likely slim chapter-index endpoint and/or range/seek support |
| Dependency cost | None | None if browser primitives only | New runtime dependency unless custom-built |
| A11y risk | Lowest | Low to medium | Medium; focus, screen-reader navigation, and find-in-page need design |
| SEO | Unchanged preview SSR | Could SSR more rows if desired | Needs SSR fallback strategy |
| Test surface | Smallest | Medium | Largest |
| Effort | XS | S–M | M–L |
| Best fit | Current data if p99 chapter count is modest | Likely p99 if long books are uncommon or moderate | Confirmed 3k–10k+ common books and frequent deep navigation |

## 6. Measurement Plan & Perf Harness Proposal

### 6.1 Inputs to capture before deciding

- Production or staging distribution of `Book.totalChapters`: p50, p90, p95, p99, max.
- Top-N books by chapter count to size worst-case fixtures.
- Existing analytics (or a lightweight future event) for "Load more" tap depth and chapter-list engagement.
- API latency for `/books/:id/chapters` at representative page sizes and high chapter counts.

### 6.2 Synthetic fixtures

- Local/staging-only seed data with books containing N in `{50, 500, 2_000, 10_000}` chapters.
- Fixtures should be test/dev-only and must not write production data.
- Fixture chapter rows should include realistic title lengths, lock/free distribution, and word counts.

### 6.3 Perf harness proposal

Build a Playwright-based harness in a future implementation/RFC issue, path TBD (for example `apps/web/perf/` or an existing e2e/perf convention). Suggested scenarios:

1. Cold load `/book/:id` for each fixture size: measure TTFB, FCP, LCP, hydration time, JS execution time, and initial DOM node count.
2. Repeated "Load more" until a target chapter count: measure time per append, long tasks, heap delta, and row count.
3. Scroll to bottom of loaded list: measure dropped frames, layout shifts, and main-thread blocking.
4. Jump/search to chapter N if introduced: measure time to visible row.
5. Compare current status quo against prototypes of chunked render and virtualization.

Collect metrics via browser `performance` APIs plus Chrome DevTools Protocol:

- LCP, INP proxy interactions, CLS, long tasks over 50ms.
- Main-thread total, JS heap used, DOM node count, event listener count.
- API response timing and number of chapter-list requests.

Candidate budgets to confirm in the RFC:

- LCP <= 2.5s on a mid-tier mobile profile.
- No "Load more" interaction over 200ms INP-equivalent latency.
- DOM nodes <= 5,000 steady-state for any supported chapter count, unless measurements prove a higher ceiling is safe.
- No long task over 200ms during append/scroll.

A11y checks should include `@axe-core/playwright` plus manual VoiceOver/NVDA smoke if virtualization is selected. Lighthouse CI can be used as a non-blocking nightly/perf gate for the 2,000-chapter fixture before graduating to required checks.

## 7. Recommendation for Now & Deferred RFC Questions

### Working recommendation

- **This PR:** keep Option A and make no runtime changes. The spike is intentionally docs-only.
- **Next step:** measure current behavior first. If p99 chapter count is moderate, prefer **Option B (chunked client render with no new dependency)** because it improves worst-case UX while preserving simple accessibility and dependency posture.
- **Escalate to Option C (virtualization)** only if measurements show frequent 3k–10k+ chapter lists, unacceptable DOM/INP under Option B, or strong product need for immediate jump-to-index navigation.
- Treat the reader drawer as an explicit follow-up risk so it is not missed when implementing the chosen book-detail strategy.

### Deferred to RFC

1. Should the API expose a slim chapter-index endpoint returning only `{ id, order, title, isFree, wordCount? }` for faster full-list retrieval?
2. Should `CHAPTER_PAGE_LIMIT` or backend chapter `limit` caps change?
3. Should `Book` persist total word count to eliminate preview-based estimates? This would be a schema/data proposal and is out of scope for this spike.
4. How many rows should initial SSR include for SEO and mobile LCP?
5. Does product need jump-to-chapter/search/filter UX for very long books?
6. Should the reader drawer share the same rendering mechanism or get a separate tracked optimization?
7. What cache policy should `/books/:id/chapters` use if high-volume chapter-list browsing appears in analytics?
8. What bundle-size budget is acceptable if virtualization requires a new dependency?

## 8. Acceptance Criteria / Definition of Done

### This spike (#325)

- `docs/spikes/chapter-list-scaling.md` exists and links #325, #320, and #230.
- The document describes current API/web behavior, known scaling risks, option comparison, measurement plan, and deferred RFC questions.
- The PR is docs-only and modifies no production code, dependencies, database schema, env/secrets, production data, R2, Stripe, drama, search, or build outputs.
- The PR body links #325 and states that final implementation selection is deferred to a follow-up RFC/issue.

### Future implementation issue(s)

- Measurement report exists for at least N in `{500, 2_000, 10_000}` against the current implementation.
- The chosen approach meets RFC-approved budgets for LCP, interaction latency, DOM node count, and long tasks.
- Accessibility checks pass: automated axe plus manual screen-reader smoke if virtualization/windowing is used.
- SEO behavior is explicitly preserved or intentionally changed with product approval.
- Tests cover the selected rendering strategy, append/scroll behavior, dedupe/sort correctness, and jump/search behavior if introduced.
- If a new dependency is proposed, dependency review and bundle-size delta are documented before implementation.
- Reader drawer impact is either addressed or has a linked follow-up issue.

## 9. Docs-Only Notice

This PR adds a single planning document at `docs/spikes/chapter-list-scaling.md`. It changes no production code, dependencies, environment variables, secrets, database schema, production data, R2 objects, Stripe configuration, drama/search systems, or build outputs. All runtime implementation choices are deferred to a follow-up RFC and implementation issue.
