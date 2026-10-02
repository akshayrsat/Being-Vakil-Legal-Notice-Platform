// Creates the practice users, the practice banks, and two practice notice templates.
// Running this again sets the practice passwords back, and resets the practice banks.
// Banks you add yourself, with a different short code, are left alone.
// The bank viewer is always tied to the practice bank marked forViewer.
// The practice templates are always put back on that same bank. Templates you add stay.

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEMO_BANKS } from "../src/lib/demo-banks";
import { DEMO_ACCOUNTS } from "../src/lib/demo-accounts";
import { DEMO_TEMPLATES } from "../src/lib/demo-templates";
import { ROLE_BANK_VIEWER } from "../src/lib/roles";

const prisma = new PrismaClient();

async function main() {
  const viewerBank = DEMO_BANKS.find((bank) => bank.forViewer);
  if (!viewerBank) {
    throw new Error("Mark one practice bank with forViewer so the bank viewer has a bank.");
  }

  const savedBanks = new Map<string, string>();
  for (const bank of DEMO_BANKS) {
    const saved = await prisma.bank.upsert({
      where: { code: bank.code },
      update: {
        name: bank.name,
        active: bank.active,
      },
      create: {
        name: bank.name,
        code: bank.code,
        active: bank.active,
      },
    });
    savedBanks.set(bank.code, saved.id);
  }

  const viewerBankId = savedBanks.get(viewerBank.code);
  if (!viewerBankId) {
    throw new Error("The bank viewer’s practice bank was not saved.");
  }

  for (const account of DEMO_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    const bankId = account.role === ROLE_BANK_VIEWER ? viewerBankId : null;

    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        role: account.role,
        passwordHash,
        bankId,
      },
      create: {
        name: account.name,
        email: account.email,
        role: account.role,
        passwordHash,
        bankId,
      },
    });
  }

  console.log("Practice users are ready.");
  for (const account of DEMO_ACCOUNTS) {
    console.log(`  ${account.role}: ${account.email}`);
  }
  for (const template of DEMO_TEMPLATES) {
    const data = {
      bankId: viewerBankId,
      name: template.name,
      dltTemplateId: template.dltTemplateId,
      channels: JSON.stringify(template.channels),
      body: template.body,
      status: template.status,
    };
    await prisma.noticeTemplate.upsert({
      where: { seedKey: template.seedKey },
      update: data,
      create: { ...data, seedKey: template.seedKey },
    });
  }

  console.log("Practice banks are ready.");
  for (const bank of DEMO_BANKS) {
    const status = bank.active ? "active" : "inactive";
    const viewer = bank.forViewer ? " (bank viewer)" : "";
    console.log(`  ${bank.code}: ${bank.name} — ${status}${viewer}`);
  }
  console.log("Practice templates are ready for the bank viewer’s bank.");
  for (const template of DEMO_TEMPLATES) {
    console.log(`  ${template.name}`);
  }
  console.log("Passwords are listed in the README.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
