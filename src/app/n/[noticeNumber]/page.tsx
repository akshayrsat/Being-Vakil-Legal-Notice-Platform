// Short public path for one notice: /n/<notice number>.

import type { Metadata } from "next";
import { PublicNoticeScreen } from "@/components/public-notice-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Legal notice",
};

export default async function NoticePathPage({
  params,
}: {
  params: Promise<{ noticeNumber: string }>;
}) {
  const { noticeNumber } = await params;
  return <PublicNoticeScreen noticeNumber={noticeNumber} />;
}
