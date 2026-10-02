import { postalStatusLabel } from "@/lib/postal";

const tone: Record<string, string> = {
  BOOKED: "bg-muted text-foreground",
  IN_TRANSIT: "bg-[#1b3048] text-[#f4efe6]",
  OUT_FOR_DELIVERY: "bg-[#8a6232] text-[#fbf6ee]",
  DELIVERED: "bg-[#1a4a42] text-[#f3f7f4]",
  RETURNED: "bg-destructive/15 text-destructive",
};

export function PostalStatus({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${tone[status] ?? tone.BOOKED}`}>
      {postalStatusLabel(status)}
    </span>
  );
}
