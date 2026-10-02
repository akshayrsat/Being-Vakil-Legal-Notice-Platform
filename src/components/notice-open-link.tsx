import Link from "next/link";
import { noticePageHref } from "@/lib/notice-link";

export function NoticeOpenLink({ noticeNumber }: { noticeNumber: string }) {
  if (!noticeNumber) return null;
  return (
    <Link
      href={noticePageHref(noticeNumber)}
      target="_blank"
      rel="noopener noreferrer"
      prefetch={false}
      className="underline"
    >
      Open notice
    </Link>
  );
}
