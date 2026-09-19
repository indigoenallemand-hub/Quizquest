import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicView } from "@/lib/question-resolver";
import { readGuestAccess } from "@/lib/guest-access";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const themeId = new URL(request.url).searchParams.get("themeId");

  const link = await prisma.guestAccess.findUnique({
    where: { token },
    select: {
      quiz: {
        select: {
          id: true,
          themes: {
            orderBy: { order: "asc" },
            select: {
              theme: {
                select: {
                  id: true,
                  title: true,
                  questions: { select: { id: true, type: true, content: true, section: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!link) return NextResponse.json({ error: "Lien invalide." }, { status: 404 });

  const guestAccessId = await readGuestAccess(token);
  if (!guestAccessId) return NextResponse.json({ error: "Accès expiré." }, { status: 401 });

  const selectedThemes = themeId ? link.quiz.themes.filter((t) => t.theme.id === themeId) : link.quiz.themes;

  const themes = selectedThemes.map(({ theme }) => ({
    id: theme.id,
    title: theme.title,
    questions: theme.questions.map((q) => getPublicView(q)),
  }));

  return NextResponse.json({ themes });
}
