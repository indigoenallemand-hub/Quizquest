import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { canAccessQuiz } from "@/lib/quiz-access";
import { buildCarouselChapters } from "@/lib/carousel-data";
import { getGlobalPoints } from "@/lib/points";
import { buildThemeStyle } from "@/lib/quiz-theme-style";
import QuizCarousel from "@/components/QuizCarousel";
import PointsSummary from "@/components/PointsSummary";
import ShareSection from "@/components/ShareSection";

export default async function QuizDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chapter?: string; points?: string; grid?: string }>;
}) {
  const { id } = await params;
  const { chapter, points, grid } = await searchParams;
  const userId = await getSessionUserId();

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      themes: {
        orderBy: { order: "asc" },
        include: { theme: { include: { questions: true } } },
      },
      guestLinks: {
        select: { id: true, token: true, guestName: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!quiz || !canAccessQuiz(quiz, userId)) notFound();

  const isOwner = userId === quiz.creatorId;
  const chapters = await buildCarouselChapters(
    quiz.themes.map((t) => t.theme),
    userId ? { userId } : null
  );
  const { earned, max } = getGlobalPoints(chapters);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10" style={{ position: "relative", ...buildThemeStyle(quiz.themeColors) }}>
      {userId && <PointsSummary earned={earned} max={max} entryPoints={points ? Number(points) : undefined} />}

      <div className="qz-start-header">
        <h1 className="qz-start-title">{quiz.title}</h1>
        {quiz.description && <p className="qz-start-subtitle">{quiz.description}</p>}
      </div>

      <div className="mt-8">
        {chapters.length === 0 ? (
          <p className="text-center text-zinc-600">Ce quiz n&apos;a pas encore de chapitre.</p>
        ) : (
          <QuizCarousel
            basePath={`/quizzes/${quiz.id}`}
            chapters={chapters}
            initialChapterId={chapter}
            pointsBefore={earned}
            entryGrid={grid}
          />
        )}
      </div>

      {isOwner && (
        <div className="mt-6 text-center">
          <Link href={`/quizzes/${quiz.id}/edit`} className="qz-btn-secondary" style={{ display: "inline-block", width: "auto" }}>
            Editer le quiz
          </Link>
        </div>
      )}

      {isOwner && <ShareSection quizId={quiz.id} initialLinks={quiz.guestLinks} />}
    </div>
  );
}
