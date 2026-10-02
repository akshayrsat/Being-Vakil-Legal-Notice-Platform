// Same public notice as /?notice=<id>, on a path that is easy to share.

import type { Metadata } from "next";
import { PublicNoticeScreen } from "@/components/public-notice-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Legal notice",
};

export default async function NoticeQueryPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const query = await searchParams;
  const value = query.notice;
  const noticeNumber = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  return <PublicNoticeScreen noticeNumber={noticeNumber} />;
}
