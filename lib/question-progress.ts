import { prisma } from "@/lib/prisma";
import type { QuestionStatus } from "@/lib/status-summary";

export type { QuestionStatus } from "@/lib/status-summary";
export { summarizeStatuses } from "@/lib/status-summary";

// "correct" is sticky: once a question has ever been answered correctly, a
// later wrong attempt doesn't demote it back to "wrong" — same semantics as
// the legacy Electron app's localStorage progress tracking. `identity` picks
// which attempts count: a signed-in user's, or a single guest's.
export async function getQuestionStatuses(
  identity: { userId: string } | { guestAccessId: string },
  questionIds: string[]
): Promise<Map<string, QuestionStatus>> {
  const statuses = new Map<string, QuestionStatus>();
  if (questionIds.length === 0) return statuses;

  const attempts = await prisma.attempt.findMany({
    where: { ...identity, questionId: { in: questionIds } },
    select: { questionId: true, isCorrect: true },
  });

  for (const id of questionIds) statuses.set(id, "unanswered");
  for (const a of attempts) {
    if (a.isCorrect) statuses.set(a.questionId, "correct");
    else if (statuses.get(a.questionId) !== "correct") statuses.set(a.questionId, "wrong");
  }

  return statuses;
}
