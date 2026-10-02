// The front door. A notice number in the query shows that recipient's public notice.
// Otherwise a signed-in person goes to the dashboard, and everyone else goes to sign-in.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicLanding } from "@/components/public-landing";
import { PublicNoticeScreen } from "@/components/public-notice-screen";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type HomeQuery = { notice?: string | string[] };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<HomeQuery>;
}): Promise<Metadata> {
  const query = await searchParams;
  if ("notice" in query) return { title: "Legal notice" };
  return {};
}

export default async function HomePage({ searchParams }: { searchParams: Promise<HomeQuery> }) {
  const query = await searchParams;
  if ("notice" in query) {
    return <PublicNoticeScreen noticeNumber={firstQuery(query.notice)} />;
  }
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return <PublicLanding />;
}

function firstQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
