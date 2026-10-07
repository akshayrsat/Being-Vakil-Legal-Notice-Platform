import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  where: { email: { contains: "qa." } },
  select: { email: true, role: true, bankId: true, name: true },
});
const item = await prisma.odrCase.findFirst({
  where: { refNo: "QA-REF-965719" },
  select: {
    id: true,
    status: true,
    noShowCount: true,
    exParte: true,
    flaggedExParte: true,
    mobile: true,
    email: true,
    publicToken: true,
  },
});
const hearings = item
  ? await prisma.odrHearing.findMany({
      where: { caseId: item.id },
      select: { number: true, attendance: true, meetFake: true, meetLink: true, scheduledAt: true },
    })
  : [];
const dup = await prisma.odrCase.findMany({
  where: { accountNumber: "LN8801777" },
  select: { refNo: true, customerName: true, bankId: true },
});
const bad = await prisma.odrCase.findMany({
  where: { customerName: "Bad Contact" },
  select: { refNo: true, mobile: true, email: true },
});
console.log(JSON.stringify({ users, item, hearings, dup, bad }, null, 2));
await prisma.$disconnect();
