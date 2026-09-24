import { prisma } from "@/lib/prisma";
import { evaluateBadges, type AttemptRecord, type AttemptMode, type BadgeType } from "@/lib/badges";

export type BadgeIdentity = { userId: string } | { guestAccessId: string };

// Checks and awards any newly-earned badges for this theme, for a signed-in
// user or a guest link alike — shared by /api/attempts and
// /api/share/[token]/attempts.
export async function syncBadgesForTheme(identity: BadgeIdentity, themeId: string, mode: AttemptMode): Promise<BadgeType[]> {
  let badgeTypesToCheck: BadgeType[] =
    mode === "QCM" ? ["EXPLORATEUR", "QCM"] : mode === "REPONSE_LIBRE" ? ["EXPLORATEUR", "REPONSE_LIBRE"] : ["EXPLORATEUR"];

  const [themeQuestions, attempts, existingBadges, quizTheme] = await Promise.all([
    prisma.question.findMany({ where: { themeId }, select: { id: true } }),
    prisma.attempt.findMany({
      where: { ...identity, question: { themeId } },
      select: { questionId: true, isCorrect: true, sessionId: true, mode: true },
    }),
    prisma.badge.findMany({ where: { ...identity, themeId }, select: { type: true } }),
    prisma.quizTheme.findFirst({ where: { themeId }, select: { quiz: { select: { reponseLibreBadgeEnabled: true } } } }),
  ]);
  if (quizTheme?.quiz.reponseLibreBadgeEnabled === false) {
    badgeTypesToCheck = badgeTypesToCheck.filter((t) => t !== "REPONSE_LIBRE");
  }

  const themeQuestionIds = themeQuestions.map((q) => q.id);
  const attemptRecords: AttemptRecord[] = attempts.map((a) => ({
    questionId: a.questionId,
    isCorrect: a.isCorrect,
    sessionId: a.sessionId,
    mode: a.mode,
  }));
  const alreadyEarned = new Set(existingBadges.map((b) => b.type));

  const newlyEarned: BadgeType[] = [];
  for (const type of badgeTypesToCheck) {
    if (alreadyEarned.has(type)) continue;
    if (evaluateBadges(type, themeQuestionIds, attemptRecords)) {
      newlyEarned.push(type);
    }
  }

  if (newlyEarned.length > 0) {
    await prisma.badge.createMany({
      data: newlyEarned.map((type) => ({ ...identity, themeId, type })),
      skipDuplicates: true,
    });
  }

  return newlyEarned;
}
