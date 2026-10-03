import { redirect } from "next/navigation";
import { legacySendEntry } from "@/lib/send-notice";

export default function CampaignsPage() {
  redirect(legacySendEntry("/campaigns") ?? "/send");
}
