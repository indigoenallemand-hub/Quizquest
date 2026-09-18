import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";

export async function GET() {
  const userId = await getSessionUserId();

  const quizzes = await prisma.quiz.findMany({
    where: userId ? { OR: [{ status: "PUBLIC" }, { creatorId: userId }] } : { status: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      status: true,
      creatorId: true,
      themes: { orderBy: { order: "asc" }, select: { theme: { select: { id: true, title: true } } } },
    },
  });

  return NextResponse.json({ quizzes });
}

const createQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  status: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
  themeIds: z.array(z.string()).min(1),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const parsed = createQuizSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { themeIds, ...data } = parsed.data;
  const quiz = await prisma.quiz.create({
    data: {
      ...data,
      creatorId: userId,
      themes: { create: themeIds.map((themeId, order) => ({ themeId, order })) },
    },
    include: { themes: { orderBy: { order: "asc" }, include: { theme: true } } },
  });

  return NextResponse.json({ quiz }, { status: 201 });
}
