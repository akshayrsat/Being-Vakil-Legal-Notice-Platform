import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
await prisma.odrSettings.upsert({
  where: { id: "odr-settings" },
  create: { id: "odr-settings", sendWindowStart: "00:00", sendWindowEnd: "23:59" },
  update: { sendWindowStart: "00:00", sendWindowEnd: "23:59" },
});
await prisma.odrMessage.updateMany({
  where: { status: "QUEUED", detail: { contains: "send window" } },
  data: { notBefore: null, detail: "" },
});
console.log("window open for the test");
await prisma.$disconnect();
