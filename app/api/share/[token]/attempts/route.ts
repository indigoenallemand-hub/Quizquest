import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readGuestAccess } from "@/lib/guest-access";
import { gradeAttempt, InvalidAnswerError } from "@/lib/attempt-grading";
import { syncBadgesForTheme } from "@/lib/badge-sync";

const submitAttemptSchema = z.object({
  questionId: z.string(),
  mode: z.enum(["ENTRAINEMENT", "QCM", "REPONSE_LIBRE"]),
  sessionId: z.string().optional(),
  answer: z.unknown().optional(),
  text: z.string().optional(),
  comment: z.string().optional(),
});

// Guest counterpart of /api/attempts: identity comes from the share cookie
// instead of a NextAuth session, but badges work the same way.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const link = await prisma.guestAccess.findUnique({ where: { token }, select: { id: true } });
  if (!link) return NextResponse.json({ error: "Lien invalide." }, { status: 404 });

  const guestAccessId = await readGuestAccess(token);
  if (!guestAccessId) return NextResponse.json({ error: "Accès expiré." }, { status: 401 });

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
      guestAccessId,
      questionId,
      mode,
      sessionId,
      answerGiven: answerGiven as never,
      isCorrect,
      comment: comment?.trim() ? comment.trim() : undefined,
    },
  });

  const newlyEarnedBadges = await syncBadgesForTheme({ guestAccessId }, question.themeId, mode);

  return NextResponse.json({ attempt, isCorrect, feedback, correctAnswerText, correctChoices, newlyEarnedBadges });
}
