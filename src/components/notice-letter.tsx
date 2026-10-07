// Letterhead and signature used on every public notice.
// The header and footer images are a render of the Being Vakil Associates Word letterhead.

import Image from "next/image";
import { FIRM_NAME, FIRM_TAGLINE } from "@/lib/letterhead";

export function NoticeLetterhead() {
  return (
    <header className="notice-letterhead">
      <Image
        src="/branding/letterhead-header.png"
        alt={`${FIRM_NAME}. ${FIRM_TAGLINE}`}
        width={1260}
        height={504}
        unoptimized
        priority
      />
    </header>
  );
}

export function NoticeLetterfoot() {
  return (
    <footer className="notice-letterfoot">
      <Image
        src="/branding/letterhead-footer.png"
        alt="Being Vakil Associates, +91 93262 47985, 5th Floor, WISE SNDTUW, UMIT, SNDT Juhu Campus, Juhu Tara Road, Santacruz (West), Mumbai - 400049, shweta@beingvakil.com, Mumbai | Thane | Delhi | Nagpur | Bangalore, www.beingvakil.in"
        width={1733}
        height={231}
        unoptimized
        priority
      />
    </footer>
  );
}

export function NoticeSignature({ bankName }: { bankName: string }) {
  return (
    <div className="notice-sign">
      <p>Yours Faithfully,</p>
      <div className="notice-stamp">
        <Image
          src="/branding/stamp-signature.png"
          alt="Signature of Shweta and the Being Vakil Associates stamp"
          width={1080}
          height={1080}
          unoptimized
        />
      </div>
      <p className="font-bold">Adv Shweta Sudhir</p>
      <p className="font-bold">For {FIRM_NAME}</p>
      <p>Advocates acting for {bankName}</p>
    </div>
  );
}
