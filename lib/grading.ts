import { z } from "zod";
import type { ParsedContent } from "@/lib/question-resolver";
import { evaluateFormula, isCalcAnswerCorrect } from "@/lib/calc";

export const qcmSimpleAnswerSchema = z.object({ selected: z.string() });
export const qcmMultipleAnswerSchema = z.object({ selected: z.array(z.string()) });
export const dateAnswerSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export const calculAnswerSchema = z.object({
  value: z.number(),
  variables: z.record(z.string(), z.number()),
});

function dayDiff(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(da - db) / 86_400_000;
}

// Deterministic grading for QCM/DATE/CALCUL answers (everything except
// REPONSE_LIBRE mode, which is graded by the AI correction endpoint instead).
export function gradeAnswer(parsed: ParsedContent, rawAnswer: unknown): boolean {
  switch (parsed.type) {
    case "QCM_SIMPLE": {
      const { selected } = qcmSimpleAnswerSchema.parse(rawAnswer);
      return selected === parsed.content.reponse_correcte;
    }
    case "QCM_MULTIPLE": {
      const { selected } = qcmMultipleAnswerSchema.parse(rawAnswer);
      const expected = new Set(parsed.content.reponses_correctes);
      const given = new Set(selected);
      if (expected.size !== given.size) return false;
      for (const item of expected) if (!given.has(item)) return false;
      return true;
    }
    case "DATE": {
      const { date } = dateAnswerSchema.parse(rawAnswer);
      return dayDiff(date, parsed.content.reponse_correcte) <= parsed.content.tolerance_jours;
    }
    case "CALCUL": {
      const { value, variables } = calculAnswerSchema.parse(rawAnswer);
      const expected = evaluateFormula(parsed.content, variables);
      return isCalcAnswerCorrect(parsed.content, expected, value);
    }
  }
}
