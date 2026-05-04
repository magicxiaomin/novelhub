# Ticket 08: Reader Page and Paywall

## Goal
Build the immersive reader experience and paywall modal.

## Tasks
1. Reader page (`/read/[bookId]/[chapterNumber]`):
   - Server-fetch chapter via API
   - If locked → render paywall, do not fetch content
   - If unlocked → fetch content from signed URL, render
   - Top bar (auto-hide on scroll down, show on scroll up): back, chapter title, settings icon
   - Bottom bar: prev chapter, chapter list drawer, settings, next chapter
   - Settings drawer: font size (S/M/L/XL), line height (3 levels), background (white/sepia/dark), font family
   - Persist settings to localStorage
   - Reading progress: save scroll % every 5 seconds (debounced) to backend if logged in
   - End of chapter: auto-show "Next Chapter" button, or auto-advance if user enabled
2. Chapter list drawer:
   - Slide from right, full height
   - Show all chapters, mark unlocked/locked
   - Current chapter highlighted
   - Tap to jump
3. Paywall modal:
   - Full screen, cannot be dismissed except via "Maybe Later" small text link
   - Top: locked chapter preview (first 100 chars, blur fade-out)
   - Tabs: "Subscribe" (default) | "Buy Coins"
   - Subscribe tab:
     - Two cards: Weekly $12.99 (selected by default), Monthly $29.99 ("Best Value" badge)
     - Benefits list: Unlimited reading / All books unlocked / Cancel anytime
     - Big "Subscribe Now" button
   - Coins tab:
     - 4 packages with bonus badges
     - Big "Buy Coins" button
   - Footer: tiny links to Terms, Privacy, Refund
4. On purchase click:
   - If not logged in → show login modal first
   - Call `/payments/checkout/...` → redirect to Stripe URL
5. Post-checkout:
   - Stripe redirects to `/payment/success?session_id=...`
   - Page polls `/orders/:sessionId/status` until completed
   - On success → redirect back to reader at the locked chapter
6. Reading sound/haptics: NONE (do not add)
7. Performance: virtualize long chapters? NO for MVP, just render full text

## UX Details
- Tap center of screen to toggle UI (top/bottom bars)
- Swipe left/right disabled (causes accidental nav)
- Pinch to zoom: disabled, use settings instead
- Long press to copy: allowed
- Text selection: allowed but no share menu

## Acceptance Criteria
- Reader works smoothly on iPhone SE, no jank
- Paywall blocks all non-text-preview interaction
- Settings persist across sessions
- Reading progress restored when returning to a chapter
- Lighthouse performance > 90 on reader page

## Out of Scope
- Audio reading (TTS)
- Bookmarks within chapter
- Comments
