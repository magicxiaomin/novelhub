# Novels-only funnel

Linked issues: #195, #196, #204, #215, #216, #217, #218, #219, #233, #418, #420, #421, #422, #423, #424, #429

This document defines the active NovelHub acquisition funnel after the novels-only pivot. It is the reference path for product copy, routing, QA, telemetry, and launch readiness until a later ADR changes direction. External launch verification remains tracked separately by #233 and Kanban `t_030c3f29`; those blockers are still open and are not resolved by this docs map.

## Canonical funnel

```text
ad landing -> novel detail -> free chapters -> paywall -> purchase/unlock -> library
```

## Stage map

| Stage           | User intent                                                            | Product surface                                                                                             | Success signal                                                                         | Notes                                                                                                |
| --------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Ad landing      | Arrive from a paid/social campaign and understand the promise quickly. | Home/landing page or campaign-specific novel landing route.                                                 | User clicks into a novel or starts reading.                                            | Campaign copy should point to novels, not dramas.                                                    |
| Novel detail    | Evaluate a story before reading.                                       | Book/novel detail page with title, cover, description, genre/status, and chapter list or start-reading CTA. | User opens the first free chapter.                                                     | Keep SEO/share metadata aligned to the novel.                                                        |
| Free chapters   | Sample the story with minimal friction.                                | Reader for free chapters.                                                                                   | User reaches the configured locked chapter boundary.                                   | Guests may read free chapters according to chapter unlock rules.                                     |
| Paywall         | Explain why the next chapter is locked and present payment options.    | Reader paywall for locked chapters.                                                                         | User chooses subscription or coin unlock path.                                         | Paywall should be chapter-focused and preserve reading context.                                      |
| Purchase/unlock | Complete monetization action.                                          | Stripe subscription/checkout or coin unlock flow.                                                           | Subscription becomes active, coins are purchased/spent, or chapter unlock is recorded. | Every coin balance change must create a transaction row; Stripe webhook signatures remain mandatory. |
| Library         | Return to owned or in-progress reading.                                | Account/library/continue-reading surfaces.                                                                  | User resumes unlocked chapters or subscribed content.                                  | Library should reflect entitlement state without exposing drama content.                             |

## Surface map

| Surface | Active role in the novels-only funnel | Current documentation boundary |
| --- | --- | --- |
| Reader | Hosts free chapter sampling, locked-chapter paywalls, entitlement-aware access, and return-to-reading context. | Reader work should stay aligned with the chapter unlock rules below and avoid drama episode playback paths. |
| Continue-reading / shelf | Gives users a way back to in-progress or owned novel chapters after reading or unlocking. | Treat these as novel/account recovery surfaces; do not introduce a drama shelf while the pivot is active. |
| Account / purchases | Shows subscription, coin, and transaction state that supports chapter unlock decisions. | Keep account copy and formatting novel-entitlement oriented; Stripe live/payment mutation remains out of scope for R&D waves. |
| Novel discovery / detail | Converts ad or organic traffic into a first free chapter read. | Campaign, SEO, and share copy should point to novels and novel chapters, not short-drama routes. |

## Wave 2T characterization baseline

The current test-characterization baseline for the novels-only pivot is the merged Wave 2T set:

| PR | Outcome | Surface |
| --- | --- | --- |
| #420 | Characterized continue-reading rail boundaries. | Continue-reading / shelf |
| #421 | Characterized exported reader helper behavior. | Reader |
| #422 | Characterized novels filter parser and list-query adapter edges. | Novel discovery / detail |
| #423 | Characterized formatter boundaries. | Account / purchases |

Known gaps remain separate from this baseline: #418 is still open for consent-banner UI transition coverage pending the dependency-policy decision, and #233 / Kanban `t_030c3f29` remain open external launch blockers.

## Entitlement rules carried forward

The novels-only funnel keeps the existing chapter unlock model:

1. Free chapters are readable by anyone, including guests.
2. Active subscriptions unlock paid chapters while active.
3. Individually unlocked chapters remain readable for that user.
4. Otherwise the reader shows the paywall.

## Out-of-funnel surfaces

Drama browse, drama detail, episode playback, drama progress, drama admin, drama media fixtures, and drama smoke checks are not part of the active launch funnel. Their disposition is tracked in `docs/pivot/quarantine-register.md`.

## QA checklist for follow-up tickets

- Ad/campaign links do not point to `/dramas` or episode URLs.
- Primary navigation and home CTAs route to novel discovery/detail/reader surfaces.
- Free chapter reading still works for guests.
- Locked chapter paywall still offers subscription and coin unlock paths.
- Purchase/unlock completion returns the user to the chapter or library.
- Library/account surfaces do not advertise drama content while the pivot is active.

## Environment/config note

Docs and env examples should describe the active novels-only surface. Legacy drama domains, HLS fixtures, episode terminology, and drama flags may appear only as superseded historical references or deprecated-route assertions. Live DNS/domain/cert/CDN/secrets/R2/DB teardown is out of scope for #219 and tracked separately.
