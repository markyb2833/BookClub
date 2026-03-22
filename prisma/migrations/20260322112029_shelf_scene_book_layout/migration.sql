-- AlterTable
ALTER TABLE "shelves" ADD COLUMN     "scene_book_display" VARCHAR(12) NOT NULL DEFAULT 'spine',
ADD COLUMN     "scene_book_height_mul" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "scene_book_width_mul" DOUBLE PRECISION NOT NULL DEFAULT 1;
