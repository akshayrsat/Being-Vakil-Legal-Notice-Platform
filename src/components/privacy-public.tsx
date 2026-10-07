import { PrivacyLine } from "@/components/privacy-line";
import { PrivacyRequestForm } from "@/components/privacy-request-form";

export function PrivacyPublicExtras({ purpose }: { purpose: "notice" | "odr" }) {
  return (
    <section className="no-print mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <PrivacyLine purpose={purpose} />
      <div id="request" className="rounded-xl border border-border bg-card px-5 py-5">
        <h2 className="font-serif text-2xl tracking-tight">Your data rights</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Access, correction, erasure, a grievance, or a nominee. This form does not replace the Arbitration Act choice on an ODR case.
        </p>
        <div className="mt-4">
          <PrivacyRequestForm />
        </div>
      </div>
    </section>
  );
}
