// One-shot, safe to run again. Updates the Approved MSG91 library rows in the
// database named by DATABASE_URL (local SQLite or Cloud SQL).
// Does not reset passwords, practice banks, notices, or MSG91_LIVE_SEND.
//
//   npx tsx scripts/align-msg91-library.ts

import { PrismaClient } from "@prisma/client";
import { alignMsg91Library } from "../src/lib/align-msg91-library";
import { DEMO_BANKS } from "../src/lib/demo-banks";
import { DEMO_TEMPLATES } from "../src/lib/demo-templates";

const prisma = new PrismaClient();

async function main() {
  const viewer = DEMO_BANKS.find((bank) => bank.forViewer);
  if (!viewer) {
    throw new Error("Mark one practice bank with forViewer so a missing library row has a home bank.");
  }

  const existing = await prisma.noticeTemplate.findMany({
    where: { seedKey: { in: DEMO_TEMPLATES.map((template) => template.seedKey) } },
    select: { seedKey: true, bankId: true, name: true },
  });
  const home =
    existing[0]?.bankId ??
    (
      await prisma.bank.findUnique({
        where: { code: viewer.code },
        select: { id: true },
      })
    )?.id;

  if (!home) {
    throw new Error(
      `No bank ${viewer.code} found, and no library row to attach to. Run the full seed on a new database.`,
    );
  }

  const result = await alignMsg91Library(prisma, { bankIdForNew: home, moveExistingToBank: false });
  console.log("MSG91 library rows are Approved:");
  for (const name of result.upserted) console.log(`  ${name}`);
  console.log(
    result.retired === 0
      ? "No leftover practice Approved templates."
      : `Moved ${result.retired} leftover practice template(s) to Draft.`,
  );
  console.log("Passwords, banks, notices, and MSG91_LIVE_SEND were not changed.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
