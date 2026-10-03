// Safe to run twice. Keeps the three live MSG91 templates Approved, with their
// live ids, in the database named by DATABASE_URL (local SQLite or Cloud SQL).
// Does not present them as written for a practice bank: the app lists them as
// the firm library. Deletes unreferenced practice template rows. A practice
// template that a send or notice already uses is taken out of Approved and left
// in place. Does not delete banks, people, notices, passwords, or campaigns,
// and does not change MSG91_LIVE_SEND.
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
  console.log("MSG91 library rows are Approved for every bank:");
  for (const name of result.upserted) console.log(`  ${name}`);
  console.log(
    result.retired === 0
      ? "No practice template still needed to stay out of Approved."
      : `Moved ${result.retired} practice template(s) out of Approved. Sends that use them were left in place.`,
  );
  console.log(
    result.deleted === 0
      ? "No unreferenced practice templates to delete."
      : `Deleted ${result.deleted} unreferenced practice template(s).`,
  );
  console.log("Passwords, banks, people, notices, campaigns, and MSG91_LIVE_SEND were not changed.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
