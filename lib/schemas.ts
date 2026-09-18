import { z } from "zod";

export const qcmSimpleContentSchema = z.object({
  enonce: z.string().min(1),
  propositions: z.array(z.string().min(1)).min(2),
  reponse_correcte: z.string().min(1),
  explication: z.string().optional(),
});
export type QcmSimpleContent = z.infer<typeof qcmSimpleContentSchema>;

export const qcmMultipleContentSchema = z.object({
  enonce: z.string().min(1),
  propositions: z.array(z.string().min(1)).min(2),
  reponses_correctes: z.array(z.string().min(1)).min(1),
  explication: z.string().optional(),
});
export type QcmMultipleContent = z.infer<typeof qcmMultipleContentSchema>;

export const dateContentSchema = z.object({
  enonce: z.string().min(1),
  reponse_correcte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu AAAA-MM-JJ"),
  tolerance_jours: z.number().int().min(0).default(0),
  explication: z.string().optional(),
});
export type DateContent = z.infer<typeof dateContentSchema>;

export const calculVariableSchema = z.object({
  nom: z.string().min(1),
  min: z.number(),
  max: z.number(),
  unite: z.string().optional(),
  arrondi: z.number().int().min(0).default(0),
});

export const calculContentSchema = z.object({
  enonce: z.string().min(1),
  variables: z.array(calculVariableSchema).min(1),
  formule: z.string().min(1),
  unite_reponse: z.string().optional(),
  arrondi_reponse: z.number().int().min(0).default(2),
  tolerance: z.number().min(0).default(0.01),
  explication: z.string().optional(),
});
export type CalculContent = z.infer<typeof calculContentSchema>;

export const questionTypeEnum = z.enum(["QCM_SIMPLE", "QCM_MULTIPLE", "DATE", "CALCUL"]);

// Discriminates on question type to validate `content` against the right shape.
export const questionInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("QCM_SIMPLE"), content: qcmSimpleContentSchema, section: z.string().optional() }),
  z.object({ type: z.literal("QCM_MULTIPLE"), content: qcmMultipleContentSchema, section: z.string().optional() }),
  z.object({ type: z.literal("DATE"), content: dateContentSchema, section: z.string().optional() }),
  z.object({ type: z.literal("CALCUL"), content: calculContentSchema, section: z.string().optional() }),
]);
export type QuestionInput = z.infer<typeof questionInputSchema>;

export const themeImportSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(questionInputSchema).min(1),
});

export const quizImportSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  status: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
  themes: z.array(themeImportSchema).min(1),
});
export type QuizImport = z.infer<typeof quizImportSchema>;
