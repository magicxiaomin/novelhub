# Ticket 09: Auth Modals, Account Page, Recharge Page

## Goal
Build auth UX (modals, not separate page for MVP) and account-related pages.

## Tasks
1. Auth modal component (used wherever login required):
   - Single modal, two tabs: Sign In / Sign Up
   - Email + Password form (react-hook-form + zod)
   - "Continue with Google" button (uses Google Identity Services)
   - "Forgot Password" link in Sign In tab
   - On success, close modal and continue user's pending action
2. Forgot password flow:
   - Modal "Reset Password" → enter email → success message
   - `/reset-password?token=...` page → new password form → success
3. Account page (`/me`):
   - User header: avatar (initials), email
   - Coin balance card with "Get More Coins" button (→ /recharge)
   - Subscription status card:
     - If active: plan, renews on date, "Manage Subscription" → Stripe Portal
     - If inactive: "Subscribe to unlock all books" → opens paywall modal
   - Reading history (last 10 books with progress)
   - Settings list: Notifications, Language (just English for now), Privacy, Terms, Contact, Logout, Delete Account
4. Recharge page (`/recharge`):
   - Current balance display
   - 4 coin packages with same UI as paywall
   - Tap → checkout → Stripe → return
   - Recent transactions list (last 20)
5. Delete account flow:
   - Confirmation modal with warning text
   - Type "DELETE" to confirm
   - Calls `DELETE /auth/account` → soft deletes user → logs out → redirects home

## Acceptance Criteria
- Auth modal works from any page that needs login
- Google Sign-In works in test environment
- Subscription management redirects to Stripe Portal
- Delete account requires explicit confirmation
- All forms have proper validation and error states

## Out of Scope
- Email verification
- Profile photo upload
- Password change (use forgot password flow)
