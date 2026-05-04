# Ticket 13: Legal Pages and Admin Panel

## Goal
Add all required legal pages and a basic admin panel.

## Tasks
1. Static legal pages (use MDX or markdown):
   - `/privacy` - Privacy Policy
   - `/terms` - Terms of Service
   - `/refund` - Refund Policy
   - `/dmca` - DMCA Policy with takedown email
   - `/contact` - Contact Us with form (sends to support email via Resend)
   - `/about` - simple about page
   - Use placeholder text marked `<!-- TODO: legal review -->` - do NOT generate actual legal text, leave for human review
2. Cookie consent banner:
   - Bottom banner: "We use cookies..." with Accept / Reject / Customize
   - Customize modal: toggle Analytics, Marketing (Necessary always on)
   - Persist choice for 365 days
   - Block FB Pixel and OneSignal until accepted
3. Admin panel at `/admin`:
   - Auth gate: only `isAdmin` users
   - Sidebar nav: Dashboard, Books, Chapters, Users, Orders, Push
   - Dashboard:
     - Today: signups, paying users, revenue, ROAS estimate
     - 7-day chart of registrations and revenue
     - Top selling books
   - Books CRUD: list, create, edit, soft delete, upload cover
   - Chapter management: bulk import (.txt or .docx), reorder, edit
   - Users: search, view detail (purchases, unlocks, ban)
   - Orders: searchable list, filter by status
   - Push: compose and send broadcast (with confirmation)
4. Use shadcn/ui Data Table for lists (with sort, filter, pagination)
5. File upload for covers and bulk chapter import via R2 presigned URLs

## Acceptance Criteria
- All footer links resolve to valid pages
- Cookie banner blocks tracking before consent
- Admin panel works on desktop (mobile not required)
- Bulk chapter import handles 100+ chapters in one .txt file
- Non-admin users get 404 on /admin routes (do not 403, do not reveal existence)

## Out of Scope
- Content scheduling
- Multi-admin roles
- Audit log (V2)
