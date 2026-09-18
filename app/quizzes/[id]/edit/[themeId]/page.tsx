import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { userOwnsThemeQuiz } from "@/lib/question-ownership";
import { buildThemeStyle } from "@/lib/quiz-theme-style";
import { parseQuestionContent } from "@/lib/question-resolver";
import QuestionListActions from "@/components/QuestionListActions";

const TYPE_LABEL: Record<string, string> = {
  QCM_SIMPLE: "QCM simple",
  QCM_MULTIPLE: "QCM multiple",
  DATE: "Date",
  CALCUL: "Calcul",
};

function questionPreview(question: Parameters<typeof parseQuestionContent>[0]): string {
  return parseQuestionContent(question).content.enonce;
}

export default async function EditThemeQuestionsPage({
  params,
}: {
  params: Promise<{ id: string; themeId: string }>;
}) {
  const { id, themeId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsThemeQuiz(userId, themeId))) notFound();

  const [quiz, theme] = await Promise.all([
    prisma.quiz.findUnique({ where: { id }, select: { title: true, themeColors: true } }),
    prisma.theme.findUnique({ where: { id: themeId }, select: { title: true, questions: true } }),
  ]);
  if (!quiz || !theme) notFound();

  const questions = theme.questions.map((q, i) => ({
    id: q.id,
    n: i + 1,
    type: q.type,
    section: q.section,
    preview: questionPreview(q),
  }));

  return (
    <div
      className="mx-auto w-full max-w-4xl px-6 py-10"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem", ...buildThemeStyle(quiz.themeColors) }}
    >
      <div>
        <Link href={`/quizzes/${id}/edit`} className="qz-btn-quit" style={{ display: "inline-block" }}>
          Retour a l&apos;edition
        </Link>
        <h1 className="qz-start-title" style={{ fontSize: "1.75rem", marginTop: "0.5rem" }}>
          {theme.title}
        </h1>
        <p className="qz-start-subtitle">{questions.length} questions</p>
      </div>

      <Link href={`/quizzes/${id}/edit/${themeId}/new`} className="qz-btn-primary" style={{ width: "auto", display: "inline-block" }}>
        + Ajouter une question
      </Link>

      <div className="qz-recap-table-wrap">
        <table className="qz-recap-table">
          <thead>
            <tr>
              <th className="qz-recap-col-n">#</th>
              <th>Question</th>
              <th className="qz-recap-col-status">Type</th>
              <th className="qz-recap-col-status">Section</th>
              <th className="qz-recap-col-status">Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id}>
                <td className="qz-recap-col-n">{q.n}</td>
                <td className="qz-recap-col-question">{q.preview}</td>
                <td className="qz-recap-col-status">{TYPE_LABEL[q.type] ?? q.type}</td>
                <td className="qz-recap-col-status">{q.section ?? "—"}</td>
                <td className="qz-recap-col-status">
                  <QuestionListActions questionId={q.id} editHref={`/quizzes/${id}/edit/${themeId}/${q.id}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
