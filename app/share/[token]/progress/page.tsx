import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { readGuestAccess } from "@/lib/guest-access";
import { getQuestionStatuses, summarizeStatuses, type QuestionStatus } from "@/lib/question-progress";
import { parseQuestionContent } from "@/lib/question-resolver";
import { buildThemeStyle } from "@/lib/quiz-theme-style";

const STATUS_LABEL: Record<QuestionStatus, string> = {
  correct: "Juste",
  wrong: "Faux",
  unanswered: "Non repondue",
};

function questionText(question: Parameters<typeof parseQuestionContent>[0]): string {
  if (question.type === "CALCUL") return "Question de calcul generee aleatoirement (enonce different a chaque tentative).";
  return parseQuestionContent(question).content.enonce;
}

export default async function SharedQuizProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ themeId?: string }>;
}) {
  const { token } = await params;
  const { themeId } = await searchParams;

  const link = await prisma.guestAccess.findUnique({
    where: { token },
    include: {
      quiz: {
        include: {
          themes: { where: { enabled: true }, orderBy: { order: "asc" }, include: { theme: { select: { id: true, title: true, questions: true } } } },
        },
      },
    },
  });
  if (!link) notFound();
  const quiz = link.quiz;

  const guestAccessId = await readGuestAccess(token);
  if (!guestAccessId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
        <h1 className="qz-start-title" style={{ fontSize: "1.5rem" }}>
          Acces expire
        </h1>
        <p className="qz-start-subtitle mt-2">Reouvrez le lien de partage pour continuer.</p>
        <Link href={`/share/${token}`} className="qz-btn-primary mt-6" style={{ display: "inline-block", width: "auto" }}>
          Reutiliser ce lien
        </Link>
      </div>
    );
  }

  const selectedThemes = themeId ? quiz.themes.filter((t) => t.theme.id === themeId) : quiz.themes;
  const title = themeId && selectedThemes[0] ? selectedThemes[0].theme.title : quiz.title;

  const questions = selectedThemes.flatMap((t) => t.theme.questions);
  const statuses = await getQuestionStatuses({ guestAccessId }, questions.map((q) => q.id));
  const stats = summarizeStatuses(questions.map((q) => statuses.get(q.id) ?? "unanswered"));

  const rows = questions.map((q, i) => ({
    n: i + 1,
    id: q.id,
    question: questionText(q),
    status: statuses.get(q.id) ?? "unanswered",
  }));

  return (
    <div
      className="mx-auto w-full max-w-4xl px-6 py-10"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem", ...buildThemeStyle(quiz.themeColors) }}
    >
      <div>
        <Link
          href={themeId ? `/share/${token}/play?chapter=${themeId}` : `/share/${token}/play`}
          className="qz-btn-quit"
          style={{ display: "inline-block" }}
        >
          Retour au quiz
        </Link>
        <div className="qz-start-header" style={{ marginTop: "0.5rem" }}>
          <h1 className="qz-start-title" style={{ fontSize: "1.75rem" }}>
            {title}
          </h1>
          <p className="qz-start-subtitle">Recapitulatif des {rows.length} questions</p>
        </div>
      </div>

      <div className="qz-recap-summary">
        <span className="qz-recap-pill qz-recap-pill-correct">
          {stats.correct} juste{stats.correct > 1 ? "s" : ""}
        </span>
        <span className="qz-recap-pill qz-recap-pill-wrong">{stats.wrong} faux</span>
        <span className="qz-recap-pill qz-recap-pill-unanswered">
          {stats.unanswered} non repondue{stats.unanswered > 1 ? "s" : ""}
        </span>
      </div>

      <div className="qz-recap-table-wrap">
        <table className="qz-recap-table">
          <thead>
            <tr>
              <th className="qz-recap-col-n">#</th>
              <th>Question</th>
              <th className="qz-recap-col-status">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`qz-recap-row-${r.status}`}>
                <td className="qz-recap-col-n">{r.n}</td>
                <td className="qz-recap-col-question">{r.question}</td>
                <td className="qz-recap-col-status">
                  <span className={`qz-recap-badge qz-recap-badge-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
