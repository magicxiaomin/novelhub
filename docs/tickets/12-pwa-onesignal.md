# Ticket 12: PWA and Push Notifications

## Goal
Make the site installable as PWA and integrate OneSignal Web Push.

## Tasks
1. PWA setup:
   - Configure `next-pwa` or manual SW
   - Create `manifest.json` with all icon sizes (192, 512, maskable variants)
   - Generate splash screens for iOS
   - Set up icons for all required sizes (use favicon.io or similar)
   - Theme color, background color, display=standalone
2. Service Worker:
   - Cache static assets (JS, CSS, fonts)
   - Network-first for API, cache-first for chapter content
   - Cache last 5 read chapters for offline access
3. Add to Home Screen prompt:
   - For Android Chrome: trigger `beforeinstallprompt` after user reads 2 chapters
   - For iOS Safari: show custom modal with screenshots showing how to add (since iOS doesn't support beforeinstallprompt)
   - Don't show again if user dismissed (cookie, 7 days)
4. OneSignal integration:
   - Add OneSignal SDK
   - Custom permission prompt (not native browser dialog) after user reads 3 chapters
   - Tag users with `user_id`, `subscription_status`, `last_book_id`
   - Reward 10 coins on permission grant (one-time, server-validated)
5. Backend push triggers:
   - Cron job: 24h after last read with no return → send "Continue [Book]" push
   - 3 days before subscription renewal → reminder
   - Manual broadcast endpoint: `POST /admin/push/broadcast`
6. Push payload includes deep link to specific chapter

## Acceptance Criteria
- Lighthouse PWA score ≥ 90
- "Add to Home Screen" prompt shows correctly on Android
- iOS install instructions shown to iOS Safari users
- OneSignal permission prompt works
- Test push from OneSignal dashboard delivers
- Cron triggers verified in staging

## Out of Scope
- iOS native push (requires App Store)
- Rich push (images)
- Push A/B testing
