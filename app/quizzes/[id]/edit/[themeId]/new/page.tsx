import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { userOwnsThemeQuiz } from "@/lib/question-ownership";
import { buildThemeStyle } from "@/lib/quiz-theme-style";
import QuestionEditForm from "@/components/QuestionEditForm";

export default async function NewQuestionPage({
  params,
}: {
  params: Promise<{ id: string; themeId: string }>;
}) {
  const { id, themeId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsThemeQuiz(userId, themeId))) notFound();

  const [quiz, theme] = await Promise.all([
    prisma.quiz.findUnique({ where: { id }, select: { themeColors: true } }),
    prisma.theme.findUnique({ where: { id: themeId }, select: { title: true } }),
  ]);
  if (!quiz || !theme) notFound();

  const backHref = `/quizzes/${id}/edit/${themeId}`;

  return (
    <div
      className="mx-auto w-full max-w-3xl px-6 py-10"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem", ...buildThemeStyle(quiz.themeColors) }}
    >
      <div>
        <Link href={backHref} className="qz-btn-quit" style={{ display: "inline-block" }}>
          Retour aux questions
        </Link>
        <h1 className="qz-start-title" style={{ fontSize: "1.75rem", marginTop: "0.5rem" }}>
          Nouvelle question — {theme.title}
        </h1>
      </div>

      <QuestionEditForm themeId={themeId} backHref={backHref} />
    </div>
  );
}
