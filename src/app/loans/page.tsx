import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { EmptyState } from "@/components/empty-state";
import { LoanTimelineList } from "@/components/loan-timeline-list";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { loadAccountTimeline, searchLoanMatches } from "@/lib/loan-timeline";
import { resolveReportBank } from "@/lib/report-bank";
import { isOwnerAdmin } from "@/lib/owner-admin";
import { canChooseBank, isBankUser } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Loan history",
};

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string; q?: string; loan?: string; account?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isBankUser(user.role)) redirect("/deliveries");
  const query = await searchParams;
  const bank = await resolveReportBank(user, query.bank ?? workingBank(user)?.id ?? "");
  const isAdmin = canChooseBank(user.role);
  const text = (query.q ?? "").trim();
  const loan = (query.loan ?? "").trim();
  const account = (query.account ?? "").trim();

  return (
    <DeskShell user={user}>
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Loan history</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          {bank
            ? `Every notice, channel event, link open, and Speed Post update for one loan or account at ${bank.name}.`
            : "Choose a bank before searching a loan."}
        </p>
      </div>

      {!bank ? (
        <EmptyState title="No bank selected">
          {isAdmin ? "Open Banks and press Use this bank." : "This login is not linked to a bank."}
        </EmptyState>
      ) : (
        <>
          <form action="/loans" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="bank" value={bank.id} />
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              Loan or account number
              <input
                name="q"
                defaultValue={text || loan || account}
                placeholder="LN10021"
                className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
              />
            </label>
            <button type="submit" className={buttonVariants({ className: "h-11 px-4" })}>
              Search
            </button>
          </form>

          {loan || account ? (
            <Timeline bankId={bank.id} loan={loan} account={account} technical={isOwnerAdmin(user)} />
          ) : text ? (
            <Matches bankId={bank.id} text={text} />
          ) : (
            <EmptyState title="Search a loan">
              Type a loan number or account number from the spreadsheet. The timeline lists notices and Speed Post for that account only.
            </EmptyState>
          )}
        </>
      )}
    </DeskShell>
  );
}

async function Matches({ bankId, text }: { bankId: string; text: string }) {
  const matches = await searchLoanMatches(bankId, text);
  if (matches.length === 0) {
    return (
      <EmptyState title="No loan matched">
        Try the loan number exactly as it appears on the spreadsheet, such as LN10021.
      </EmptyState>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {matches.map((match) => (
        <li key={match.key}>
          <Link href={match.href} className="block rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
            <p className="font-medium">{match.customerName || "Unnamed"}</p>
            <p className="text-sm text-muted-foreground">
              {match.loanNumber ? `Loan ${match.loanNumber}` : `Account ${match.customerId}`}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Timeline({
  bankId,
  loan,
  account,
  technical,
}: {
  bankId: string;
  loan: string;
  account: string;
  technical: boolean;
}) {
  const timeline = await loadAccountTimeline({ bankId, loan, account, technical });
  if (!timeline) return null;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-serif text-2xl">{timeline.customerName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {[timeline.loanNumber && `Loan ${timeline.loanNumber}`, timeline.customerId && `Account ${timeline.customerId}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <LoanTimelineList timeline={timeline} />
    </section>
  );
}
