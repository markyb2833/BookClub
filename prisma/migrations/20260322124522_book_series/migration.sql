-- CreateTable
CREATE TABLE "book_series" (
    "id" TEXT NOT NULL,
    "open_library_id" VARCHAR(24) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_series" (
    "work_id" TEXT NOT NULL,
    "series_id" TEXT NOT NULL,
    "position" VARCHAR(32),

    CONSTRAINT "work_series_pkey" PRIMARY KEY ("work_id","series_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "book_series_open_library_id_key" ON "book_series"("open_library_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_series_slug_key" ON "book_series"("slug");

-- AddForeignKey
ALTER TABLE "work_series" ADD CONSTRAINT "work_series_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_series" ADD CONSTRAINT "work_series_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "book_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
