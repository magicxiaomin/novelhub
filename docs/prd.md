# NovelHub PRD - MVP v1.0

## 0. Document Info

- **Project**: NovelHub
- **Goal**: Build a mobile-first English novel PWA, validated via Facebook Ads
- **Version**: MVP v1.0
- **Estimated dev time**: 4–6 weeks
- **Target market**: North America (en-US), expand later to Philippines, UK

## 1. Product Positioning

**One-liner**: Mobile-first English web novel PWA. Users land from FB ads, read free chapters, then unlock more via subscription or coin purchases.

**Core user journey**:
```
FB Ad → Landing (book detail or chapter 1) → Read 1–5 free chapters
→ Paywall → Register/Login → Subscribe or buy coins → Continue → Push retention
```

**Core business KPIs**:
- Landing → register: ≥30%
- Register → first purchase: ≥5%
- First purchase ARPU: ≥$15
- D7 ROAS: ≥0.8

## 2. Tech Stack

See `AGENTS.md` for the canonical tech stack and standards. Summary:

- Frontend: Next.js 14 App Router + TS + Tailwind + shadcn/ui
- Backend: NestJS + Prisma + PostgreSQL + Redis
- Storage: Cloudflare R2 for chapter content
- Payment: Stripe
- Tracking: FB Pixel + Conversions API
- Push: OneSignal
- Deployment: Vercel + Railway + Supabase

## 3. User Roles

- **Guest**: not registered, can read free chapters; progress in localStorage
- **Free user**: registered, no purchase; can read free chapters + signup bonus coins
- **Coin user**: has purchased coins; unlocks per chapter
- **Subscriber**: weekly/monthly subscription; reads everything

## 4. Modules

### 4.1 Content
- **Book**: id, title, author, cover, description, category, tags, total_chapters, status, is_featured, free_chapter_count, coin_per_chapter
- **Chapter**: id, book_id, chapter_number, title, content_url (R2), word_count, is_free, published_at
- **Reading progress**: user_id|guest_id, book_id, chapter_id, scroll_position, last_read_at

### 4.2 Pages
- `/` Home: featured carousel, continue reading, trending, new releases, by category
- `/book/[id]` Book detail (FB ad landing): cover, info, description, chapter list, "Start Reading" CTA
- `/read/[bookId]/[chapterNumber]` Reader: settings, progress save, paywall
- `/auth` Login/register modal (not full page)
- `/me` Account: balance, subscription, history, settings
- `/recharge` Coin purchase
- `/category/[slug]` Category browse
- `/search` Keyword search
- `/privacy` `/terms` `/refund` `/dmca` `/contact` Compliance pages

### 4.3 Paywall
**Trigger**:
- Guest finishes free chapters and clicks next
- Registered user has insufficient coins

**Format**: full-screen modal, cannot be dismissed (only via small "Maybe Later")

**Tabs**:
- **Subscribe** (default): Weekly $12.99 ("Most Popular"), Monthly $29.99 ("Best Value"), benefits list, "Subscribe Now"
- **Coins**: $4.99/50, $9.99/120 (+20%), $19.99/260 (+30%), $49.99/700 (+40%), "Buy Coins"

### 4.4 User System
- Email + password (≥8 chars)
- Google OAuth
- Auto-login on register; 20 coin signup bonus; welcome email
- JWT (24h) + Refresh Token (30d)
- Guest → user merge: guest_id cookie progress migrates after login

### 4.5 Payment
- Stripe Checkout (subscriptions + one-time coin packages)
- Webhook events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`, `charge.refunded`
- Idempotent webhook processing
- Manual refunds via Stripe dashboard for MVP

### 4.6 Daily Check-in
- 5 / 5 / 5 / 10 / 10 / 10 / 30 coins on days 1–7 (then resets)
- Missing a day resets streak

### 4.7 Push (OneSignal)
- 24h after last read, no return → "Continue [Book]"
- 3 days before subscription renewal → reminder
- Permission grant → +10 coins (server-validated, one-time)

### 4.8 Tracking
**Events**: PageView, ViewContent, AddToCart, InitiateCheckout, CompleteRegistration, Purchase, Subscribe

**Implementation**:
- Frontend Pixel + backend CAPI dual-fired
- Same `event_id` for dedup
- Domain verification + 8-event aggregated measurement priority

### 4.9 PWA
- manifest.json with all icon sizes
- Service Worker: static cache, last-5-chapters offline
- Add-to-Home-Screen prompt (Android auto, iOS custom modal)

## 5. Non-functional Requirements
- Mobile LCP < 2.5s on 4G
- Chapter switch < 500ms
- iOS Safari 14+, Android Chrome 90+ priority
- HTTPS only; bcrypt; Stripe webhook signing; signed chapter URLs
- English only for MVP (i18n-ready files)

## 6. Out of Scope (V2+)
Comments, reviews, ratings, bookshelf/favorites (use recent reading), multi-language, automated refund, invite friends, ad-rewarded unlock, reading stats/levels, native apps, dunning campaigns, marketing automation backend, multi-device progress sync.

## 7. Acceptance
- All 14 ticket acceptance criteria met
- 5 successful end-to-end purchase tests on Stripe live mode (with refunds after)
- FB Events Manager shows all events with proper dedup
- Lighthouse PWA ≥ 90, mobile performance ≥ 85
- Mobile LCP < 3s
- All compliance pages accessible

## 8. Initial Content
- 15 completed novels minimum
- ~200 chapters each
- Categories: 8 Werewolf + 5 Billionaire/CEO + 2 other
- All with covers, descriptions, categories, tags
- First 3 chapters of each free
