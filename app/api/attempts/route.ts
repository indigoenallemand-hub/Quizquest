import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { gradeAttempt, InvalidAnswerError } from "@/lib/attempt-grading";
import { syncBadgesForTheme } from "@/lib/badge-sync";

const submitAttemptSchema = z.object({
  questionId: z.string(),
  mode: z.enum(["ENTRAINEMENT", "QCM", "REPONSE_LIBRE"]),
  sessionId: z.string().optional(),
  // Deterministic modes (ENTRAINEMENT/QCM on non-REPONSE_LIBRE questions) send
  // a typed answer object (see lib/grading.ts); REPONSE_LIBRE mode sends free text.
  answer: z.unknown().optional(),
  text: z.string().optional(),
  comment: z.string().optional(),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const parsed = submitAttemptSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { questionId, mode, sessionId, answer, text, comment } = parsed.data;

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
      userId,
      questionId,
      mode,
      sessionId,
      answerGiven: answerGiven as never,
      isCorrect,
      comment: comment?.trim() ? comment.trim() : undefined,
    },
  });

  const newlyEarnedBadges = await syncBadgesForTheme({ userId }, question.themeId, mode);

  return NextResponse.json({ attempt, isCorrect, feedback, correctAnswerText, correctChoices, newlyEarnedBadges });
}
