# Ticket 04: Books and Chapters API

## Goal
Public read APIs for books and chapters, plus admin CRUD.

## Tasks
1. Create `books` module with endpoints:
   - `GET /books` - list with filters (category, status, featured, page, limit)
   - `GET /books/:id` - book detail with first 10 chapters
   - `GET /books/:id/chapters` - paginated chapter list
   - `GET /books/featured` - homepage banner books
   - `GET /books/trending` - trending books (sort by created desc for MVP)
   - `GET /books/categories` - list of categories with counts
   - `GET /books/search?q=` - search by title/author (PG full-text)
2. Create `chapters` module:
   - `GET /chapters/:id` - chapter content (with auth check, returns paywall flag if locked)
3. Admin endpoints (require `isAdmin` user):
   - `POST /admin/books` - create book
   - `PUT /admin/books/:id` - update
   - `DELETE /admin/books/:id` - soft delete
   - `POST /admin/books/:id/chapters` - bulk import chapters (accept .txt/.docx upload)
   - `PUT /admin/chapters/:id` - update chapter
   - `DELETE /admin/chapters/:id` - soft delete
4. Chapter content storage:
   - Upload to R2 with key `chapters/{bookId}/{chapterId}.txt`
   - Return signed URL valid for 1 hour on read
5. Implement chapter access logic per AGENTS.md "Chapter Unlock Logic"
6. Cache book lists in Redis (5min TTL)
7. Add Swagger docs and tests

## Chapter Access Response Shape
```typescript
// Locked
{
  id: string,
  bookId: string,
  chapterNumber: number,
  title: string,
  isLocked: true,
  preview: string, // first 100 chars
  unlockOptions: {
    coinCost: number,
    canUnlockWithCoins: boolean, // user has enough
    canUnlockWithSubscription: boolean
  }
}

// Unlocked
{
  id, bookId, chapterNumber, title,
  isLocked: false,
  contentUrl: string, // signed R2 URL
  wordCount: number,
  prevChapterId: string | null,
  nextChapterId: string | null
}
```

## Acceptance Criteria
- All endpoints documented in Swagger
- Locked chapters return preview + unlock options
- Free chapters readable by guests
- Admin endpoints reject non-admin users with 403
- Bulk chapter import parses .txt files split by `\n\n---\n\n` as chapter delimiter
- Tests cover access control matrix (guest/user/subscriber × free/paid chapter)

## Out of Scope
- Frontend rendering
- Recommendations algorithm
- Reviews/ratings
