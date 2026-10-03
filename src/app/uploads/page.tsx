import { redirect } from "next/navigation";
import { legacySendEntry } from "@/lib/send-notice";

export default function UploadsPage() {
  redirect(legacySendEntry("/uploads") ?? "/send");
}
