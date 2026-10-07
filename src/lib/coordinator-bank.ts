// A legal coordinator is law-firm staff. bankId is only for a bank user.
// A leftover bankId must not stay on the row.

import type { PrismaClient } from "@prisma/client";
import { ROLE_COORDINATOR } from "./roles";

export async function clearCoordinatorBankLinks(db: Pick<PrismaClient, "user">): Promise<number> {
  const result = await db.user.updateMany({
    where: { role: ROLE_COORDINATOR, NOT: { bankId: null } },
    data: { bankId: null },
  });
  return result.count;
}
