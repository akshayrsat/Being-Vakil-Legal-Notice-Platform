import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = await prisma.odrMessage.findMany({
  where: { case: { customerName: { in: ["Mediation Mina", "Ravi Good"] } } },
  select: {
    channel: true,
    kind: true,
    status: true,
    detail: true,
    toAddress: true,
    case: { select: { customerName: true, matterType: true } },
  },
  orderBy: { createdAt: "asc" },
});
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
