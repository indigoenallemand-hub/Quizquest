// Pure, server/client-agnostic helpers around QuestionStatus — kept separate
// from lib/question-progress.ts so client components can use them without
// pulling in that file's Prisma import (which drags Node-only deps like
// `pg` into the browser bundle).
export type QuestionStatus = "correct" | "wrong" | "unanswered";

export function summarizeStatuses(statuses: QuestionStatus[]): { correct: number; wrong: number; unanswered: number; total: number } {
  let correct = 0;
  let wrong = 0;
  for (const s of statuses) {
    if (s === "correct") correct++;
    else if (s === "wrong") wrong++;
  }
  return { correct, wrong, unanswered: statuses.length - correct - wrong, total: statuses.length };
}
