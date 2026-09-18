import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { questionInputSchema } from "@/lib/schemas";
import { userOwnsThemeQuiz } from "@/lib/question-ownership";

const createQuestionSchema = z.object({ themeId: z.string() }).and(questionInputSchema);

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const parsed = createQuestionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { themeId, type, content, section } = parsed.data;
  if (!(await userOwnsThemeQuiz(userId, themeId))) {
    return NextResponse.json({ error: "Interdit." }, { status: 403 });
  }

  const question = await prisma.question.create({ data: { themeId, type, content, section } });
  return NextResponse.json({ question }, { status: 201 });
}
