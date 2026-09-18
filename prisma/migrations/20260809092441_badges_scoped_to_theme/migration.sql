-- DropForeignKey
ALTER TABLE "Badge" DROP CONSTRAINT "Badge_quizId_fkey";

-- DropIndex
DROP INDEX "Badge_userId_quizId_type_key";

-- AlterTable: add themeId nullable first, backfill from the badge's quiz's
-- (single, at migration time) theme, then enforce NOT NULL and drop quizId.
ALTER TABLE "Badge" ADD COLUMN "themeId" TEXT;

UPDATE "Badge" b
SET "themeId" = qt."themeId"
FROM "QuizTheme" qt
WHERE qt."quizId" = b."quizId";

ALTER TABLE "Badge" ALTER COLUMN "themeId" SET NOT NULL;
ALTER TABLE "Badge" DROP COLUMN "quizId";

-- CreateIndex
CREATE UNIQUE INDEX "Badge_userId_themeId_type_key" ON "Badge"("userId", "themeId", "type");

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
