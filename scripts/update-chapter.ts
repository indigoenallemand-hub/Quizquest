/**
 * Updates, in place, the questions of a chapter previously added with
 * add-chapter.ts, from the (edited) chapter file. Questions are matched by
 * their `enonce`, so their ids — and the attempts/comments attached to them —
 * are kept. Only questions whose content or section actually changed are
 * written; questions present in the file but not in the chapter (or the
 * reverse) are reported and left untouched.
 *
 * Usage:
 *   npx tsx scripts/update-chapter.ts --quiz=immobase --file=scripts/data/immobase_communication.json            # dry run
 *   npx tsx scripts/update-chapter.ts --quiz=immobase --file=scripts/data/immobase_communication.json --execute  # writes
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@/lib/prisma";
import { themeImportSchema } from "@/lib/schemas";

const EXECUTE = process.argv.includes("--execute");
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const quizQuery = arg("quiz");
const file = arg("file");

async function main() {
  if (!quizQuery || !file) {
    console.error("Usage: npx tsx scripts/update-chapter.ts --quiz=<titre> --file=<chapitre.json> [--execute]");
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

  const quizzes = await prisma.quiz.findMany({
    where: { title: { contains: quizQuery, mode: "insensitive" } },
    select: { id: true, title: true, themes: { select: { theme: { select: { id: true, title: true } } } } },
  });
  if (quizzes.length !== 1) {
    console.error(`"${quizQuery}" correspond à ${quizzes.length} quiz (1 attendu).`);
    process.exitCode = 1;
    return;
  }
  const quiz = quizzes[0];
  const theme = quiz.themes.find((t) => t.theme.title.trim().toLowerCase() === chapter.title.trim().toLowerCase())?.theme;
  if (!theme) {
    console.error(`Aucun chapitre "${chapter.title}" dans le quiz "${quiz.title}".`);
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.question.findMany({ where: { themeId: theme.id }, select: { id: true, type: true, content: true, section: true } });
  const byEnonce = new Map(existing.map((q) => [(q.content as { enonce: string }).enonce, q]));

  const updates: { id: string; content: object; section: string | undefined }[] = [];
  const missing: string[] = [];
  for (const q of chapter.questions) {
    const current = byEnonce.get(q.content.enonce);
    if (!current || current.type !== q.type) {
      missing.push(q.content.enonce);
      continue;
    }
    byEnonce.delete(q.content.enonce);
    if (!isDeepStrictEqual(current.content, q.content) || (current.section ?? undefined) !== q.section) {
      updates.push({ id: current.id, content: q.content, section: q.section });
    }
  }

  console.log(`Chapitre "${theme.title}" du quiz "${quiz.title}" : ${existing.length} questions en base, ${updates.length} à mettre à jour.`);
  if (missing.length) console.log(`Introuvables en base (ignorées) :\n  - ${missing.join("\n  - ")}`);
  if (byEnonce.size) console.log(`En base mais absentes du fichier (inchangées) :\n  - ${[...byEnonce.keys()].join("\n  - ")}`);

  if (!EXECUTE) {
    console.log("\nDry run (par défaut) : rien n'a été écrit en base. Relancez avec --execute pour mettre à jour.");
    return;
  }

  await prisma.$transaction(
    updates.map((u) => prisma.question.update({ where: { id: u.id }, data: { content: u.content, section: u.section } })),
  );
  console.log(`\n${updates.length} questions mises à jour.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
