-- AlterTable: add nullable first so existing rows can be backfilled.
ALTER TABLE "QuizTheme" ADD COLUMN "order" INTEGER;

-- Backfill using Theme.createdAt as the historical ordering signal (it was
-- set in insertion order at quiz-creation/import time). themeId is a
-- tiebreaker for deterministic, gap-free ordering if two themes in the same
-- quiz share a createdAt timestamp.
WITH ranked AS (
  SELECT
    qt."quizId",
    qt."themeId",
    ROW_NUMBER() OVER (PARTITION BY qt."quizId" ORDER BY t."createdAt", qt."themeId") - 1 AS rn
  FROM "QuizTheme" qt
  JOIN "Theme" t ON t.id = qt."themeId"
)
UPDATE "QuizTheme" qt
SET "order" = ranked.rn
FROM ranked
WHERE qt."quizId" = ranked."quizId" AND qt."themeId" = ranked."themeId";

-- Now that every row has a value, make it required.
ALTER TABLE "QuizTheme" ALTER COLUMN "order" SET NOT NULL;

-- Non-unique index for ORDER BY perf (see schema.prisma comment on why not @@unique).
CREATE INDEX "QuizTheme_quizId_order_idx" ON "QuizTheme"("quizId", "order");
