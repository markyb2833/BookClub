-- AlterTable
ALTER TABLE "shelves" ADD COLUMN     "scene_tier_count" INTEGER NOT NULL DEFAULT 2;

-- Preserve ~old 3-plank layout for existing shelves; new shelves keep default 2
UPDATE "shelves" SET "scene_tier_count" = 3;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "library_wall_cols" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "library_wall_rows" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "library_wall_slots" JSONB;
