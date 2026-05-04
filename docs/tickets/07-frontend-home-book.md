# Ticket 07: Frontend Pages - Home and Book Detail

## Goal
Build the home page and book detail page with mobile-first design.

## Tasks
1. Set up `apps/web` with:
   - App Router structure
   - Tailwind config with custom theme (define brand colors)
   - shadcn/ui base components installed
   - React Query provider
   - Auth context (reads `/auth/me` on mount)
   - Toast notifications (sonner)
2. Layouts:
   - Root layout with `<html lang>`, viewport meta, theme color
   - Mobile bottom nav (Home / Library / Me) - shows only when logged in
   - Top header (logo + search icon + avatar/login)
3. Home page (`/`):
   - Featured carousel (Embla carousel)
   - "Continue Reading" section (if logged in and has progress)
   - "Trending" horizontal scroll
   - "New Releases" horizontal scroll
   - Per-category sections with "See All" link
4. Book detail page (`/book/[id]`):
   - Hero section: cover, title, author, category badge, status
   - Stats row: chapters, words, fake rating (4.7+ random)
   - Description (collapsible after 4 lines)
   - "Start Reading" button (full width, sticky bottom on mobile)
   - Chapter list (first 10, "View All" expand)
   - "You May Also Like" section
5. SEO:
   - Dynamic metadata for book pages (title, description, og:image)
   - JSON-LD Book schema
6. Loading states with Suspense + skeleton components
7. Error boundary at page level
8. All API calls via React Query, with proper cache keys

## Design Tokens
- Primary color: #FF4D4F (subject to change)
- Use Inter font (next/font)
- Mobile breakpoint priority: 375px reference

## Acceptance Criteria
- Lighthouse mobile performance > 85
- All sections render correctly with seed data
- Navigation between pages preserves scroll position appropriately
- Skeleton UI shows during loading, no layout shift
- Tested on iPhone SE viewport (375x667) and Pixel 5 (393x851)

## Out of Scope
- Reader page (next ticket)
- Auth modals
- Search functionality
