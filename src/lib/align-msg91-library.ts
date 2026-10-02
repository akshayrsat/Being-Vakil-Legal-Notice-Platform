// Puts the three MSG91 library rows in place and demotes leftover practice Approved templates.
// Does not reset passwords, banks, notices, or MSG91_LIVE_SEND.

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  DEMO_TEMPLATES,
  RETIRED_PRACTICE_DLT_IDS,
  RETIRED_PRACTICE_TEMPLATE_NAMES,
  demoTemplateWrite,
} from "./demo-templates";
import { TEMPLATE_APPROVED, TEMPLATE_DRAFT } from "./templates";

export function retiredPracticeTemplateWhere(): Prisma.NoticeTemplateWhereInput {
  return {
    status: TEMPLATE_APPROVED,
    OR: [
      { dltTemplateId: { in: [...RETIRED_PRACTICE_DLT_IDS] } },
      { name: { in: [...RETIRED_PRACTICE_TEMPLATE_NAMES] } },
    ],
  };
}

export async function alignMsg91Library(
  prisma: PrismaClient,
  options: { bankIdForNew: string; moveExistingToBank?: boolean },
): Promise<{ upserted: string[]; retired: number }> {
  const upserted: string[] = [];
  for (const template of DEMO_TEMPLATES) {
    const data = demoTemplateWrite(template);
    const existing = await prisma.noticeTemplate.findUnique({
      where: { seedKey: template.seedKey },
      select: { id: true },
    });
    if (existing) {
      await prisma.noticeTemplate.update({
        where: { seedKey: template.seedKey },
        data: options.moveExistingToBank ? { ...data, bankId: options.bankIdForNew } : data,
      });
    } else {
      await prisma.noticeTemplate.create({
        data: { ...data, seedKey: template.seedKey, bankId: options.bankIdForNew },
      });
    }
    upserted.push(template.name);
  }

  const retired = await prisma.noticeTemplate.updateMany({
    where: retiredPracticeTemplateWhere(),
    data: { status: TEMPLATE_DRAFT },
  });

  return { upserted, retired: retired.count };
}
