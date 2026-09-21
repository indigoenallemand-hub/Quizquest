import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { parseQuestionContent } from "@/lib/question-resolver";
import { buildThemeStyle } from "@/lib/quiz-theme-style";

function questionText(question: Parameters<typeof parseQuestionContent>[0]): string {
  if (question.type === "CALCUL") return "Question de calcul generee aleatoirement.";
  return parseQuestionContent(question).content.enonce;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export default async function QuizCommentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect(`/login`);

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      creatorId: true,
      themeColors: true,
      guestLinks: { select: { id: true, guestName: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!quiz || quiz.creatorId !== userId) notFound();

  const attempts = await prisma.attempt.findMany({
    where: { question: { theme: { quizzes: { some: { quizId: id } } } }, comment: { not: null } },
    select: {
      id: true,
      comment: true,
      createdAt: true,
      guestAccessId: true,
      question: { select: { id: true, type: true, content: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const guestNameById = new Map(quiz.guestLinks.map((l) => [l.id, l.guestName]));

  const rows = attempts.map((a) => ({
    id: a.id,
    comment: a.comment!,
    createdAt: a.createdAt,
    guestName: a.guestAccessId ? (guestNameById.get(a.guestAccessId) ?? "Invite sans nom") : null,
    question: questionText(a.question),
  }));

  return (
    <div
      className="mx-auto w-full max-w-4xl px-6 py-10"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem", ...buildThemeStyle(quiz.themeColors) }}
    >
      <div>
        <Link href={`/quizzes/${quiz.id}`} className="qz-btn-quit" style={{ display: "inline-block" }}>
          Retour au quiz
        </Link>
        <div className="qz-start-header" style={{ marginTop: "0.5rem" }}>
          <h1 className="qz-start-title" style={{ fontSize: "1.75rem" }}>
            {quiz.title}
          </h1>
          <p className="qz-start-subtitle">
            {rows.length} commentaire{rows.length > 1 ? "s" : ""} laisse{rows.length > 1 ? "s" : ""} par les invites
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-zinc-600">Aucun commentaire pour l&apos;instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {rows.map((r) => (
            <div key={r.id} className="qz-question-card" style={{ padding: "1.25rem" }}>
              <p className="qz-question-text" style={{ fontSize: "0.9375rem", opacity: 0.75, paddingRight: 0 }}>
                {r.question}
              </p>
              <p style={{ marginTop: "0.75rem", fontSize: "1rem", color: "var(--qz-text)" }}>{r.comment}</p>
              <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--qz-muted)" }}>
                {r.guestName ? `${r.guestName} - ` : ""}
                {dateFormatter.format(r.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
