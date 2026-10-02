// Letterhead and signature used on every public notice.
// The header and footer images are a render of the Being Vakil Associates Word letterhead.

import Image from "next/image";
import { FIRM_NAME } from "@/lib/letterhead";

export function NoticeLetterhead() {
  return (
    <header>
      <Image
        src="/branding/letterhead-header.png"
        alt="Being Vakil Associates. Empowering You, Protecting You, Being Vakil!"
        width={1260}
        height={504}
        unoptimized
        priority
        className="h-auto w-full"
        style={{ width: "100%", height: "auto" }}
      />
    </header>
  );
}

export function NoticeLetterfoot() {
  return (
    <footer className="mt-8">
      <Image
        src="/branding/letterhead-footer.png"
        alt="Being Vakil Associates, +91 93262 47985, 5th Floor, WISE SNDTUW, UMIT, SNDT Juhu Campus, Juhu Tara Road, Santacruz (West), Mumbai - 400049, shweta@beingvakil.com, Mumbai | Thane | Delhi | Nagpur | Bangalore, www.beingvakil.in"
        width={1733}
        height={231}
        unoptimized
        className="h-auto w-full"
        style={{ width: "100%", height: "auto" }}
      />
    </footer>
  );
}

export function NoticeSignature({ bankName }: { bankName: string }) {
  return (
    <div className="mt-10">
      <p>Yours Faithfully,</p>
      <Image
        src="/branding/stamp-signature.png"
        alt="Signature of Shweta and the Being Vakil Associates stamp"
        width={1080}
        height={1080}
        unoptimized
        className="mt-1 h-auto w-64 sm:w-80"
        style={{ width: "18rem", height: "auto" }}
      />
      <p className="font-bold">Adv Shweta Sudhir</p>
      <p className="font-bold">For {FIRM_NAME}</p>
      <p>Advocates acting for {bankName}</p>
    </div>
  );
}
