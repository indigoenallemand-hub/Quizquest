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
// includeBadges is false for guests: badges are a signed-in-user concept
// (see lib/carousel-data.ts), so counting their points toward `max` would
// make the total look permanently out of reach.
export function getGlobalPoints(
  chapters: ChapterPointsInput[],
  options?: { includeBadges?: boolean }
): { earned: number; max: number } {
  const includeBadges = options?.includeBadges ?? true;
  let earned = 0;
  let max = 0;

  for (const chapter of chapters) {
    earned += chapter.stats.correct * POINTS_PER_QUESTION;
    max += chapter.questionCount * POINTS_PER_QUESTION;

    if (!includeBadges) continue;
    for (const [badgeType, value] of Object.entries(POINTS_PER_BADGE)) {
      if (chapter.earnedBadges.includes(badgeType)) earned += value;
      max += value;
    }
  }

  return { earned, max };
}
