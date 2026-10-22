import { prisma } from "@/lib/prisma";
import { buildChapterStyle } from "@/lib/chapter-style";
import SessionPageClient from "./SessionPageClient";

export default async function SharedSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mode?: string; themeId?: string; section?: string; count?: string; missed?: string; points?: string; grid?: string }>;
}) {
  const { token } = await params;
  const link = await prisma.guestAccess.findUnique({ where: { token }, select: { quiz: { select: { id: true, themeColors: true } } } });
  const { themeId } = await searchParams;
  const style = link ? await buildChapterStyle(link.quiz.id, link.quiz.themeColors, themeId) : {};

  return (
    <div style={style}>
      <SessionPageClient params={params} searchParams={searchParams} />
    </div>
  );
}
