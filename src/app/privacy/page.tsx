// DRAFT FOR COUNSEL REVIEW. Technical privacy notice for the product. Not legal advice.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { PrivacyRequestForm } from "@/components/privacy-request-form";
import { prisma } from "@/lib/db";
import { SUBPROCESSORS } from "@/lib/privacy-copy";
import { readFirmPrivacy } from "@/lib/privacy-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const firm = await readFirmPrivacy();
  const banks = await prisma.bank.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      name: true,
      grievanceOfficerName: true,
      grievanceOfficerPhone: true,
      grievanceOfficerEmail: true,
    },
  });

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="h-2 bg-primary" />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center px-4 py-4 sm:px-6">
          <BrandLogo size="header" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Privacy notice</p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight">How personal data is used</h1>
          <p className="mt-4 text-base leading-7">
            Being Vakil Associates processes personal data on behalf of the bank to deliver a legal notice or to conduct an online dispute resolution proceeding. The bank decides why the data is used for that work. Being Vakil Associates handles it for the bank.
          </p>
        </div>

        <Section title="What data">
          <p>
            Name, address, mobile number, email, loan or card account number, amounts, and the text of the notice or the case. A hearing may also use a Google Meet link. Identity numbers such as Aadhaar are not kept in full.
          </p>
        </Section>

        <Section title="Why">
          <p>
            To send the legal notice, to run the ODR proceeding, to record hearings, and to answer a request for access, correction, erasure, a grievance, or a nominee. This notice is separate from any choice you make under the Arbitration Act about an arbitrator.
          </p>
        </Section>

        <Section title="Who else receives it">
          <p>The bank, and these sub-processors when a step needs them:</p>
          <ul className="mt-3 list-disc pl-5">
            {SUBPROCESSORS.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </Section>

        <Section title="How long it is kept">
          <p>
            The bank sets how long closed cases, messages, documents, public notices, and campaign rows are kept. Access logs are kept for at least one year. A legal hold stops deletion. Downloaded files are not stored here after you save them.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask for access, correction, erasure, a grievance, or nomination of another person. Use the form on this page. The firm aims to answer within {firm.requestDueDays} days. Erasure can be refused while a legal hold applies.
          </p>
        </Section>

        <Section title="Bank grievance officer">
          <p>The officer for your bank is also printed on the legal notice and on the ODR case page.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {banks.map((bank) => (
              <li key={bank.name}>
                <span className="font-medium">{bank.name}.</span>{" "}
                {bank.grievanceOfficerName || "Grievance officer"}
                {bank.grievanceOfficerPhone ? `, ${bank.grievanceOfficerPhone}` : ""}
                {bank.grievanceOfficerEmail ? `, ${bank.grievanceOfficerEmail}` : ""}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Firm privacy contact">
          <p>
            {firm.officerLabel}
            {firm.officerEmail ? `, ${firm.officerEmail}` : ""}
            {firm.officerPhone ? `, ${firm.officerPhone}` : ""}
          </p>
        </Section>

        <section id="request" className="rounded-xl border border-border bg-card px-5 py-5">
          <h2 className="font-serif text-2xl tracking-tight">Make a request</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Access, correction, erasure, a grievance, or a nominee. This is not the Arbitration Act waiver.
          </p>
          <div className="mt-4">
            <PrivacyRequestForm />
          </div>
        </section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <div className="mt-3 text-sm leading-6">{children}</div>
    </section>
  );
}
