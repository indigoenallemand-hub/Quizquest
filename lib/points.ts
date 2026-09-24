// Global point scale, ported from the local app's lib/points.js.
export const POINTS_PER_QUESTION = 10;
export const POINTS_PER_BADGE: Record<string, number> = {
  EXPLORATEUR: 100,
  QCM: 200,
  REPONSE_LIBRE: 300,
};

interface ChapterPointsInput {
  questionCount: number;
  stats: { correct: number };
  earnedBadges: string[];
}

// Points earned so far and the theoretical maximum, across every chapter of
// a quiz: POINTS_PER_QUESTION for each question ever answered correctly
// (sticky, like the progress grid), plus each chapter's badge values.
// reponseLibreBadgeEnabled false (Quiz.reponseLibreBadgeEnabled) drops that
// badge's points from both earned and max, since the creator turned it off.
export function getGlobalPoints(
  chapters: ChapterPointsInput[],
  options?: { reponseLibreBadgeEnabled?: boolean }
): { earned: number; max: number } {
  const reponseLibreBadgeEnabled = options?.reponseLibreBadgeEnabled ?? true;
  let earned = 0;
  let max = 0;

  for (const chapter of chapters) {
    earned += chapter.stats.correct * POINTS_PER_QUESTION;
    max += chapter.questionCount * POINTS_PER_QUESTION;

    for (const [badgeType, value] of Object.entries(POINTS_PER_BADGE)) {
      if (badgeType === "REPONSE_LIBRE" && !reponseLibreBadgeEnabled) continue;
      if (chapter.earnedBadges.includes(badgeType)) earned += value;
      max += value;
    }
  }

  return { earned, max };
}
