import { prisma } from "@/lib/prisma";
import { buildThemeStyle } from "@/lib/quiz-theme-style";
import SessionPageClient from "./SessionPageClient";

export default async function SharedSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mode?: string; themeId?: string; section?: string; count?: string }>;
}) {
  const { token } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { shareToken: token }, select: { themeColors: true } });

  return (
    <div style={buildThemeStyle(quiz?.themeColors)}>
      <SessionPageClient params={params} searchParams={searchParams} />
    </div>
  );
}
