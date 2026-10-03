// Puts the three MSG91 library rows in place and removes leftover practice templates.
// Does not reset passwords, banks, notices, campaigns, or MSG91_LIVE_SEND.
// A practice row that a send already uses is taken out of Approved and left in place.
// An unreferenced practice row is deleted. Running this again changes nothing further.

import type { PrismaClient } from "@prisma/client";
import { DEMO_BANKS } from "./demo-banks";
import {
  DEMO_TEMPLATES,
  matchesRetiredPracticeIdentity,
  demoTemplateWrite,
  type DemoTemplate,
} from "./demo-templates";
import { TEMPLATE_DRAFT } from "./templates";

const LIVE_DLT_IDS = new Set(DEMO_TEMPLATES.map((template) => template.dltTemplateId));
const LIVE_SEED_KEYS = new Set(DEMO_TEMPLATES.map((template) => template.seedKey));

export type PracticeTemplateRow = {
  id: string;
  bankCode: string;
  name: string;
  dltTemplateId: string;
  seedKey: string | null;
  status: string;
  referenced: boolean;
};

export function isDemoBankCode(code: string): boolean {
  const trimmed = code.trim();
  return DEMO_BANKS.some((bank) => bank.code === trimmed);
}

// A leftover is not one of the three live rows. Retired names, fake DLT ids,
// any other template stored on a practice bank, and a second copy of a live id.
export function isRemovablePracticeTemplate(
  row: {
    id: string;
    bankCode: string;
    name: string;
    dltTemplateId: string;
    seedKey: string | null;
  },
  canonicalIds: ReadonlySet<string>,
): boolean {
  if (canonicalIds.has(row.id)) return false;
  if (matchesRetiredPracticeIdentity(row)) return true;
  if (isDemoBankCode(row.bankCode)) return true;
  const seed = (row.seedKey ?? "").trim();
  if (seed && LIVE_SEED_KEYS.has(seed)) return true;
  const dlt = row.dltTemplateId.trim();
  return Boolean(dlt) && LIVE_DLT_IDS.has(dlt);
}

export function practiceTemplateDisposition(
  row: PracticeTemplateRow,
  canonicalIds: ReadonlySet<string>,
): "keep" | "retire" | "delete" {
  if (!isRemovablePracticeTemplate(row, canonicalIds)) return "keep";
  if (row.referenced) {
    return row.status.trim().toUpperCase() === TEMPLATE_DRAFT ? "keep" : "retire";
  }
  return "delete";
}

function chooseCanonical<T extends { id: string; seedKey: string | null; dltTemplateId: string; campaigns: number }>(
  rows: readonly T[],
  template: DemoTemplate,
  taken: ReadonlySet<string>,
): T | undefined {
  const available = rows.filter((row) => !taken.has(row.id));
  const bySeed = available.find((row) => row.seedKey === template.seedKey);
  if (bySeed) return bySeed;
  const byDlt = available.filter((row) => row.dltTemplateId.trim() === template.dltTemplateId);
  return byDlt.find((row) => row.campaigns > 0) ?? byDlt[0];
}

export async function alignMsg91Library(
  prisma: PrismaClient,
  options: { bankIdForNew: string; moveExistingToBank?: boolean },
): Promise<{ upserted: string[]; retired: number; deleted: number }> {
  const rows = await prisma.noticeTemplate.findMany({
    select: {
      id: true,
      bankId: true,
      name: true,
      dltTemplateId: true,
      seedKey: true,
      status: true,
      bank: { select: { code: true } },
      _count: { select: { campaigns: true } },
    },
  });
  const loaded = rows.map((row) => ({
    id: row.id,
    bankId: row.bankId,
    bankCode: row.bank.code,
    name: row.name,
    dltTemplateId: row.dltTemplateId,
    seedKey: row.seedKey,
    status: row.status,
    campaigns: row._count.campaigns,
  }));

  const canonicalIds = new Set<string>();
  const upserted: string[] = [];
  for (const template of DEMO_TEMPLATES) {
    const chosen = chooseCanonical(loaded, template, canonicalIds);
    const data = demoTemplateWrite(template);
    if (chosen) {
      // Keep the row id. Write the live DLT id staff already send with.
      await prisma.noticeTemplate.update({
        where: { id: chosen.id },
        data: {
          ...data,
          dltTemplateId: template.dltTemplateId,
          seedKey: template.seedKey,
          ...(options.moveExistingToBank ? { bankId: options.bankIdForNew } : {}),
        },
      });
      canonicalIds.add(chosen.id);
    } else {
      const created = await prisma.noticeTemplate.create({
        data: {
          ...data,
          seedKey: template.seedKey,
          bankId: options.bankIdForNew,
        },
      });
      canonicalIds.add(created.id);
    }
    upserted.push(template.name);
  }

  let retired = 0;
  let deleted = 0;
  for (const row of loaded) {
    if (
      !isRemovablePracticeTemplate(
        {
          id: row.id,
          bankCode: row.bankCode,
          name: row.name,
          dltTemplateId: row.dltTemplateId,
          seedKey: row.seedKey,
        },
        canonicalIds,
      )
    ) {
      continue;
    }
    const referenced = await templateIsReferenced(prisma, row.id);
    const action = practiceTemplateDisposition(
      {
        id: row.id,
        bankCode: row.bankCode,
        name: row.name,
        dltTemplateId: row.dltTemplateId,
        seedKey: row.seedKey,
        status: row.status,
        referenced,
      },
      canonicalIds,
    );
    if (action === "retire") {
      await prisma.noticeTemplate.update({
        where: { id: row.id },
        data: { status: TEMPLATE_DRAFT },
      });
      retired += 1;
    } else if (action === "delete") {
      const stillReferenced = await templateIsReferenced(prisma, row.id);
      if (stillReferenced) {
        if (row.status.trim().toUpperCase() !== TEMPLATE_DRAFT) {
          await prisma.noticeTemplate.update({
            where: { id: row.id },
            data: { status: TEMPLATE_DRAFT },
          });
          retired += 1;
        }
        continue;
      }
      await prisma.noticeTemplate.delete({ where: { id: row.id } });
      deleted += 1;
    }
  }

  return { upserted, retired, deleted };
}

async function templateIsReferenced(prisma: PrismaClient, templateId: string): Promise<boolean> {
  const sends = await prisma.campaign.count({ where: { templateId } });
  if (sends > 0) return true;
  const notices = await prisma.publicNotice.count({
    where: { campaign: { templateId } },
  });
  return notices > 0;
}
