// Letterhead and signature used on every public notice.

import Image from "next/image";
import {
  FIRM_ADDRESS,
  FIRM_EMAIL,
  FIRM_NAME,
  FIRM_OFFICES,
  FIRM_PHONE,
  FIRM_TAGLINE,
  FIRM_WEBSITE,
} from "@/lib/letterhead";

export function NoticeLetterhead() {
  return (
    <header className="text-center">
      <Image
        src="/branding/letterhead-mark.png"
        alt=""
        width={171}
        height={52}
        className="mx-auto h-auto w-40"
        style={{ width: "10rem", height: "auto" }}
      />
      <p className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{FIRM_NAME}</p>
      <p className="mt-1 text-sm italic sm:text-base">{FIRM_TAGLINE}</p>
      <div className="mt-4 border-t-2 border-black" />
    </header>
  );
}

export function NoticeLetterfoot() {
  return (
    <footer className="mt-10 border-t-2 border-black pt-4 text-xs leading-5 sm:text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p>
            <a className="underline" href={`mailto:${FIRM_EMAIL}`}>
              {FIRM_EMAIL}
            </a>
          </p>
          <p>{FIRM_WEBSITE}</p>
          <p>{FIRM_OFFICES}</p>
        </div>
        <div className="sm:text-right">
          <p>{FIRM_PHONE}</p>
          {FIRM_ADDRESS.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    </footer>
  );
}

export function NoticeSignature({ bankName }: { bankName: string }) {
  return (
    <div className="mt-10">
      <p>Yours faithfully,</p>
      <Image
        src="/branding/stamp-signature.png"
        alt="Signature of Shweta and the Being Vakil Associates stamp"
        width={1080}
        height={1080}
        className="mt-1 h-auto w-64 sm:w-80"
        style={{ width: "18rem", height: "auto" }}
      />
      <p className="font-bold">For {FIRM_NAME}</p>
      <p>Advocates acting for {bankName}</p>
    </div>
  );
}
