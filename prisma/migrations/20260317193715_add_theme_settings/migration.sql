-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "accent_colour" TEXT NOT NULL DEFAULT '#8b5cf6',
ADD COLUMN     "text_colour" TEXT NOT NULL DEFAULT '#1c1917',
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'light';
