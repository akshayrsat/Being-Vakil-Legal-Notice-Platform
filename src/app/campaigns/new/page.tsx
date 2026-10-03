import { redirect } from "next/navigation";
import { legacySendEntry } from "@/lib/send-notice";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const query = await searchParams;
  const search = query.batch ? `batch=${query.batch}` : "";
  redirect(legacySendEntry("/campaigns/new", search) ?? "/send");
}
