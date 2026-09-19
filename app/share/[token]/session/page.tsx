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
  const link = await prisma.guestAccess.findUnique({ where: { token }, select: { quiz: { select: { themeColors: true } } } });

  return (
    <div style={buildThemeStyle(link?.quiz.themeColors)}>
      <SessionPageClient params={params} searchParams={searchParams} />
    </div>
  );
}
