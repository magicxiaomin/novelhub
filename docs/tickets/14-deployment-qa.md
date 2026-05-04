# Ticket 14: Production Deployment and QA

## Goal
Deploy to production and complete pre-launch checklist.

## Tasks
1. Deployment:
   - Frontend: Vercel project, connect repo, set env vars
   - Backend: Railway or Render, Dockerfile, env vars
   - Database: Supabase production project
   - Redis: Upstash or Railway addon
   - R2: production bucket with public read for covers, private for chapters
   - Cloudflare: DNS, SSL, page rules
2. CI/CD:
   - GitHub Actions: lint, typecheck, test on PR
   - Auto-deploy main → production for both apps
   - Migration step in deployment (Prisma migrate deploy)
3. Monitoring:
   - Sentry for both frontend and backend, source maps uploaded
   - Vercel Analytics enabled
   - Uptime monitoring (UptimeRobot or BetterStack)
   - Slack/Discord webhook for critical errors
4. Pre-launch QA checklist (run through manually):
   - [ ] Register new account, get welcome email
   - [ ] Login with email and Google
   - [ ] Browse home, all categories
   - [ ] Open book detail, view chapter list
   - [ ] Read first 3 free chapters as guest
   - [ ] Hit paywall on chapter 4
   - [ ] Sign up from paywall, redirected back
   - [ ] Buy coin package, verify coins added
   - [ ] Unlock chapter with coins
   - [ ] Subscribe weekly, verify unlimited access
   - [ ] Cancel subscription via portal, verify access until period end
   - [ ] Check FB Events Manager, all events firing with dedup
   - [ ] Test push notification subscribe and receive
   - [ ] Install PWA on iOS and Android
   - [ ] Lighthouse mobile: Performance > 85, PWA > 90, Accessibility > 90
   - [ ] All legal pages accessible
   - [ ] Cookie consent works
   - [ ] Admin panel functional
5. Production data setup:
   - Upload 15 books with full chapter sets
   - Create Stripe products in live mode
   - Configure Stripe webhook endpoint with live signing secret
   - Verify domain in Meta Business Manager
   - Configure aggregated event measurement (priority order)
6. Documentation:
   - `docs/runbook.md`: how to deploy, rollback, common issues
   - `docs/admin-guide.md`: how to add books, manage users
   - `docs/architecture.md`: high-level system diagram

## Acceptance Criteria
- All 24 QA items pass
- Site loads at production URL with valid SSL
- Stripe live test purchase works (refund after)
- FB Pixel verified active in Meta Business Manager
- Sentry receives test errors from both apps
- Backup strategy documented (Supabase auto-backups enabled)

## Out of Scope
- Load testing (do later when scaling)
- Multi-region deployment
- DR plan
