// A customer link is either the borrower's token or one co-party's token.

import { prisma } from "./db";

const TOKEN = /^[A-Za-z0-9_-]{20,}$/;

export type PublicViewer = {
  id: string;
  name: string;
  role: string;
  address: string;
  mobile: string;
};

export async function resolvePublicCase(token: string): Promise<{
  item: NonNullable<Awaited<ReturnType<typeof prisma.odrCase.findFirst>>>;
  viewer: PublicViewer | null;
} | null> {
  const key = token.trim();
  if (!TOKEN.test(key)) return null;
  const direct = await prisma.odrCase.findFirst({ where: { publicToken: key } });
  if (direct) return { item: direct, viewer: null };
  const party = await prisma.odrRespondent.findFirst({ where: { publicToken: key } });
  if (!party) return null;
  const item = await prisma.odrCase.findFirst({ where: { id: party.caseId } });
  if (!item) return null;
  return {
    item,
    viewer: { id: party.id, name: party.name, role: party.role, address: party.address, mobile: party.mobile },
  };
}
