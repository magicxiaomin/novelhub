-- CreateTable
CREATE TABLE "dramas" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "poster_url" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "total_episodes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "free_episode_count" INTEGER NOT NULL DEFAULT 3,
    "coin_per_episode" INTEGER NOT NULL DEFAULT 5,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "dramas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" UUID NOT NULL,
    "drama_id" UUID NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "synopsis" TEXT,
    "duration_seconds" INTEGER,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_assets" (
    "id" UUID NOT NULL,
    "episode_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'external_hls',
    "playback_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "duration_seconds" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episode_unlocks" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "guest_id" TEXT,
    "episode_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "episode_unlocks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "episode_unlocks_actor_xor_chk" CHECK ((("user_id" IS NOT NULL)::int + ("guest_id" IS NOT NULL)::int) = 1)
);

-- CreateTable
CREATE TABLE "watch_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "guest_id" TEXT,
    "drama_id" UUID NOT NULL,
    "episode_id" UUID NOT NULL,
    "position_seconds" INTEGER NOT NULL DEFAULT 0,
    "duration_seconds" INTEGER,
    "completed_at" TIMESTAMP(3),
    "last_watched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "watch_progress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "watch_progress_actor_xor_chk" CHECK ((("user_id" IS NOT NULL)::int + ("guest_id" IS NOT NULL)::int) = 1)
);

-- CreateIndex
CREATE UNIQUE INDEX "dramas_slug_key" ON "dramas"("slug");
CREATE INDEX "dramas_status_is_featured_sort_order_idx" ON "dramas"("status", "is_featured", "sort_order");
CREATE INDEX "dramas_category_idx" ON "dramas"("category");
CREATE INDEX "dramas_published_at_idx" ON "dramas"("published_at");

CREATE UNIQUE INDEX "episodes_drama_id_episode_number_key" ON "episodes"("drama_id", "episode_number");
CREATE INDEX "episodes_drama_id_idx" ON "episodes"("drama_id");
CREATE INDEX "episodes_drama_id_episode_number_idx" ON "episodes"("drama_id", "episode_number");
CREATE INDEX "episodes_is_published_published_at_idx" ON "episodes"("is_published", "published_at");

CREATE UNIQUE INDEX "video_assets_episode_id_key" ON "video_assets"("episode_id");
CREATE INDEX "video_assets_provider_idx" ON "video_assets"("provider");

CREATE INDEX "episode_unlocks_user_id_idx" ON "episode_unlocks"("user_id");
CREATE INDEX "episode_unlocks_guest_id_idx" ON "episode_unlocks"("guest_id");
CREATE INDEX "episode_unlocks_episode_id_idx" ON "episode_unlocks"("episode_id");
CREATE UNIQUE INDEX "episode_unlocks_user_id_episode_id_key" ON "episode_unlocks"("user_id", "episode_id") WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "episode_unlocks_guest_id_episode_id_key" ON "episode_unlocks"("guest_id", "episode_id") WHERE "guest_id" IS NOT NULL;

CREATE INDEX "watch_progress_user_id_last_watched_at_idx" ON "watch_progress"("user_id", "last_watched_at");
CREATE INDEX "watch_progress_guest_id_last_watched_at_idx" ON "watch_progress"("guest_id", "last_watched_at");
CREATE INDEX "watch_progress_drama_id_idx" ON "watch_progress"("drama_id");
CREATE INDEX "watch_progress_episode_id_idx" ON "watch_progress"("episode_id");
CREATE UNIQUE INDEX "watch_progress_user_id_episode_id_key" ON "watch_progress"("user_id", "episode_id") WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "watch_progress_guest_id_episode_id_key" ON "watch_progress"("guest_id", "episode_id") WHERE "guest_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_drama_id_fkey" FOREIGN KEY ("drama_id") REFERENCES "dramas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "episode_unlocks" ADD CONSTRAINT "episode_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "episode_unlocks" ADD CONSTRAINT "episode_unlocks_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_drama_id_fkey" FOREIGN KEY ("drama_id") REFERENCES "dramas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
