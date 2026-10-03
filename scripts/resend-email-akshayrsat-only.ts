/**
 * ONE live EMAIL to akshayrsat@gmail.com only.
 * Requires MSG91_LIVE_SEND=true briefly. Turn it off after.
 */
import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { deliverNotice, isLiveSendEnabled, dryRunReason } from "../src/lib/msg91";
import { emailNoticeVars, noticePublicUrl } from "../src/lib/notice-link";

const TO = "akshayrsat@gmail.com";

async function main() {
  const liveSend = await isLiveSendEnabled();
  console.log("LIVE_SEND enabled?", liveSend);
  if (!liveSend) {
    console.error(await dryRunReason());
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const notice = await prisma.publicNotice.findFirst({
      where: { customerName: { contains: "Akshay R" } },
      orderBy: { createdAt: "desc" },
    });
    const noticeNumber = notice?.noticeNumber?.trim() || "K3JX8ZQ69EMX";
    const loan = notice?.loanNumber?.trim() || "LN10022";
    const name = notice?.customerName?.trim() || "Akshay R Sathe";
    const vars = emailNoticeVars({
      customerName: name,
      loanAccount: loan,
      noticeNumber,
    });
    console.log("To:", TO);
    console.log("Vars:", vars);
    console.log("Public URL:", noticePublicUrl(noticeNumber));

    const result = await deliverNotice({
      channel: "EMAIL",
      to: TO,
      body: "",
      dltTemplateId: "",
      email: vars,
    });
    console.log(result.ok ? `OK providerId=${result.providerId}` : `FAIL ${result.error}`);
    if (!result.ok) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
