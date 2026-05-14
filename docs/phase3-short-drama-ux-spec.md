# DRAMA-009 — NovelHub Short-Drama MVP: UX & Design Specification

> Superseded for active launch direction (#219): this short-drama artifact is retained only as historical/reference material after the novels-only pivot (#195/#204) and the drama cutoff/removal sequence (#215-#218). Do not use it to launch, seed, QA, or configure active drama surfaces. True-delete/data/media/schema/live DNS/domain/cert/CDN/secrets/R2/DB teardown is out of scope here and tracked separately by #220 / `docs/pivot/drama-true-delete-runbook.md`.

Status: Draft for review
Owner: Design + Frontend
Last updated: 2026-05-10
Related: GitHub #136; Phase 3 short-drama MVP spec, drama data-model ADR, video-pipeline ADR, and implementation plan from PR #133.

This document is a UX/design specification only. It intentionally contains no product code.

---

## 1. Overview and scope

### Purpose

Define the mobile-first NovelHub short-drama MVP experience across browse, drama detail, episode player, paywall, and admin publishing surfaces. This spec resolves the expected UX implications of the Phase 3 data model and external/mock HLS video-pipeline decisions.

### In scope

- Public web screens: browse/home, browse-all, drama detail, episode player, paywall state, library/continue-watching, account entry points.
- Admin screens: drama CRUD, episode CRUD, ingest status, status/publish flow.
- Route map and information architecture.
- Low-fidelity ASCII wireframes.
- Component state requirements: loading, empty, error, skeleton, auth, payment, age-gate, offline.
- Accessibility, analytics, acceptance criteria, GitHub issue breakdown, Hermes Kanban graph, PR sequence, and human gates.

### Out of scope

- Native mobile apps.
- TikTok-style infinite vertical autoplay.
- Algorithmic personalization beyond editorial rows and continue-watching.
- DRM beyond the signed/mock HLS model already covered by the video-pipeline ADR.
- Creator self-serve upload, bulk import, social comments, watch parties, multi-role admin, and user-uploaded subtitles.
- Implementation code.

### UX goals

| Goal                                                                                          | Non-goal                                         |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| A first-time visitor can find and start episode 1 in no more than three taps from home.       | Full algorithmic feed personalization.           |
| A returning signed-in user can resume from the first fold.                                    | Native-app parity.                               |
| A locked episode explains why it is locked and what unlocks it without losing player context. | A standalone paywall route replacing the player. |
| An editor can publish a drama with episodes from a focused admin shell.                       | A general-purpose CMS.                           |

### UX success metrics

- Browse to playback conversion: at least 35% of sessions that view a detail page start playback.
- Player time-to-first-frame: p75 <= 2.5s on 4G for playable episodes.
- Paywall comprehension proxy: fewer than 5% of paywall impressions bounce back within 2s.
- Admin publish efficiency: median time to publish a 10-episode drama <= 15 minutes once assets are ready.

---

## 2. Codex feasibility findings disposition

| #   | Codex finding                                                                                           | Decision | Rationale                                                                                                                            | UX consequence                                                                              |
| --- | ------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1   | Admin scope creep: admin CRUD could grow into roles, audit logs, bulk import, and CMS complexity.       | Modify   | Keep admin in MVP but constrain it to one editor role, focused drama/episode CRUD, basic ingest status, and no bulk import/audit UI. | Admin is a publishing tool, not a CMS; one nav rail and limited screens.                    |
| 2   | Paywall/player desync: separate paywall and player routes can cause stale entitlement after checkout.   | Adopt    | Paywall is a state inside the player shell. Entitlement is rechecked on player mount and after checkout return.                      | Player has locked, unlocking, unlocked, and failure states.                                 |
| 3   | HLS/browser limitations: Safari native HLS, Chrome/Firefox MSE behavior, and autoplay policies diverge. | Adopt    | UX never assumes autoplay with sound. The player has a distinct gesture-required state and supports native fullscreen fallbacks.     | A visible tap-to-play affordance appears when required; captions remain top-level.          |
| 4   | Data model constraints: episode order may be sparse and drama status has more than draft/published.     | Adopt    | UI does not renumber episodes; admin exposes the full status set with explicit labels.                                               | Detail chips key by episode id and display label/order; admin has a labeled status control. |
| 5   | Responsive desktop: mobile-only is too narrow for existing NovelHub traffic.                            | Modify   | Mobile is primary, but desktop is supported with widened grids and centered content, not bespoke desktop-only flows.                 | Breakpoints: small <=640px, medium 641-1024px, large >=1025px.                              |
| 6   | Observability: page views are insufficient for player/paywall/admin diagnosis.                          | Adopt    | Define lifecycle events for browse, detail, player, paywall, and admin.                                                              | Every major state transition has a documented analytics event.                              |

Rejected findings: none.

Deferred items: social comments, watch parties, user-uploaded subtitles, custom PiP controls, multi-role admin, bulk import, and creator self-serve upload.

---

## 3. Final PRD and design spec

### Personas

| Persona  | Need                                           | Key UX promise                                                          |
| -------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| Skimmer  | Mobile visitor sampling short dramas quickly.  | Low-friction browse and immediate episode 1 playback.                   |
| Returner | Signed-in user resuming in-progress episodes.  | Continue Watching appears above editorial rows.                         |
| Buyer    | User who reaches a locked episode.             | Clear unlock value, price, restore/sign-in paths, and return to player. |
| Editor   | Internal admin user managing drama publishing. | Focused creation/editing with validation and recoverable errors.        |

### Core flows

1. Cold browse to first play: Home -> Drama detail -> Episode 1 player.
2. Resume: Home -> Continue Watching card -> Player resumes within 5s of prior position.
3. Locked episode conversion: Player locked state -> Paywall card -> Checkout -> Return -> Entitlement recheck -> Playback resumes.
4. Admin publish: Admin dashboard -> Drama list -> New drama -> Metadata -> Episodes -> Publish.

### Visual and interaction principles

- Reuse existing NovelHub tokens; no new brand system.
- Posters use 2:3; episode thumbnails and video surfaces use 16:9.
- Bottom navigation on small screens; top navigation on medium/large screens.
- Transitions are 150-200ms and respect prefers-reduced-motion.
- Locked states always use an icon plus text, never color alone.
- Skeletons preserve final layout dimensions to prevent layout shift.

---

## 4. Route map

### Public routes

| Route                            | Screen                    | Auth                                                          | Notes                                                       |
| -------------------------------- | ------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| `/`                              | Home/browse               | Optional                                                      | Hero, Continue Watching when signed in, editorial rows.     |
| `/dramas`                        | Browse all                | Optional                                                      | Genre/status/language filters and paginated grid.           |
| `/dramas/:slug`                  | Drama detail              | Optional                                                      | Synopsis, metadata, episode list, CTA.                      |
| `/dramas/:slug/watch/:episodeId` | Episode player            | Optional for free episodes; required/paid for locked episodes | Paywall renders inside player.                              |
| `/library`                       | Library/continue-watching | Required                                                      | Redirects to login with next parameter for anonymous users. |
| `/account`                       | Account/subscription      | Required                                                      | Subscription summary and sign-out.                          |
| `/login` and `/signup`           | Auth                      | Anonymous                                                     | Return to next URL after success.                           |
| `/checkout/return`               | Checkout return           | Required                                                      | Rechecks entitlement and redirects to intended player.      |
| `/404`, `/403`, `/offline`       | Utility routes            | Mixed                                                         | Error and offline fallbacks.                                |

### Admin routes

| Route                                   | Screen                                           | Gate        |
| --------------------------------------- | ------------------------------------------------ | ----------- |
| `/admin`                                | Admin dashboard                                  | editor role |
| `/admin/dramas`                         | Drama list                                       | editor role |
| `/admin/dramas/new`                     | Drama create                                     | editor role |
| `/admin/dramas/:id`                     | Drama edit with Metadata, Episodes, Publish tabs | editor role |
| `/admin/dramas/:id/episodes/:episodeId` | Episode edit                                     | editor role |
| `/admin/jobs`                           | Ingest job list                                  | editor role |

---

## 5. Information architecture

```text
NovelHub
├── Public
│   ├── Home
│   │   ├── Featured hero
│   │   ├── Continue Watching       [signed-in only]
│   │   ├── Trending
│   │   └── New this week
│   ├── Browse all
│   │   ├── Filters: genre, status, language, length
│   │   └── Drama grid
│   ├── Drama detail
│   │   ├── Poster/title/metadata
│   │   ├── Primary CTA
│   │   ├── Synopsis
│   │   ├── Episode chips/list
│   │   └── Related dramas
│   ├── Player
│   │   ├── Video surface
│   │   ├── Controls
│   │   ├── Up next rail
│   │   └── Paywall state
│   ├── Library
│   │   ├── Continue Watching
│   │   └── Saved dramas
│   └── Account
│       ├── Profile
│       └── Subscription
└── Admin
    ├── Dashboard
    ├── Dramas
    │   ├── List
    │   ├── Create
    │   └── Edit: Metadata | Episodes | Publish
    └── Jobs
```

Global chrome:

- Public small screens: top bar plus bottom tabs: Home, Browse, Library, Account.
- Public medium/large screens: top nav with search, library, account.
- Admin small screens: drawer nav.
- Admin medium/large screens: persistent left rail.

---

## 6. Wireframes and component states

Wireframes are mobile-first unless labeled desktop/admin. Medium and large breakpoints reuse these components in wider grids.

### 6.1 Browse/Home wireframe

```text
┌───────────────────────────────┐
│ NovelHub        [Search] [Me] │
├───────────────────────────────┤
│ ┌───────────────────────────┐ │
│ │      FEATURED 16:9        │ │
│ │ Title · 12 ep · Drama     │ │
│ │ [Play E1] [Save]          │ │
│ └───────────────────────────┘ │
│                               │
│ Continue Watching         >   │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│ │E3  │ │E1  │ │E7  │ │E2  │   │
│ └────┘ └────┘ └────┘ └────┘   │
│                               │
│ Trending                   >  │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│ │2:3 │ │2:3 │ │2:3 │ │2:3 │   │
│ └────┘ └────┘ └────┘ └────┘   │
│                               │
│ New this week              >  │
│ ┌────┐ ┌────┐ ┌────┐          │
│ │2:3 │ │2:3 │ │2:3 │          │
│ └────┘ └────┘ └────┘          │
├───────────────────────────────┤
│ Home   Browse   Library   Me  │
└───────────────────────────────┘
```

Browse/Home states:

| State         | Trigger              | Required UX                                                           |
| ------------- | -------------------- | --------------------------------------------------------------------- |
| Loading       | Home data requested  | Top bar renders immediately; row skeletons fill content.              |
| Skeleton      | Loading lasts >400ms | Aspect-correct card placeholders; avoid spinner flash.                |
| Empty         | No continue-watching | Hide row if signed in with no history; anonymous users never see row. |
| Empty catalog | No editorial items   | Show onboarding card: New dramas coming soon.                         |
| Error         | One row fails        | Row-level retry banner; other rows remain visible.                    |
| Auth          | Signed out           | Hide Continue Watching; Play E1 remains available for free episodes.  |
| Payment       | Not applicable       | No browse-level payment UI.                                           |
| Age-gate      | 18+ drama displayed  | Poster blurred until confirmation.                                    |
| Offline       | Browser offline      | Top banner: You're offline. Showing saved content where available.    |

### 6.2 Drama detail wireframe

```text
┌───────────────────────────────┐
│ < Back                  Save  │
├───────────────────────────────┤
│ ┌───────────────────────────┐ │
│ │        POSTER 2:3         │ │
│ └───────────────────────────┘ │
│ Title of the Drama            │
│ 2026 · Drama · 24 ep · 18+    │
│                               │
│ [ Play Episode 1 ]            │
│ [ Save ] [ Share ]            │
│                               │
│ Synopsis text up to 4 lines   │
│ with [more] if truncated.     │
│                               │
│ Episodes                      │
│ ┌─┬─┬─┬─┬─┬─┬─┬──┬──┬──┐      │
│ │1│2│3│4│5│6│7│8🔒│9🔒│10🔒│ │
│ └─┴─┴─┴─┴─┴─┴─┴──┴──┴──┘      │
│                               │
│ More like this             >  │
│ ┌────┐ ┌────┐ ┌────┐          │
│ └────┘ └────┘ └────┘          │
└───────────────────────────────┘
```

Drama detail states:

| State    | Trigger                           | Required UX                                              |
| -------- | --------------------------------- | -------------------------------------------------------- |
| Loading  | Detail requested                  | Poster, title, metadata, CTA, chip skeletons.            |
| Skeleton | Loading lasts >400ms              | Preserve final layout dimensions.                        |
| Empty    | Drama has zero published episodes | Disabled CTA with Episodes coming soon helper.           |
| Error    | Detail fetch fails                | Full-screen retry with Back fallback.                    |
| Auth     | Anonymous taps Save               | Sign-in sheet; do not hard-route away.                   |
| Payment  | Locked chip tapped                | Tooltip/inline hint, then player opens to locked state.  |
| Age-gate | 18+ drama first viewed            | Modal blocks detail content until confirmed or canceled. |
| Offline  | Offline                           | Disable episode chips; show offline banner.              |

Episode rendering rule: sort by stored episode order ascending, preserve gaps, and never renumber. Display `episode.label` when present, otherwise display the stored order number.

### 6.3 Player wireframe

```text
┌───────────────────────────────┐
│ < Drama title           Close │
├───────────────────────────────┤
│                               │
│          VIDEO 16:9           │
│                               │
│          [ Tap to play ]      │
│                               │
├───────────────────────────────┤
│ ━━━━━━━●────────── 12:34      │
│ Prev  Play  Next   CC  HD  FS │
├───────────────────────────────┤
│ E3 · The reveal               │
│                               │
│ Up next                    >  │
│ ┌────┐ ┌────┐ ┌────┐          │
│ │E4  │ │E5🔒│ │E6🔒│          │
│ └────┘ └────┘ └────┘          │
└───────────────────────────────┘
```

Player states:

| State            | Trigger                               | Required UX                                    | Event                     |
| ---------------- | ------------------------------------- | ---------------------------------------------- | ------------------------- |
| Loading          | Manifest/player setup                 | Black video surface; spinner only after 400ms. | `player_loading`          |
| Skeleton         | First mount <400ms                    | Black surface, no controls jump.               | none                      |
| Gesture required | Autoplay blocked                      | Center Tap to play button; no spinner.         | `player_gesture_required` |
| Playing          | Playback begins                       | Controls auto-hide after inactivity.           | `player_play`             |
| Paused           | User pauses                           | Controls remain visible.                       | `player_pause`            |
| Buffering        | Waiting event                         | Spinner overlay; controls dimmed.              | `player_buffer`           |
| Ended            | Episode completes                     | Up-next card with 5s countdown and cancel.     | `player_ended`            |
| Transient error  | Network blip                          | Toast: Reconnecting; retry twice.              | `player_error_transient`  |
| Fatal error      | Manifest 404/decode failure           | Full overlay with Retry and Back.              | `player_error_fatal`      |
| Auth             | Anonymous reaches locked episode      | Paywall variant asks sign-in first.            | `paywall_auth_required`   |
| Payment          | Locked episode                        | Paywall card inside player.                    | `paywall_shown`           |
| Age-gate         | 18+ episode first played              | Age confirmation modal blocks video.           | `player_age_gate`         |
| Offline          | Offline with no cached playable asset | Overlay: Connect to play.                      | `player_offline`          |

Browser notes:

- iOS Safari may enter native fullscreen; UX must tolerate native controls and still record lifecycle/progress events where available.
- Chrome, Edge, and Firefox use the web player path; never rely on autoplay with sound.
- Captions are a top-level control, not hidden in settings.

### 6.4 Paywall wireframe

Paywall is a player state, not a separate route.

```text
┌───────────────────────────────┐
│ < Drama title           Close │
├───────────────────────────────┤
│       Blurred video frame     │
│       Lock: Episode 8         │
├───────────────────────────────┤
│ ┌───────────────────────────┐ │
│ │ Unlock all episodes       │ │
│ │                           │ │
│ │ (•) Monthly  $4.99/mo     │ │
│ │ ( ) Annual   $39/year     │ │
│ │                           │ │
│ │ ✓ All current episodes    │ │
│ │ ✓ New episodes weekly     │ │
│ │ ✓ Cancel anytime          │ │
│ │                           │ │
│ │ [ Continue ]              │ │
│ │ Restore · Sign in         │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
```

Paywall states:

| State         | Required UX                                                              |
| ------------- | ------------------------------------------------------------------------ |
| Idle          | Plan list, value bullets, Continue CTA, Restore and Sign in links.       |
| Submitting    | Continue button shows spinner; selected plan preserved.                  |
| Checkout open | Provider sheet/redirect starts; local paywall state remains recoverable. |
| Unlocking     | After return, show Unlocking while entitlement is rechecked.             |
| Success       | Transition to player loading, then resume at lock point.                 |
| Failure       | Inline error; Try again; plan selection preserved.                       |
| Auth required | Replace plans with Sign in to subscribe and Cancel.                      |
| Offline       | Disable Continue; show Connect to subscribe.                             |

### 6.5 Admin drama edit wireframe

```text
┌────────────┬─────────────────────────────────┐
│ NovelHub   │ Dramas / Title       [Save]     │
│ Admin      ├─────────────────────────────────┤
│            │ [Metadata] [Episodes*] [Publish]│
│ Dashboard  │                                 │
│ Dramas *   │ Status: draft / review /        │
│ Jobs       │         published / unlisted /  │
│            │         archived                │
│            │                                 │
│            │ Episodes (12)          [+ Add]  │
│            │ ┌─────────────────────────────┐ │
│            │ │ #1 Pilot        ready       │ │
│            │ │ #2 Reveal       ingesting   │ │
│            │ │ #3 Trial        failed Retry│ │
│            │ │ #4 Verdict      ready       │ │
│            │ │ #6 Aftermath    ready       │ │
│            │ └─────────────────────────────┘ │
│            │                                 │
│            │ [Save draft] [Publish]          │
└────────────┴─────────────────────────────────┘
```

Admin states:

| State             | Required UX                                        |
| ----------------- | -------------------------------------------------- |
| Loading           | Skeleton form rows; tabs disabled until loaded.    |
| Empty             | Drama list shows No dramas yet with New drama CTA. |
| Error             | Top banner; local edits retained; Retry available. |
| Skeleton          | Form structure placeholders after 400ms.           |
| Auth              | Not signed in redirects to login with next.        |
| Permission denied | Signed-in non-editor sees `/403`.                  |
| Payment           | Not applicable.                                    |
| Age-gate          | Not applicable in admin.                           |
| Offline           | Read-only banner; save/publish disabled.           |
| Dirty             | Save enabled; route-leave guard.                   |
| Saving            | Buttons disabled with spinner.                     |
| Validation error  | Field-level errors and focus first invalid field.  |
| Optimistic lock   | Modal: Reload or Overwrite, default Reload.        |
| Publish blocked   | Disabled Publish with explicit reason.             |

### 6.6 Admin jobs wireframe

```text
┌────────────┬─────────────────────────────────┐
│ Admin      │ Jobs                       [↻]  │
├────────────┼─────────────────────────────────┤
│ Dramas     │ Filter: all     last 24h        │
│ Jobs *     │                                 │
│            │ ┌─────────────────────────────┐ │
│            │ │ ✓ ingest E2 Title      3m   │ │
│            │ │ … ingest E5 Title      now  │ │
│            │ │ ! ingest E3 Title      fail │ │
│            │ └─────────────────────────────┘ │
│            │ [Load more]                     │
└────────────┴─────────────────────────────────┘
```

Jobs is read-only in MVP. Retry actions live on episode rows, not the jobs list.

---

## 7. Consolidated state matrix

| Area        | Loading                 | Empty                                                               | Error                  | Skeleton                       | Auth                              | Payment                             | Age-gate              | Offline                                   |
| ----------- | ----------------------- | ------------------------------------------------------------------- | ---------------------- | ------------------------------ | --------------------------------- | ----------------------------------- | --------------------- | ----------------------------------------- |
| Browse/Home | Row data loading        | Hide absent Continue Watching; show catalog onboarding if no dramas | Row-level banner       | Aspect-ratio placeholders      | Hide authed-only rows             | Not applicable                      | Blur 18+ posters      | Offline banner and saved-only affordances |
| Detail      | Detail data loading     | No episodes: disabled CTA                                           | Full retry screen      | Poster/title/chip placeholders | Save opens sign-in sheet          | Locked chip leads to player paywall | Modal before content  | Disable episode actions                   |
| Player      | Manifest/player loading | Not applicable                                                      | Toast or fatal overlay | Black surface placeholders     | Locked anon opens sign-in variant | Inline paywall state                | Modal blocks playback | Connect to play overlay                   |
| Paywall     | Unlocking entitlement   | Not applicable                                                      | Inline payment failure | Not applicable                 | Sign-in to subscribe              | Plan/submitting/success/failure     | Inherits player gate  | Disable purchase action                   |
| Admin       | Form/table loading      | Empty list CTA                                                      | Banner, retain edits   | Form/table placeholders        | Login redirect                    | Not applicable                      | Not applicable        | Read-only banner                          |
| Library     | Rows loading            | Empty saved/continue message                                        | Row-level retry        | Card placeholders              | Full-page sign-in CTA             | Not applicable                      | Inherits poster blur  | Cached-only content                       |

---

## 8. Accessibility requirements

Target: WCAG 2.2 AA.

### Keyboard

- Every interactive element is keyboard reachable with a visible focus ring.
- Player keyboard shortcuts: Space play/pause, left/right seek 10s, up/down volume, M mute, C captions, F fullscreen.
- Episode chip groups use roving tabindex and arrow-key navigation.
- Paywall dialog traps focus; Escape/back dismisses to drama detail, not to a hidden player state.

### Screen readers

- Poster images use alt text: `{Drama title} poster`.
- Player surface uses `role="region"` with label `Video player: {drama title} - {episode label}`.
- Paywall uses dialog semantics and returns focus to the triggering locked affordance on dismiss.
- Buffering and error messages use polite live regions.
- Episode controls announce locked/free status.

### Captions and media

- Captions control is top-level and visible whenever controls are visible.
- Captions preference persists per user/device.
- Captions default to on when a prior preference or system caption preference is detected.

### Motion and contrast

- Respect `prefers-reduced-motion`.
- Text contrast >= 4.5:1.
- Player controls use a scrim to maintain contrast over arbitrary video frames.
- Locked and error states do not rely on color alone.

### Admin forms

- Visible labels for all fields.
- Required fields are labeled with text, not only an asterisk.
- Errors are tied to fields and announced.
- First invalid field receives focus after failed submit.

---

## 9. Analytics contract

All events include: `session_id`, nullable `user_id`, `ts`, `route`, `breakpoint`, and `feature_flag_state`.

### Browse/detail events

| Event                                                          | Key properties                        |
| -------------------------------------------------------------- | ------------------------------------- |
| `home_view`                                                    | `is_authed`, `rows_rendered`          |
| `home_row_error`                                               | `row`, `error_code`                   |
| `card_impression`                                              | `drama_id`, `row`, `position`         |
| `card_click`                                                   | `drama_id`, `row`, `position`         |
| `drama_view`                                                   | `drama_id`, `is_authed`               |
| `episode_chip_click`                                           | `drama_id`, `episode_id`, `is_locked` |
| `age_gate_shown` / `age_gate_confirmed` / `age_gate_cancelled` | `drama_id`, optional `episode_id`     |

### Player events

| Event                                           | Key properties                          |
| ----------------------------------------------- | --------------------------------------- |
| `player_open`                                   | `drama_id`, `episode_id`, `entry_route` |
| `player_loading`                                | `drama_id`, `episode_id`                |
| `player_gesture_required`                       | `browser_family`, `autoplay_policy`     |
| `player_play` / `player_pause`                  | `position_s`                            |
| `player_seek`                                   | `from_s`, `to_s`                        |
| `player_buffer`                                 | `duration_ms` on resume                 |
| `player_quality_change`                         | `from_quality`, `to_quality`            |
| `player_captions_toggle`                        | `to_state`                              |
| `player_progress`                               | `position_s`, `percent`                 |
| `player_ended`                                  | `episode_id`, `next_episode_id`         |
| `player_close`                                  | `position_s`, `percent`                 |
| `player_error_transient` / `player_error_fatal` | `error_code`, `manifest_status`         |

### Paywall events

| Event                                                 | Key properties                     |
| ----------------------------------------------------- | ---------------------------------- |
| `paywall_shown`                                       | `drama_id`, `episode_id`, `reason` |
| `paywall_plan_selected`                               | `plan_id`                          |
| `paywall_continue_clicked`                            | `plan_id`                          |
| `paywall_checkout_opened` / `paywall_checkout_closed` | `provider`, `outcome`              |
| `paywall_unlocking` / `paywall_unlocked`              | `episode_id`                       |
| `paywall_failure`                                     | `error_code`, `plan_id`            |
| `paywall_restore_clicked` / `paywall_restore_result`  | `outcome`                          |

### Admin events

| Event                        | Key properties                                                 |
| ---------------------------- | -------------------------------------------------------------- |
| `admin_drama_create_started` | none                                                           |
| `admin_drama_saved`          | `drama_id`, `status`, `episode_count`, `had_validation_errors` |
| `admin_drama_published`      | `drama_id`, `episode_count`                                    |
| `admin_episode_added`        | `drama_id`, `episode_id`                                       |
| `admin_episode_ingest_retry` | `episode_id`                                                   |
| `admin_optimistic_lock_hit`  | `drama_id`                                                     |

Quality bars:

- `player_error_fatal / player_open <= 0.5%`.
- `paywall_failure / paywall_continue_clicked <= 3%`.
- `player_buffer.duration_ms` p75 <= 1500ms after first frame.

---

## 10. Final acceptance criteria

### Browse/Home

- AC-B1: Anonymous users see hero, trending, and new rows; Continue Watching is not rendered.
- AC-B2: Signed-in users with progress see Continue Watching above editorial rows.
- AC-B3: Row failure displays a retry banner without hiding other rows.
- AC-B4: Skeletons appear only after 400ms and preserve final card aspect ratios.
- AC-B5: 18+ posters are blurred until age confirmation.

### Drama detail

- AC-D1: Episodes render by stored order ascending; gaps are preserved and never renumbered.
- AC-D2: Locked episodes display lock icon and text/tooltip before opening player paywall.
- AC-D3: Save by anonymous users opens sign-in sheet and returns to the same detail page after success.
- AC-D4: Synopsis truncation toggles without scroll jump.
- AC-D5: No-episode dramas show Episodes coming soon and disable the play CTA.

### Player

- AC-P1: Player never autoplays with sound on first mount.
- AC-P2: Gesture-required state is visually distinct from loading/buffering.
- AC-P3: Captions toggle is always top-level while controls are visible.
- AC-P4: Up-next auto-advance appears after episode end with a 5s cancel window.
- AC-P5: Playback progress persists at 10s heartbeat and on close.
- AC-P6: Fatal retry resumes from last known position when possible.
- AC-P7: iOS native fullscreen does not break core lifecycle/progress telemetry.

### Paywall

- AC-PW1: Paywall renders inside the player shell, not as a standalone full-page route.
- AC-PW2: Checkout return triggers entitlement recheck before playback resumes.
- AC-PW3: Failed payment preserves plan selection and shows retry.
- AC-PW4: Anonymous locked users see an auth-required paywall variant and return to the same locked episode after sign-in.
- AC-PW5: Dismiss/back returns to drama detail.

### Admin

- AC-A1: Editor role can create/edit dramas and episodes; non-editors see `/403`.
- AC-A2: Publish is disabled until at least one episode is ready.
- AC-A3: Admin exposes all drama status values with labels.
- AC-A4: Sparse episode order is preserved in list and edit flows.
- AC-A5: Concurrent edit conflict shows an optimistic-lock modal with Reload as default.
- AC-A6: Save errors retain local edits and offer retry.

### Cross-cutting

- AC-X1: Every state in the consolidated state matrix is represented in the visual catalog/storybook equivalent.
- AC-X2: Lighthouse accessibility score is >=95 on Home, Detail, and Player.
- AC-X3: User-facing strings have English and Chinese resource entries; no hard-coded strings in components.
- AC-X4: Analytics events in section 9 fire in a debug/dev environment with documented properties.

---

## 11. GitHub issue breakdown

Epic: DRAMA-009 Short-Drama MVP UX and wireframes.

### Foundations

- U-001: Design tokens and breakpoint audit. Labels: `area:ux`, `foundation`.
- U-002: Route map scaffolding and role guard placeholders. Labels: `area:fe`, `foundation`.
- U-003: English and Chinese string catalog scaffold. Labels: `area:ux`, `i18n`.

### Browse/Home

- U-010: Home layout shell with top bar and bottom tabs. Labels: `area:fe`.
- U-011: Poster and thumbnail card components with states. Labels: `area:fe`, `area:ux`.
- U-012: Continue Watching row. Labels: `area:fe`.
- U-013: Trending and New rows. Labels: `area:fe`.
- U-014: Search affordance and empty query states. Labels: `area:fe`.
- U-015: Home empty/error/offline banners. Labels: `area:fe`, `state-matrix`.

### Drama detail

- U-020: Detail hero, metadata, CTA. Labels: `area:fe`.
- U-021: Episode chip group with sparse order and locked indicators. Labels: `area:fe`, `data-model`.
- U-022: Synopsis, cast, and related rails. Labels: `area:fe`.
- U-023: Shared age-gate modal. Labels: `area:a11y`, `compliance`.

### Player

- U-030: Player shell and lifecycle states. Labels: `area:player`.
- U-031: Controls: play, scrub, captions, quality, fullscreen. Labels: `area:player`, `area:a11y`.
- U-032: Gesture-required autoplay policy state. Labels: `area:player`.
- U-033: iOS native fullscreen telemetry bridge. Labels: `area:player`, `browser`.
- U-034: Up-next card and auto-advance. Labels: `area:player`.
- U-035: Player transient and fatal error states. Labels: `area:player`, `state-matrix`.
- U-036: Resume and progress heartbeat UX. Labels: `area:player`.
- U-037: Captions defaults and persistence. Labels: `area:a11y`, `area:player`.

### Paywall

- U-040: Paywall card inside player shell. Labels: `area:paywall`.
- U-041: Plan selection and checkout transition. Labels: `area:paywall`.
- U-042: Unlocking state and entitlement recheck after checkout. Labels: `area:paywall`, `payments`.
- U-043: Auth-required paywall variant. Labels: `area:paywall`, `auth`.
- U-044: Restore purchase/subscription UX. Labels: `area:paywall`.
- U-045: Payment failure, retry, and preserved selection. Labels: `area:paywall`, `state-matrix`.

### Library and account

- U-050: Library shell with Continue Watching and Saved tabs. Labels: `area:fe`.
- U-051: Account subscription summary. Labels: `area:fe`, `payments`.

### Admin

- U-060: Admin shell and editor role guard. Labels: `area:admin`.
- U-061: Drama list and create flow. Labels: `area:admin`.
- U-062: Drama edit Metadata tab. Labels: `area:admin`.
- U-063: Drama edit Episodes tab with sparse order and ingest status. Labels: `area:admin`, `data-model`.
- U-064: Publish tab and status semantics. Labels: `area:admin`.
- U-065: Optimistic-lock modal. Labels: `area:admin`, `state-matrix`.
- U-066: Jobs read-only list. Labels: `area:admin`.

### Accessibility, analytics, QA

- U-070: Keyboard map for player and episode chips. Labels: `area:a11y`.
- U-071: Screen-reader labels and live regions. Labels: `area:a11y`.
- U-072: Reduced-motion and contrast pass. Labels: `area:a11y`.
- U-080: Analytics event contract and debug panel. Labels: `area:analytics`.
- U-081: Player lifecycle analytics coverage. Labels: `area:analytics`, `area:player`.
- U-082: Paywall and admin analytics coverage. Labels: `area:analytics`.
- U-090: Visual catalog for state matrix. Labels: `area:ux`, `state-matrix`.
- U-091: Cross-browser smoke pass. Labels: `area:player`, `qa`.
- U-092: Final acceptance pass against this spec. Labels: `qa`, `acceptance`.

---

## 12. Hermes Kanban task graph

```text
Layer 0: Foundations
  U-001   U-002   U-003
     \      |      /
      v     v     v
Layer 1: Browse and detail shell
  U-010 -> U-011 -> U-012 -> U-013 -> U-014 -> U-015
             |
             v
  U-020 -> U-021 -> U-022
             |
             v
           U-023

Layer 2: Player core
  U-030 -> U-031 -> U-032 -> U-033
     |        |        |
     |        |        v
     |        |      U-037
     |        v
     |      U-034
     v
  U-035 -> U-036

Layer 3: Paywall
  U-030 + U-035 -> U-040 -> U-041 -> U-042
                              |        |        |
                              v        v        v
                            U-043    U-044    U-045

Layer 4: Library and account
  U-012 + U-021 -> U-050 -> U-051

Layer 5: Admin
  U-002 -> U-060 -> U-061 -> U-062 -> U-063 -> U-064
                                      |        |
                                      v        v
                                    U-065    U-066

Layer 6: Cross-cutting
  All feature layers -> U-070 -> U-071 -> U-072
  Player/paywall/admin -> U-080 -> U-081 -> U-082

Layer 7: Verification
  U-090 -> U-091 -> U-092
```

Critical path:

`U-001 -> U-002 -> U-010 -> U-011 -> U-020 -> U-021 -> U-030 -> U-031 -> U-040 -> U-042 -> U-090 -> U-091 -> U-092`

Parallelizable tracks:

- Admin: U-060 through U-066 after U-002.
- A11y: U-070 through U-072 as each component stabilizes.
- Analytics: U-080 early, U-081/U-082 after player/paywall/admin surfaces land.

---

## 13. PR sequence and human gates

| PR  | Scope                              | Issues                            | Required human gate                                                                             |
| --- | ---------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Foundations                        | U-001, U-002, U-003               | Design lead approves tokens and breakpoints.                                                    |
| 2   | Home shell and cards               | U-010, U-011                      | A11y reviewer approves card focus states.                                                       |
| 3   | Home rows and states               | U-012, U-013, U-014, U-015        | Product approves signed-out vs signed-in row behavior.                                          |
| 4   | Drama detail                       | U-020, U-021, U-022, U-023        | Product approves sparse episode order and age-gate UX.                                          |
| 5   | Player shell and controls          | U-030, U-031, U-037               | Frontend lead approves cross-browser player approach.                                           |
| 6   | Player edge states                 | U-032, U-033, U-034, U-035, U-036 | Data + frontend verify lifecycle/progress telemetry.                                            |
| 7   | Core paywall                       | U-040, U-041, U-042               | Payments lead approves entitlement recheck; legal/compliance approves subscription disclosures. |
| 8   | Paywall variants                   | U-043, U-044, U-045               | Payments/support approve restore and failure messaging.                                         |
| 9   | Library/account                    | U-050, U-051                      | Product approves account subscription summary.                                                  |
| 10  | Admin shell and metadata           | U-060, U-061, U-062               | Editorial/ops walkthrough approves create/edit flow.                                            |
| 11  | Admin episodes, publish, jobs      | U-063, U-064, U-065, U-066        | Editorial/ops approves publish constraints and job visibility.                                  |
| 12  | Accessibility sweep                | U-070, U-071, U-072               | WCAG 2.2 AA audit pass.                                                                         |
| 13  | Analytics coverage                 | U-080, U-081, U-082               | Data team approves schema and quality bars.                                                     |
| 14  | Visual catalog                     | U-090                             | Design and engineering approve state matrix coverage.                                           |
| 15  | Cross-browser and final acceptance | U-091, U-092                      | Product, design, engineering, a11y, data sign final release readiness.                          |

Roadmap/data-model/merge gates:

- Roadmap gate: before PR 1, product confirms deferred scope remains out of MVP.
- Data-model gate: before PR 4 and PR 11, engineering confirms episode order/status assumptions match the data-model ADR.
- Payments gate: before PR 7 merge, payments owner confirms entitlement and checkout-return semantics.
- Merge gate: each PR requires CI plus design/product acceptance for its area; PR 15 requires final multi-stakeholder sign-off.

Rollout recommendation:

- Public surfaces behind feature flag `shortdrama_mvp`, initially off in production.
- Admin behind feature flag `shortdrama_admin`, initially internal-only.
- Rollout: internal -> 5% -> 25% -> 100%, gated by player fatal error and paywall failure quality bars.
- Rollback: disable `shortdrama_mvp`; keep admin available for content preparation unless admin defects affect data integrity.

---

## 14. Open questions

These do not block spec approval but should be answered before implementation completes.

1. Should episode 1 always be free, or is free/locked entirely data-driven per episode?
2. Should anonymous Save use local storage or remain signed-in only?
3. Should age-gate confirmation persist server-side for signed-in users or remain per session?
4. Should caption style customization be included in MVP or deferred?
5. Should admin support manifest URL paste in MVP, or only episode-by-episode entry?
