# Ticket 02: Database Schema with Prisma

## Goal
Define the complete Prisma schema for MVP and run initial migration.

## Tasks
1. In `packages/db`, set up Prisma with PostgreSQL provider
2. Define models per the spec below
3. Add appropriate indexes
4. Generate initial migration
5. Add seed script with sample data (3 books, 30 chapters, 1 admin user)
6. Export Prisma Client from package for use in `apps/api`

## Schema Spec

```prisma
model User {
  id              String   @id @default(uuid())
  email           String   @unique
  passwordHash    String?
  googleId        String?  @unique
  coinBalance     Int      @default(0)
  emailVerified   Boolean  @default(false)
  isAdmin         Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  subscriptions   Subscription[]
  unlocks         ChapterUnlock[]
  progress        ReadingProgress[]
  coinTxns        CoinTransaction[]
  orders          Order[]
  checkins        DailyCheckin[]
}

model Book {
  id                String   @id @default(uuid())
  title             String
  author            String
  coverUrl          String
  description       String   @db.Text
  category          String   // ROMANCE, WEREWOLF, FANTASY, BILLIONAIRE, MYSTERY
  tags              String[]
  totalChapters     Int      @default(0)
  status            String   @default("ONGOING") // ONGOING, COMPLETED
  isFeatured        Boolean  @default(false)
  freeChapterCount  Int      @default(3)
  coinPerChapter    Int      @default(5)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  chapters          Chapter[]

  @@index([category])
  @@index([isFeatured])
}

model Chapter {
  id            String   @id @default(uuid())
  bookId        String
  chapterNumber Int
  title         String
  contentUrl    String   // R2 signed URL key
  wordCount     Int
  isFree        Boolean  @default(false)
  publishedAt   DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  book          Book     @relation(fields: [bookId], references: [id])
  unlocks       ChapterUnlock[]

  @@unique([bookId, chapterNumber])
  @@index([bookId])
}

model ReadingProgress {
  id              String   @id @default(uuid())
  userId          String?
  guestId         String?
  bookId          String
  chapterId       String
  scrollPosition  Int      @default(0)
  lastReadAt      DateTime @default(now())

  user            User?    @relation(fields: [userId], references: [id])

  @@unique([userId, bookId])
  @@unique([guestId, bookId])
  @@index([userId])
  @@index([guestId])
}

model ChapterUnlock {
  id           String   @id @default(uuid())
  userId       String
  chapterId    String
  method       String   // COIN, SUBSCRIPTION, FREE, ADMIN
  unlockedAt   DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id])
  chapter      Chapter  @relation(fields: [chapterId], references: [id])

  @@unique([userId, chapterId])
  @@index([userId])
}

model CoinTransaction {
  id          String   @id @default(uuid())
  userId      String
  amount      Int      // positive = earn, negative = spend
  type        String   // PURCHASE, UNLOCK, CHECKIN, SIGNUP_BONUS, ADMIN, REFUND
  relatedId   String?  // order_id, chapter_id, etc.
  balanceAfter Int
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([createdAt])
}

model Subscription {
  id                    String   @id @default(uuid())
  userId                String
  stripeSubscriptionId  String   @unique
  stripeCustomerId      String
  stripePriceId         String
  status                String   // active, past_due, canceled, expired
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean  @default(false)
  canceledAt            DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  user                  User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([status])
}

model Order {
  id                String   @id @default(uuid())
  userId            String
  stripeSessionId   String   @unique
  stripePaymentIntent String? @unique
  type              String   // COIN_PURCHASE, SUBSCRIPTION
  amount            Int      // in cents
  currency          String   @default("usd")
  coinsGranted      Int?
  status            String   // pending, completed, failed, refunded
  metadata          Json?
  createdAt         DateTime @default(now())
  completedAt       DateTime?

  user              User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([status])
}

model DailyCheckin {
  id           String   @id @default(uuid())
  userId       String
  checkinDate  DateTime @db.Date
  streakCount  Int
  coinsAwarded Int
  createdAt   DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id])

  @@unique([userId, checkinDate])
  @@index([userId])
}

model FbEvent {
  id          String   @id @default(uuid())
  eventName   String
  eventId     String
  userId      String?
  payload     Json
  responseCode Int?
  responseBody String?  @db.Text
  sentAt      DateTime @default(now())

  @@index([eventName])
  @@index([eventId])
}
```

## Acceptance Criteria
- `pnpm --filter db prisma:migrate dev` creates all tables
- `pnpm --filter db prisma:seed` populates sample data
- Prisma Client is importable from `@novelhub/db` in `apps/api`
- All foreign keys and indexes match spec

## Out of Scope
- Any API endpoints (next ticket)
- Soft delete middleware (V2)
