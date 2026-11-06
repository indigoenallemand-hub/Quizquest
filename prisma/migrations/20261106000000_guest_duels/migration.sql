-- CreateEnum
CREATE TYPE "DuelStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'CANCELLED', 'FINISHED', 'ABANDONED');

-- CreateTable
CREATE TABLE "Duel" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "bestOf" INTEGER NOT NULL,
    "status" "DuelStatus" NOT NULL DEFAULT 'PENDING',
    "abandonedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuelRound" (
    "id" TEXT NOT NULL,
    "duelId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "chooserId" TEXT NOT NULL,
    "themeId" TEXT,
    "themeTitle" TEXT,
    "questions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuelRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuelAnswer" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "guestAccessId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "answerGiven" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuelAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Duel_challengerId_status_idx" ON "Duel"("challengerId", "status");

-- CreateIndex
CREATE INDEX "Duel_opponentId_status_idx" ON "Duel"("opponentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DuelRound_duelId_index_key" ON "DuelRound"("duelId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "DuelAnswer_roundId_guestAccessId_questionId_key" ON "DuelAnswer"("roundId", "guestAccessId", "questionId");

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "GuestAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "GuestAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelRound" ADD CONSTRAINT "DuelRound_duelId_fkey" FOREIGN KEY ("duelId") REFERENCES "Duel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelAnswer" ADD CONSTRAINT "DuelAnswer_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "DuelRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelAnswer" ADD CONSTRAINT "DuelAnswer_guestAccessId_fkey" FOREIGN KEY ("guestAccessId") REFERENCES "GuestAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

