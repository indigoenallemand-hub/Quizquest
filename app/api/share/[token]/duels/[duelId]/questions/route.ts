import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveGuest, type DuelQuestion } from "@/lib/duel";

// The current round's questions this guest hasn't answered yet, in the same
// { themes: [...] } shape as /api/share/[token]/questions so QuizSession can
// play them as-is. Leaving out answered ones lets a reloaded page resume.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; duelId: string }> }) {
  const { token, duelId } = await params;
  const guest = await resolveGuest(token);
  if ("error" in guest) return NextResponse.json({ error: guest.error }, { status: guest.status });
  const me = guest.guestAccessId;

  const duel = await prisma.duel.findUnique({
    where: { id: duelId },
    select: {
      quizId: true,
      status: true,
      challengerId: true,
      opponentId: true,
      rounds: {
        orderBy: { index: "desc" },
        take: 1,
        select: { themeId: true, themeTitle: true, questions: true, answers: { where: { guestAccessId: me }, select: { questionId: true } } },
      },
    },
  });
  if (!duel || duel.quizId !== guest.quizId || (duel.challengerId !== me && duel.opponentId !== me)) {
    return NextResponse.json({ error: "Duel introuvable." }, { status: 404 });
  }
  const round = duel.rounds[0];
  if (duel.status !== "ACTIVE" || !round?.themeId) return NextResponse.json({ themes: [] });

  const answered = new Set(round.answers.map((a) => a.questionId));
  const questions = ((round.questions ?? []) as DuelQuestion[]).filter((q) => !answered.has(q.id));
  return NextResponse.json({ themes: [{ id: round.themeId, title: round.themeTitle, questions }] });
}
