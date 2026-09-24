-- DropIndex
DROP INDEX "Badge_userId_themeId_type_key";

-- AlterTable
ALTER TABLE "Badge" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Badge" ADD COLUMN     "guestAccessId" TEXT;

-- CreateIndex
CREATE INDEX "Badge_guestAccessId_idx" ON "Badge"("guestAccessId");

-- CreateIndex (partial uniques: one badge per type per theme, per identity)
CREATE UNIQUE INDEX "Badge_userId_themeId_type_key" ON "Badge"("userId", "themeId", "type") WHERE "userId" IS NOT NULL;
CREATE UNIQUE INDEX "Badge_guestAccessId_themeId_type_key" ON "Badge"("guestAccessId", "themeId", "type") WHERE "guestAccessId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_guestAccessId_fkey" FOREIGN KEY ("guestAccessId") REFERENCES "GuestAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
