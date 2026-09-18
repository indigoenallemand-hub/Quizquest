import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";

export async function GET() {
  const themes = await prisma.theme.findMany({
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      _count: { select: { questions: true } },
    },
  });
  return NextResponse.json({ themes });
}

const createThemeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const parsed = createThemeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const theme = await prisma.theme.create({ data: parsed.data });
  return NextResponse.json({ theme }, { status: 201 });
}
