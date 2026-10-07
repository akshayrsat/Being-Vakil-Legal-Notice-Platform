import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
await prisma.odrLiveSendSetting.upsert({
  where: { id: "odr-live-send" },
  create: { id: "odr-live-send", enabled: false },
  update: { enabled: false },
});
console.log("odr switch off");
await prisma.$disconnect();
