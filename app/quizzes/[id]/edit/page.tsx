import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { buildThemeStyle, type QuizThemeColors } from "@/lib/quiz-theme-style";
import QuizThemeColorForm from "@/components/QuizThemeColorForm";
import QuizBadgeSettingsForm from "@/components/QuizBadgeSettingsForm";
import ChapterReorderList from "@/components/ChapterReorderList";

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) notFound();

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      themes: {
        orderBy: { order: "asc" },
        include: { theme: { select: { id: true, title: true, _count: { select: { questions: true } } } } },
      },
    },
  });
  if (!quiz || quiz.creatorId !== userId) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", ...buildThemeStyle(quiz.themeColors) }}>
      <div>
        <Link href={`/quizzes/${quiz.id}`} className="qz-btn-quit" style={{ display: "inline-block" }}>
          Retour au quiz
        </Link>
        <h1 className="qz-start-title" style={{ fontSize: "1.75rem", marginTop: "0.5rem" }}>
          Editer — {quiz.title}
        </h1>
      </div>

      <QuizThemeColorForm quizId={quiz.id} initialColors={(quiz.themeColors as QuizThemeColors | null) ?? {}} />

      <QuizBadgeSettingsForm quizId={quiz.id} initialReponseLibreBadgeEnabled={quiz.reponseLibreBadgeEnabled} />

      <div>
        <h2 style={{ fontWeight: 700, marginBottom: "0.75rem" }}>Chapitres</h2>
        <ChapterReorderList
          quizId={quiz.id}
          initialChapters={quiz.themes.map(({ theme, enabled }) => ({
            id: theme.id,
            enabled,
            title: theme.title,
            questionCount: theme._count.questions,
          }))}
        />
      </div>
    </div>
  );
}
