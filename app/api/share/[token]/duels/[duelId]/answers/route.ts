import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveGuest, advanceDuel, isAnswerTooLate, type DuelQuestion } from "@/lib/duel";
import { gradeAttempt, InvalidAnswerError } from "@/lib/attempt-grading";

// Same body QuizSession sends to the attempts routes; mode/sessionId/comment
// are accepted but ignored — duel answers are always graded like a QCM test.
const submitDuelAnswerSchema = z.object({
  questionId: z.string(),
  answer: z.unknown().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string; duelId: string }> }) {
  const { token, duelId } = await params;
  const guest = await resolveGuest(token);
  if ("error" in guest) return NextResponse.json({ error: guest.error }, { status: guest.status });
  const me = guest.guestAccessId;

  const parsed = submitDuelAnswerSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { questionId } = parsed.data;
  let { answer } = parsed.data;

  const duel = await prisma.duel.findUnique({
    where: { id: duelId },
    select: {
      quizId: true,
      status: true,
      challengerId: true,
      opponentId: true,
      rounds: { orderBy: { index: "desc" }, take: 1, select: { id: true, questions: true, startedAt: true } },
    },
  });
  if (!duel || duel.quizId !== guest.quizId || (duel.challengerId !== me && duel.opponentId !== me)) {
    return NextResponse.json({ error: "Duel introuvable." }, { status: 404 });
  }
  const round = duel.rounds[0];
  if (duel.status !== "ACTIVE" || !round) return NextResponse.json({ error: "Ce duel n'est plus en cours." }, { status: 409 });
  if (isAnswerTooLate(round)) {
    await advanceDuel(duelId);
    return NextResponse.json({ error: "Temps écoulé." }, { status: 409 });
  }

  const drawn = ((round.questions ?? []) as DuelQuestion[]).find((q) => q.id === questionId);
  if (!drawn) return NextResponse.json({ error: "Question hors de cette manche." }, { status: 400 });
  // Grade CALCUL answers against the variables both players were shown, not
  // whatever the client echoes back.
  if (drawn.type === "CALCUL" && typeof answer === "object" && answer !== null) {
    answer = { ...answer, variables: drawn.variables };
  }

  const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, type: true, content: true } });
  if (!question) return NextResponse.json({ error: "Question introuvable." }, { status: 404 });

  let graded;
  try {
    graded = await gradeAttempt(question, { mode: "QCM", answer });
  } catch (err) {
    if (err instanceof InvalidAnswerError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
  const { isCorrect, feedback, answerGiven, correctAnswerText, correctChoices } = graded;

  try {
    await prisma.duelAnswer.create({ data: { roundId: round.id, guestAccessId: me, questionId, isCorrect, answerGiven: answerGiven as never } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return NextResponse.json({ error: "Question déjà répondue." }, { status: 409 });
    throw err;
  }

  await advanceDuel(duelId);

  return NextResponse.json({ isCorrect, feedback, correctAnswerText, correctChoices });
}
