-- DropForeignKey
ALTER TABLE "Badge" DROP CONSTRAINT "Badge_themeId_fkey";

-- DropIndex
DROP INDEX "Badge_userId_themeId_type_key";

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "guestAccessId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Badge" DROP COLUMN "themeId",
ADD COLUMN     "quizId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "shareToken" TEXT;

-- CreateTable
CREATE TABLE "GuestAccess" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "activeToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestAccess_quizId_key" ON "GuestAccess"("quizId");

-- CreateIndex
CREATE INDEX "Attempt_guestAccessId_idx" ON "Attempt"("guestAccessId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_userId_quizId_type_key" ON "Badge"("userId", "quizId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_shareToken_key" ON "Quiz"("shareToken");

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestAccess" ADD CONSTRAINT "GuestAccess_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_guestAccessId_fkey" FOREIGN KEY ("guestAccessId") REFERENCES "GuestAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

