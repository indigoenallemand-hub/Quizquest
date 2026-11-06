/**
 * Lists every account (email, name, creation date), oldest first. Read-only.
 *
 * Usage:
 *   npx tsx scripts/list-users.ts                                        # local DB
 *   npx tsx --env-file=.env.production.local scripts/list-users.ts       # production
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  for (const u of users) {
    console.log(`${u.email}\t${u.name ?? ""}\t${u.createdAt.toISOString().slice(0, 10)}`);
  }
  console.log(`\n${users.length} compte(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
