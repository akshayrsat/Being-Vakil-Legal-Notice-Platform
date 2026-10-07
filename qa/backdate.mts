import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const when = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
await prisma.odrCase.update({
  where: { id: "cmuy4sb2s000mjs2qqwqrnmy8" },
  data: { firstNoticeAt: when },
});
console.log("backdated", when.toISOString());
await prisma.$disconnect();
