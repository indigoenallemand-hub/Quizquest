/**
 * Appends one chapter (Theme + its questions) to an EXISTING quiz, at the last
 * position — unlike migrate-json.ts, which creates a whole new quiz.
 *
 * The chapter file uses the same shape as one entry of `themes` in the
 * /api/import format: { title, description?, questions: [...] }.
 *
 * Usage:
 *   npx tsx scripts/add-chapter.ts --quiz=immobase --file=scripts/data/immobase_communication.json            # dry run
 *   npx tsx scripts/add-chapter.ts --quiz=immobase --file=scripts/data/immobase_communication.json --execute  # writes
 *
 * --quiz matches the quiz title case-insensitively (substring); it must match
 * exactly one quiz. Refuses to run if that quiz already has a chapter with the
 * same title, so re-running it can't create a duplicate.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { themeImportSchema } from "@/lib/schemas";

const EXECUTE = process.argv.includes("--execute");
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const quizQuery = arg("quiz");
const file = arg("file");

async function main() {
  if (!quizQuery || !file) {
    console.error("Usage: npx tsx scripts/add-chapter.ts --quiz=<titre> --file=<chapitre.json> [--execute]");
    process.exitCode = 1;
    return;
  }

  const parsed = themeImportSchema.safeParse(JSON.parse(fs.readFileSync(path.resolve(file), "utf-8")));
  if (!parsed.success) {
    console.error("Validation échouée :", JSON.stringify(parsed.error.flatten(), null, 2));
    process.exitCode = 1;
    return;
  }
  const chapter = parsed.data;

  // Sanity check the schema can't express: the correct answers must be among the propositions.
  for (const [i, q] of chapter.questions.entries()) {
    if (q.type === "QCM_SIMPLE" && !q.content.propositions.includes(q.content.reponse_correcte)) {
      throw new Error(`Question ${i + 1}: reponse_correcte absente des propositions.`);
    }
    if (q.type === "QCM_MULTIPLE" && !q.content.reponses_correctes.every((r) => q.content.propositions.includes(r))) {
      throw new Error(`Question ${i + 1}: une des reponses_correctes est absente des propositions.`);
    }
  }

  const quizzes = await prisma.quiz.findMany({
    where: { title: { contains: quizQuery, mode: "insensitive" } },
    select: {
      id: true,
      title: true,
      creator: { select: { email: true } },
      themes: { select: { order: true, theme: { select: { title: true } } }, orderBy: { order: "asc" } },
    },
  });
  if (quizzes.length !== 1) {
    console.error(`"${quizQuery}" correspond à ${quizzes.length} quiz (1 attendu) :`);
    for (const q of quizzes) console.error(`  - ${q.title} (${q.id}, ${q.creator.email})`);
    process.exitCode = 1;
    return;
  }
  const quiz = quizzes[0];

  if (quiz.themes.some((t) => t.theme.title.trim().toLowerCase() === chapter.title.trim().toLowerCase())) {
    console.error(`Le quiz "${quiz.title}" contient déjà un chapitre "${chapter.title}". Rien n'a été modifié.`);
    process.exitCode = 1;
    return;
  }

  const nextOrder = quiz.themes.reduce((max, t) => Math.max(max, t.order + 1), 0);
  const counts = chapter.questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.type] = (acc[q.type] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Quiz cible : "${quiz.title}" (${quiz.id}, créateur ${quiz.creator.email})`);
  console.log(`Chapitres existants (${quiz.themes.length}) : ${quiz.themes.map((t) => t.theme.title).join(" | ")}`);
  console.log(`Chapitre à ajouter : "${chapter.title}" en position ${nextOrder}, ${chapter.questions.length} questions ${JSON.stringify(counts)}`);

  if (!EXECUTE) {
    console.log("\nDry run (par défaut) : rien n'a été écrit en base. Relancez avec --execute pour importer.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const theme = await tx.theme.create({
      data: { title: chapter.title, description: chapter.description, quizzes: { create: { quizId: quiz.id, order: nextOrder } } },
    });
    await tx.question.createMany({
      data: chapter.questions.map((q) => ({ themeId: theme.id, type: q.type, content: q.content, section: q.section })),
    });
  });

  console.log(`\nChapitre "${chapter.title}" ajouté au quiz "${quiz.title}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
