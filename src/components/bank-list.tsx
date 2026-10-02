// The list of client banks. Only Admin should be shown this list.

import { selectBank, setBankActive } from "@/app/actions/banks";
import { Button } from "@/components/ui/button";
import { bankStatusLabel, type BankSnapshot } from "@/lib/banks";

export function BankList({
  banks,
  currentBankId,
}: {
  banks: BankSnapshot[];
  currentBankId: string | null;
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
              <form action={setBankActive}>
                <input type="hidden" name="bankId" value={bank.id} />
                <input type="hidden" name="active" value={bank.active ? "false" : "true"} />
                <Button type="submit" variant="outline" className="h-11 px-4">
                  {bank.active ? "Mark inactive" : "Mark active"}
                </Button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
