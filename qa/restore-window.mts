import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
await prisma.odrSettings.update({
  where: { id: "odr-settings" },
  data: { sendWindowStart: "09:00", sendWindowEnd: "18:30" },
});
console.log("restored");
await prisma.$disconnect();
