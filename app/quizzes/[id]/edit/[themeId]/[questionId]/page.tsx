import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { userOwnsThemeQuiz } from "@/lib/question-ownership";
import { buildThemeStyle } from "@/lib/quiz-theme-style";
import { parseQuestionContent } from "@/lib/question-resolver";
import QuestionEditForm from "@/components/QuestionEditForm";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string; themeId: string; questionId: string }>;
}) {
  const { id, themeId, questionId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsThemeQuiz(userId, themeId))) notFound();

  const [quiz, question] = await Promise.all([
    prisma.quiz.findUnique({ where: { id }, select: { themeColors: true } }),
    prisma.question.findUnique({ where: { id: questionId } }),
  ]);
  if (!quiz || !question || question.themeId !== themeId) notFound();

  const parsed = parseQuestionContent(question);
  const backHref = `/quizzes/${id}/edit/${themeId}`;
  const section = question.section ?? "";

  const base = {
    questionId: question.id,
    section,
    propositions: ["", ""],
    correctIndex: null as number | null,
    correctIndexes: [] as number[],
    dateCorrect: "",
    toleranceJours: "0",
    variables: [{ nom: "", min: "", max: "", unite: "", arrondi: "0" }],
    formule: "",
    uniteReponse: "",
    arrondiReponse: "2",
    tolerance: "0.01",
  };

  const initial =
    parsed.type === "QCM_SIMPLE"
      ? {
          ...base,
          type: "QCM_SIMPLE" as const,
          enonce: parsed.content.enonce,
          explication: parsed.content.explication ?? "",
          propositions: parsed.content.propositions,
          correctIndex: parsed.content.propositions.indexOf(parsed.content.reponse_correcte),
        }
      : parsed.type === "QCM_MULTIPLE"
        ? {
            ...base,
            type: "QCM_MULTIPLE" as const,
            enonce: parsed.content.enonce,
            explication: parsed.content.explication ?? "",
            propositions: parsed.content.propositions,
            correctIndexes: parsed.content.reponses_correctes
              .map((r) => parsed.content.propositions.indexOf(r))
              .filter((i) => i !== -1),
          }
        : parsed.type === "DATE"
          ? {
              ...base,
              type: "DATE" as const,
              enonce: parsed.content.enonce,
              explication: parsed.content.explication ?? "",
              dateCorrect: parsed.content.reponse_correcte,
              toleranceJours: String(parsed.content.tolerance_jours),
            }
          : {
              ...base,
              type: "CALCUL" as const,
              enonce: parsed.content.enonce,
              explication: parsed.content.explication ?? "",
              variables: parsed.content.variables.map((v) => ({
                nom: v.nom,
                min: String(v.min),
                max: String(v.max),
                unite: v.unite ?? "",
                arrondi: String(v.arrondi),
              })),
              formule: parsed.content.formule,
              uniteReponse: parsed.content.unite_reponse ?? "",
              arrondiReponse: String(parsed.content.arrondi_reponse),
              tolerance: String(parsed.content.tolerance),
            };

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
          Modifier la question
        </h1>
      </div>

      <QuestionEditForm themeId={themeId} backHref={backHref} initial={initial} />
    </div>
  );
}
