import { parseQuestionContent, getCorrectAnswerText } from "@/lib/question-resolver";
import { gradeAnswer } from "@/lib/grading";
import { correctFreeTextAnswer } from "@/lib/correction";
import type { QuestionType } from "@/lib/generated/prisma/enums";

type Mode = "ENTRAINEMENT" | "QCM" | "REPONSE_LIBRE";

interface QuestionRow {
  id: string;
  type: QuestionType;
  content: unknown;
}

export class InvalidAnswerError extends Error {}

// Grades a submitted answer against a question, reused by both the
// authenticated (/api/attempts) and guest (/api/share/[token]/attempts)
// submission routes — everything here is identity-agnostic.
// For QCM_SIMPLE/QCM_MULTIPLE, the exact list of correct proposition texts —
// used by the client to highlight choices. Kept as a real array rather than
// folded into correctAnswerText's joined string, since a proposition's own
// text can contain ", " and would otherwise split incorrectly on the client.
function getCorrectChoices(parsedContent: ReturnType<typeof parseQuestionContent>): string[] | undefined {
  switch (parsedContent.type) {
    case "QCM_SIMPLE":
      return [parsedContent.content.reponse_correcte];
    case "QCM_MULTIPLE":
      return parsedContent.content.reponses_correctes;
    default:
      return undefined;
  }
}

export async function gradeAttempt(
  question: QuestionRow,
  { mode, answer, text }: { mode: Mode; answer?: unknown; text?: string }
): Promise<{ isCorrect: boolean; feedback?: string; answerGiven: unknown; correctAnswerText: string; correctChoices?: string[] }> {
  if (mode === "REPONSE_LIBRE") {
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new InvalidAnswerError("Réponse texte manquante.");
    }
    const parsedContent = parseQuestionContent(question);
    const variables =
      parsedContent.type === "CALCUL" && typeof answer === "object" && answer !== null && "variables" in answer
        ? (answer as { variables: Record<string, number> }).variables
        : undefined;
    const correctAnswerText = getCorrectAnswerText(question, variables);
    const result = await correctFreeTextAnswer({
      enonce: parsedContent.content.enonce,
      reponseAttendue: correctAnswerText,
      reponseUtilisateur: text,
    });
    return { isCorrect: result.correcte, feedback: result.feedback, answerGiven: { text }, correctAnswerText };
  }

  const parsedContent = parseQuestionContent(question);
  let isCorrect: boolean;
  try {
    isCorrect = gradeAnswer(parsedContent, answer);
  } catch {
    throw new InvalidAnswerError("Réponse invalide pour ce type de question.");
  }
  const variables =
    parsedContent.type === "CALCUL" && typeof answer === "object" && answer !== null && "variables" in answer
      ? (answer as { variables: Record<string, number> }).variables
      : undefined;
  const correctAnswerText = getCorrectAnswerText(question, variables);
  return {
    isCorrect,
    feedback: parsedContent.content.explication,
    answerGiven: answer as object,
    correctAnswerText,
    correctChoices: getCorrectChoices(parsedContent),
  };
}
