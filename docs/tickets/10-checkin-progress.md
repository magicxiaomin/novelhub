# Ticket 10: Check-in System and Reading Progress

## Goal
Implement daily check-in for retention and reading progress sync.

## Tasks
1. Check-in API:
   - `GET /checkin/status` - today's status, streak, next reward
   - `POST /checkin` - claim today's reward
2. Check-in rewards:
   - Day 1: 5 coins
   - Day 2: 5 coins
   - Day 3: 5 coins
   - Day 4-6: 10 coins
   - Day 7: 30 coins (then resets)
   - Missing a day resets streak
3. Reading progress API:
   - `POST /progress` - upsert `{ bookId, chapterId, scrollPosition }`
   - `GET /progress` - list user's reading progress (paginated)
   - `GET /progress/:bookId` - get progress for specific book
4. Frontend:
   - Check-in card on home page (top, dismissible after claim)
   - Streak visualization (7 dots, current highlighted)
   - Toast on successful claim with coin animation
   - "Continue Reading" home section uses progress API
   - Reader page calls progress upsert every 5s (debounced)

## Acceptance Criteria
- Check-in cannot be claimed twice in same day (server time)
- Streak correctly resets after missing a day
- Reading progress correctly resumes user to last position
- Check-in works in user's timezone (use UTC for MVP, document this)

## Out of Scope
- Customizable streak rewards
- Achievements/badges
