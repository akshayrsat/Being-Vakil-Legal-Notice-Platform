// The public front door. A notice number in the query shows that recipient's letter.
// Signed-in staff go to the dashboard. Everyone else sees the customer page, not sign-in.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicLanding } from "@/components/public-landing";
import { PublicNoticeScreen } from "@/components/public-notice-screen";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type HomeQuery = { notice?: string | string[]; staff?: string | string[] };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<HomeQuery>;
}): Promise<Metadata> {
  const query = await searchParams;
  if ("notice" in query) return { title: "Legal notice" };
  return {
    title: { absolute: "Being Vakil Associates" },
    description:
      "If you received a legal notice from Being Vakil Associates, contact your bank and act within the time stated in the notice.",
  };
}

export default async function HomePage({ searchParams }: { searchParams: Promise<HomeQuery> }) {
  const query = await searchParams;
  if ("notice" in query) {
    return <PublicNoticeScreen noticeNumber={firstQuery(query.notice)} />;
  }
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return <PublicLanding askForCode={"staff" in query} />;
}

function firstQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
