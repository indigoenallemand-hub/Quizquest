import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("Seed: nothing to do yet. Use the JSON migration script (scripts/migrate-json.ts) to import questions.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
