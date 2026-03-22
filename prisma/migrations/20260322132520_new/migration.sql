-- No-op: the original SQL referenced reading_sessions.updated_at before that column existed.
-- Column `updated_at` is added in migration 20260323120000_reading_sessions_extended.
-- @updatedAt in Prisma is compatible with that ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP.
SELECT 1;
