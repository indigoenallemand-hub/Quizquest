import {
  qcmSimpleContentSchema,
  qcmMultipleContentSchema,
  dateContentSchema,
  calculContentSchema,
  type QcmSimpleContent,
  type QcmMultipleContent,
  type DateContent,
  type CalculContent,
} from "@/lib/schemas";
import { generateVariables, renderEnonce, evaluateFormula } from "@/lib/calc";
import type { QuestionType } from "@/lib/generated/prisma/enums";

interface QuestionRow {
  id: string;
  type: QuestionType;
  content: unknown;
  section?: string | null;
}

export type ParsedContent =
  | { type: "QCM_SIMPLE"; content: QcmSimpleContent }
  | { type: "QCM_MULTIPLE"; content: QcmMultipleContent }
  | { type: "DATE"; content: DateContent }
  | { type: "CALCUL"; content: CalculContent };

export function parseQuestionContent(question: QuestionRow): ParsedContent {
  switch (question.type) {
    case "QCM_SIMPLE":
      return { type: "QCM_SIMPLE", content: qcmSimpleContentSchema.parse(question.content) };
    case "QCM_MULTIPLE":
      return { type: "QCM_MULTIPLE", content: qcmMultipleContentSchema.parse(question.content) };
    case "DATE":
      return { type: "DATE", content: dateContentSchema.parse(question.content) };
    case "CALCUL":
      return { type: "CALCUL", content: calculContentSchema.parse(question.content) };
  }
}

// What the client is allowed to see before answering: never the answer key,
// never the CALCUL formula. For CALCUL questions, fresh random variables are
// generated here (server-side) and returned so the client can render them —
// the client must echo them back unchanged when submitting its answer.
export function getPublicView(question: QuestionRow) {
  const parsed = parseQuestionContent(question);

  const section = question.section ?? null;

  switch (parsed.type) {
    case "QCM_SIMPLE":
      return {
        id: question.id,
        type: parsed.type,
        section,
        enonce: parsed.content.enonce,
        propositions: parsed.content.propositions,
      };
    case "QCM_MULTIPLE":
      return {
        id: question.id,
        type: parsed.type,
        section,
        enonce: parsed.content.enonce,
        propositions: parsed.content.propositions,
      };
    case "DATE":
      return {
        id: question.id,
        type: parsed.type,
        section,
        enonce: parsed.content.enonce,
      };
    case "CALCUL": {
      const variables = generateVariables(parsed.content);
      return {
        id: question.id,
        type: parsed.type,
        section,
        enonce: renderEnonce(parsed.content.enonce, variables, parsed.content),
        variables,
        uniteReponse: parsed.content.unite_reponse ?? null,
        arrondiReponse: parsed.content.arrondi_reponse,
      };
    }
  }
}

// Human-readable "correct answer" text, used both to display an explanation
// after grading and as the reference answer fed to the AI correction prompt.
export function getCorrectAnswerText(question: QuestionRow, variables?: Record<string, number>): string {
  const parsed = parseQuestionContent(question);
  switch (parsed.type) {
    case "QCM_SIMPLE":
      return parsed.content.reponse_correcte;
    case "QCM_MULTIPLE":
      return parsed.content.reponses_correctes.join(", ");
    case "DATE":
      return parsed.content.reponse_correcte;
    case "CALCUL": {
      const vars = variables ?? generateVariables(parsed.content);
      const expected = evaluateFormula(parsed.content, vars);
      const unite = parsed.content.unite_reponse ? ` ${parsed.content.unite_reponse}` : "";
      return `${expected}${unite}`;
    }
  }
}
