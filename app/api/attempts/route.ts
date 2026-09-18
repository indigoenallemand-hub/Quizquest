import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { gradeAttempt, InvalidAnswerError } from "@/lib/attempt-grading";
import { evaluateBadges, type AttemptRecord, type BadgeType } from "@/lib/badges";

const submitAttemptSchema = z.object({
  questionId: z.string(),
  mode: z.enum(["ENTRAINEMENT", "QCM", "REPONSE_LIBRE"]),
  sessionId: z.string().optional(),
  // Deterministic modes (ENTRAINEMENT/QCM on non-REPONSE_LIBRE questions) send
  // a typed answer object (see lib/grading.ts); REPONSE_LIBRE mode sends free text.
  answer: z.unknown().optional(),
  text: z.string().optional(),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

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
      userId,
      questionId,
      mode,
      sessionId,
      answerGiven: answerGiven as never,
      isCorrect,
    },
  });

  const newlyEarnedBadges = await syncBadgesForTheme(userId, question.themeId, mode);

  return NextResponse.json({ attempt, isCorrect, feedback, correctAnswerText, correctChoices, newlyEarnedBadges });
}

async function syncBadgesForTheme(userId: string, themeId: string, mode: "ENTRAINEMENT" | "QCM" | "REPONSE_LIBRE") {
  const badgeTypesToCheck: BadgeType[] =
    mode === "QCM" ? ["EXPLORATEUR", "QCM"] : mode === "REPONSE_LIBRE" ? ["EXPLORATEUR", "REPONSE_LIBRE"] : ["EXPLORATEUR"];

  const [themeQuestions, attempts, existingBadges] = await Promise.all([
    prisma.question.findMany({ where: { themeId }, select: { id: true } }),
    prisma.attempt.findMany({
      where: { userId, question: { themeId } },
      select: { questionId: true, isCorrect: true, sessionId: true, mode: true },
    }),
    prisma.badge.findMany({ where: { userId, themeId }, select: { type: true } }),
  ]);

  const themeQuestionIds = themeQuestions.map((q) => q.id);
  const attemptRecords: AttemptRecord[] = attempts.map((a) => ({
    questionId: a.questionId,
    isCorrect: a.isCorrect,
    sessionId: a.sessionId,
    mode: a.mode,
  }));
  const alreadyEarned = new Set(existingBadges.map((b) => b.type));

  const newlyEarned: BadgeType[] = [];
  for (const type of badgeTypesToCheck) {
    if (alreadyEarned.has(type)) continue;
    if (evaluateBadges(type, themeQuestionIds, attemptRecords)) {
      newlyEarned.push(type);
    }
  }

  if (newlyEarned.length > 0) {
    await prisma.badge.createMany({
      data: newlyEarned.map((type) => ({ userId, themeId, type })),
      skipDuplicates: true,
    });
  }

  return newlyEarned;
}
