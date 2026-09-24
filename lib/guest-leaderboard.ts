import { prisma } from "@/lib/prisma";
import { POINTS_PER_QUESTION, POINTS_PER_BADGE } from "@/lib/points";
import type { BadgeType } from "@/lib/badges";

export interface GuestLeaderboardEntry {
  guestAccessId: string;
  guestName: string | null;
  points: number;
}

// Ranks a quiz's guest links by the same point scale as PointsSummary:
// POINTS_PER_QUESTION per distinct question ever answered correctly, plus
// each earned badge's value (skipping Reponse libre if the quiz turned that
// badge off). Guests with 0 points (link never played) are left out.
export async function getGuestLeaderboard(
  guestLinks: { id: string; guestName: string | null }[],
  questionIds: string[],
  themeIds: string[],
  reponseLibreBadgeEnabled: boolean
): Promise<GuestLeaderboardEntry[]> {
  if (guestLinks.length === 0 || questionIds.length === 0) return [];
  const guestIds = guestLinks.map((g) => g.id);

  const [correctAttempts, badges] = await Promise.all([
    prisma.attempt.findMany({
      where: { guestAccessId: { in: guestIds }, questionId: { in: questionIds }, isCorrect: true },
      select: { guestAccessId: true, questionId: true },
      distinct: ["guestAccessId", "questionId"],
    }),
    prisma.badge.findMany({
      where: { guestAccessId: { in: guestIds }, themeId: { in: themeIds } },
      select: { guestAccessId: true, type: true },
    }),
  ]);

  const points = new Map<string, number>();
  for (const a of correctAttempts) {
    if (!a.guestAccessId) continue;
    points.set(a.guestAccessId, (points.get(a.guestAccessId) ?? 0) + POINTS_PER_QUESTION);
  }
  for (const b of badges) {
    if (!b.guestAccessId) continue;
    if (b.type === "REPONSE_LIBRE" && !reponseLibreBadgeEnabled) continue;
    points.set(b.guestAccessId, (points.get(b.guestAccessId) ?? 0) + POINTS_PER_BADGE[b.type as BadgeType]);
  }

  return guestLinks
    .map((g) => ({ guestAccessId: g.id, guestName: g.guestName, points: points.get(g.id) ?? 0 }))
    .filter((g) => g.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);
}
