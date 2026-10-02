import Image from "next/image";
import Link from "next/link";
import { FIRM_ADDRESS, FIRM_EMAIL, FIRM_NAME, FIRM_OFFICES, FIRM_PHONE, FIRM_TAGLINE, FIRM_WEBSITE } from "@/lib/letterhead";

export function PublicLanding() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="h-2 bg-[#5b2c83]" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
        <Image
          src="/branding/letterhead-mark.png"
          alt=""
          width={72}
          height={72}
          className="h-16 w-16 object-contain"
        />
        <p className="mt-6 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          {FIRM_NAME}
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-primary">Legal notices for banks</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          {FIRM_TAGLINE} If you received a message about a legal notice, open the link in that
          message. It shows the notice issued to you. This page does not list other customers.
        </p>

        <section className="mt-10 rounded-xl bg-card px-5 py-5 ring-1 ring-foreground/10">
          <h2 className="font-serif text-2xl">Contact the office</h2>
          <dl className="mt-4 grid gap-4 text-sm leading-6 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">{FIRM_PHONE}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>
                <a className="font-medium underline" href={`mailto:${FIRM_EMAIL}`}>
                  {FIRM_EMAIL}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Website</dt>
              <dd className="font-medium">{FIRM_WEBSITE}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Offices</dt>
              <dd className="font-medium">{FIRM_OFFICES}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Address</dt>
              <dd className="font-medium">{FIRM_ADDRESS.join(" ")}</dd>
            </div>
          </dl>
        </section>

        <p className="mt-10 text-sm text-muted-foreground">
          <Link href="/login" className="underline">
            Staff sign-in
          </Link>
        </p>
      </main>
    </div>
  );
}
