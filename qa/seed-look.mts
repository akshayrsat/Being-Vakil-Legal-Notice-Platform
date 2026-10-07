import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const neutrals = await prisma.odrNeutral.findMany({
  select: { id: true, name: true, roles: true, email: true, mobile: true, active: true },
});
const item = await prisma.odrCase.findFirst({
  select: { id: true, refNo: true, bankId: true, publicToken: true, status: true, mobile: true, email: true },
});
console.log(JSON.stringify({ neutrals, item }, null, 2));
await prisma.$disconnect();
