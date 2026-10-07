// Creates the practice users, the practice banks, the three MSG91 library templates,
// and three practice public notices.
// Running this again sets the practice passwords back, and resets the practice banks.
// Banks you add yourself, with a different short code, are left alone.
// The bank viewer is always tied to the practice bank marked forViewer.
// The MSG91 templates are marked Approved so every bank can select that wording.
// A missing row is created on the bank viewer’s bank, because a template needs a
// bank row. Existing rows stay where they are, and the templates page does not
// credit that bank. The same seed keys are updated in place.
// Templates you add on a real bank stay. Practice rows that nothing uses are
// removed. This does not turn MSG91_LIVE_SEND on.

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEMO_BANKS } from "../src/lib/demo-banks";
import { DEMO_ACCOUNTS } from "../src/lib/demo-accounts";
import { demandNoticePlainText } from "../src/lib/demand-notice";
import { DEMO_NOTICES } from "../src/lib/demo-notices";
import { noticePageHref } from "../src/lib/notice-link";
import { alignMsg91Library } from "../src/lib/align-msg91-library";
import { ensureStarterLegalNotice } from "../src/lib/legal-notice-templates";
import { clearCoordinatorBankLinks } from "../src/lib/coordinator-bank";
import { isBankUser } from "../src/lib/roles";

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
    const bankId = isBankUser(account.role) ? viewerBankId : null;

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

  const cleared = await clearCoordinatorBankLinks(prisma);
  if (cleared > 0) console.log(`Cleared a bank link on ${cleared} legal coordinator login(s).`);

  console.log("Practice users are ready.");
  for (const account of DEMO_ACCOUNTS) {
    console.log(`  ${account.role}: ${account.email}`);
  }
  const library = await alignMsg91Library(prisma, {
    bankIdForNew: viewerBankId,
    moveExistingToBank: false,
  });

  console.log("Practice banks are ready.");
  for (const bank of DEMO_BANKS) {
    const status = bank.active ? "active" : "inactive";
    const viewer = bank.forViewer ? " (bank viewer)" : "";
    console.log(`  ${bank.code}: ${bank.name} — ${status}${viewer}`);
  }
  console.log("MSG91 templates are Approved for every bank.");
  for (const name of library.upserted) {
    console.log(`  ${name}`);
  }
  if (library.retired > 0) {
    console.log(`Moved ${library.retired} practice template(s) out of Approved.`);
  }
  if (library.deleted > 0) {
    console.log(`Deleted ${library.deleted} unreferenced practice template(s).`);
  }

  await ensureStarterLegalNotice(prisma);
  console.log("Legal notice template is ready: Legal notice.");

  for (const notice of DEMO_NOTICES) {
    const data = {
      bankId: viewerBankId,
      noticeNumber: notice.noticeNumber,
      customerName: notice.customerName,
      address: notice.address,
      loanAmount: notice.loanAmount,
      outstandingAmount: notice.outstandingAmount,
      loanNumber: notice.loanNumber,
      customerId: notice.customerId,
      loanType: notice.loanType,
      referenceNumber: notice.referenceNumber,
      collectionManager: notice.collectionManager,
      collectionManagerMobile: notice.collectionManagerMobile,
      bankWebsite: notice.bankWebsite,
      bankName: viewerBank.name,
      body: demandNoticePlainText({
        customerName: notice.customerName,
        address: notice.address,
        outstandingAmount: notice.outstandingAmount,
        loanNumber: notice.loanNumber,
        bankName: viewerBank.name,
        loanType: notice.loanType,
        referenceNumber: notice.referenceNumber,
        collectionManager: notice.collectionManager,
        collectionManagerMobile: notice.collectionManagerMobile,
        bankWebsite: notice.bankWebsite,
        noticeNumber: notice.noticeNumber,
        dated: new Date(),
      }),
    };
    await prisma.publicNotice.upsert({
      where: { seedKey: notice.seedKey },
      update: data,
      create: { ...data, seedKey: notice.seedKey },
    });
  }
  console.log("Practice notice pages are ready.");
  for (const notice of DEMO_NOTICES) {
    console.log(`  ${notice.customerName}: ${noticePageHref(notice.noticeNumber)}`);
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
