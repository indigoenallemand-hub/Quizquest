import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readGuestAccess } from "@/lib/guest-access";
import { gradeAttempt, InvalidAnswerError } from "@/lib/attempt-grading";

const submitAttemptSchema = z.object({
  questionId: z.string(),
  mode: z.enum(["ENTRAINEMENT", "QCM", "REPONSE_LIBRE"]),
  sessionId: z.string().optional(),
  answer: z.unknown().optional(),
  text: z.string().optional(),
});

// Guest counterpart of /api/attempts: identity comes from the share cookie
// instead of a NextAuth session, and no badges are awarded (badges are a
// signed-in-user concept in this app).
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const quiz = await prisma.quiz.findUnique({ where: { shareToken: token }, select: { id: true } });
  if (!quiz) return NextResponse.json({ error: "Lien invalide." }, { status: 404 });

  const guestAccessId = await readGuestAccess(quiz.id);
  if (!guestAccessId) return NextResponse.json({ error: "Accès expiré." }, { status: 401 });

  const parsed = submitAttemptSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { questionId, mode, sessionId, answer, text } = parsed.data;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, themeId: true, type: true, content: true },
  });
  if (!question) return NextResponse.json({ error: "Question introuvable." }, { status: 404 });

  let graded;
  try {
    graded = await gradeAttempt(question, { mode, answer, text });
  } catch (err) {
    if (err instanceof InvalidAnswerError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
  const { isCorrect, feedback, answerGiven, correctAnswerText, correctChoices } = graded;

  const attempt = await prisma.attempt.create({
    data: {
      guestAccessId,
      questionId,
      mode,
      sessionId,
      answerGiven: answerGiven as never,
      isCorrect,
    },
  });

  return NextResponse.json({ attempt, isCorrect, feedback, correctAnswerText, correctChoices, newlyEarnedBadges: [] });
}
