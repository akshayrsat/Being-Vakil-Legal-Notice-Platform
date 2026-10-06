// The list of client banks. Only Admin should be shown this list.

import { selectBank, setAttachNoticePdf, setBankActive } from "@/app/actions/banks";
import { BankGrievanceForm } from "@/components/bank-grievance-form";
import { Button } from "@/components/ui/button";
import { bankStatusLabel, type BankSnapshot } from "@/lib/banks";
import { grievanceFooter, type GrievanceInfo } from "@/lib/grievance";

export function BankList({
  banks,
  currentBankId,
  canManage = false,
}: {
  banks: Array<BankSnapshot & { attachNoticePdf: boolean } & GrievanceInfo>;
  currentBankId: string | null;
  canManage?: boolean;
}) {
  if (banks.length === 0) {
    return (
      <p className="text-base text-muted-foreground">
        No banks yet. Add the first one above.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {banks.map((bank) => {
        const current = bank.id === currentBankId;
        return (
          <li
            key={bank.id}
            className={`rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10 ${current ? "border-l-4 border-l-primary" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-serif text-xl text-foreground">{bank.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Short code <span className="font-medium text-foreground">{bank.code}</span>
                </p>
              </div>
              <p
                className={`rounded-md px-2 py-1 text-sm font-medium ${bank.active ? "bg-[#1a4a42] text-[#f3f7f4]" : "bg-muted text-muted-foreground"}`}
              >
                {bankStatusLabel(bank.active)}
              </p>
            </div>
            {current ? (
              <p className="mt-3 text-sm font-medium">You are working on this bank.</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {current ? null : (
                <form action={selectBank}>
                  <input type="hidden" name="bankId" value={bank.id} />
                  <Button type="submit" className="h-11 px-4">
                    Use this bank
                  </Button>
                </form>
              )}
              {canManage ? (
                <form action={setBankActive}>
                  <input type="hidden" name="bankId" value={bank.id} />
                  <input type="hidden" name="active" value={bank.active ? "false" : "true"} />
                  <Button type="submit" variant="outline" className="h-11 px-4">
                    {bank.active ? "Mark inactive" : "Mark active"}
                  </Button>
                </form>
              ) : null}
              {canManage ? (
                <form action={setAttachNoticePdf}>
                  <input type="hidden" name="bankId" value={bank.id} />
                  <input type="hidden" name="attachNoticePdf" value={bank.attachNoticePdf ? "false" : "true"} />
                  <Button type="submit" variant="outline" className="h-11 px-4">
                    {bank.attachNoticePdf ? "Stop email PDFs" : "Attach notice PDF to email"}
                  </Button>
                </form>
              ) : null}
            </div>
            {canManage ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {bank.attachNoticePdf
                  ? "Live emails include a PDF of the notice. The clickable notice link is still sent."
                  : "Live emails do not attach a PDF. This is the default."}
              </p>
            ) : null}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{grievanceFooter(bank)}</p>
            {canManage ? (
              <BankGrievanceForm
                bankId={bank.id}
                officerName={bank.officerName}
                officerPhone={bank.officerPhone}
                officerEmail={bank.officerEmail}
                ombudsman={bank.ombudsman}
                wordingApprovedOn={bank.wordingApprovedOn}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
