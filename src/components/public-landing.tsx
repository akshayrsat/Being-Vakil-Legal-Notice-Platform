// The page a customer sees at the public address. It is not the staff sign-in screen.

import { BrandLogo } from "@/components/brand-logo";
import { StaffAccess } from "@/components/staff-access";
import {
  FIRM_ADDRESS,
  FIRM_EMAIL,
  FIRM_NAME,
  FIRM_OFFICES,
  FIRM_PHONE,
  FIRM_WEBSITE,
} from "@/lib/letterhead";

const STEPS = [
  {
    title: "Read the notice",
    body: "It names the bank, the loan, the overdue amount, and the date. Those details, not this page, are the demand.",
  },
  {
    title: "Contact your bank",
    body: "Use the collection manager or the loan centre printed in the letter. Keep a note of the call or email.",
  },
  {
    title: "Settle the overdue",
    body: "Pay the bank promptly, through the bank. This website does not take payment. If you have already paid, confirm that with the bank. The notice says you may disregard it in that case.",
  },
  {
    title: "Do not leave it",
    body: "If the default continues, the bank may report it to credit information companies, including CIBIL, which can affect later credit. The bank may also rely on the loan agreement.",
  },
] as const;

export function PublicLanding({ askForCode = false }: { askForCode?: boolean }) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="h-2 bg-primary" />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center px-4 py-4 sm:px-6">
          <BrandLogo size="hero" priority />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">
          {FIRM_NAME}
        </p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
          If you received a legal notice, contact your bank
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          {FIRM_NAME} sends formal demand notices for lending banks. If a notice was addressed to
          you, treat it as a formal demand and act on the timeline it states. Waiting leaves the
          account in default.
        </p>

        <section className="mt-10" aria-labelledby="what-to-do">
          <h2 id="what-to-do" className="font-serif text-2xl tracking-tight">
            What to do now
          </h2>
          <ol className="bv-track mt-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="bv-step">
                <span className="bv-node" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="font-medium text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="mt-10 rounded-xl border border-primary/25 bg-card px-5 py-5 sm:px-6"
          aria-labelledby="why-it-matters"
        >
          <h2 id="why-it-matters" className="font-serif text-2xl tracking-tight">
            Why the timeline matters
          </h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm leading-6 text-foreground">
            <li>
              The notice asks you to remit the overdue amount immediately. Payment confirmation by
              text can take about 48 business hours. If no confirmation arrives, check with the
              bank or its loan centre.
            </li>
            <li>
              Continued default may be shared with credit information bureaus, including CIBIL,
              subject to applicable law. A default history can affect your credit standing and
              later loan eligibility.
            </li>
            <li>
              The notice is issued without prejudice to the loan agreement. Amounts, dates, and
              bank contacts in your letter control. This page does not change them.
            </li>
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="reach-the-bank">
          <h2 id="reach-the-bank" className="font-serif text-2xl tracking-tight">
            Who to contact
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Start with your bank, using the collection manager, mobile number, and website printed
            on the notice. If you need the advocates who sent it:
          </p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Firm</dt>
              <dd className="mt-1 font-medium">{FIRM_NAME}</dd>
              <dd className="mt-1 text-muted-foreground">{FIRM_OFFICES}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Office</dt>
              <dd className="mt-1 font-medium">{FIRM_ADDRESS[0]}</dd>
              <dd className="font-medium">{FIRM_ADDRESS[1]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="mt-1">
                <a className="font-medium text-primary underline-offset-4 hover:underline" href="tel:+919326247985">
                  {FIRM_PHONE}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email and website</dt>
              <dd className="mt-1">
                <a
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  href={`mailto:${FIRM_EMAIL}`}
                >
                  {FIRM_EMAIL}
                </a>
              </dd>
              <dd className="mt-1">
                <a
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  href={`https://${FIRM_WEBSITE}`}
                >
                  {FIRM_WEBSITE}
                </a>
              </dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
          <StaffAccess initiallyOpen={askForCode} />
          <p className="text-xs text-muted-foreground">
            {FIRM_NAME}. {FIRM_OFFICES}.
          </p>
        </div>
      </footer>
    </div>
  );
}
