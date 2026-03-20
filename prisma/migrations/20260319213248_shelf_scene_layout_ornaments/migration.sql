-- AlterTable
ALTER TABLE "shelf_books" ADD COLUMN     "layout_x_pct" DOUBLE PRECISION NOT NULL DEFAULT 50,
ADD COLUMN     "layout_y_pct" DOUBLE PRECISION NOT NULL DEFAULT 18,
ADD COLUMN     "layout_z" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "shelves" ADD COLUMN     "lighting_preset" VARCHAR(24);

-- CreateTable
CREATE TABLE "shelf_ornaments" (
    "id" TEXT NOT NULL,
    "shelf_id" TEXT NOT NULL,
    "glyph" VARCHAR(32) NOT NULL,
    "x_pct" DOUBLE PRECISION NOT NULL,
    "y_pct" DOUBLE PRECISION NOT NULL,
    "z_index" INTEGER NOT NULL DEFAULT 28,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shelf_ornaments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "shelf_ornaments" ADD CONSTRAINT "shelf_ornaments_shelf_id_fkey" FOREIGN KEY ("shelf_id") REFERENCES "shelves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Spread existing books across the scene (was single default position)
WITH ranked AS (
  SELECT id, shelf_id,
         ROW_NUMBER() OVER (PARTITION BY shelf_id ORDER BY sort_order ASC, added_at ASC) - 1 AS rn,
         COUNT(*) OVER (PARTITION BY shelf_id) AS cnt
  FROM shelf_books
)
UPDATE shelf_books sb
SET
  layout_x_pct = CASE WHEN r.cnt <= 1 THEN 50.0
    ELSE 6.0 + (r.rn::float / GREATEST(r.cnt - 1, 1)) * 88.0 END,
  layout_y_pct = 16.0 + LEAST(FLOOR(r.rn / 12.0), 2) * 26.0,
  layout_z = 5
FROM ranked r
WHERE sb.id = r.id;
