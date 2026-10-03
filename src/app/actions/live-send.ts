"use server";

import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { saveLiveSendSwitch } from "@/lib/live-send-store";
import { canFlipLiveSend } from "@/lib/live-send-switch";

export type LiveSendFormState = { error: string } | null;

export async function setLiveSendSwitch(
  _previous: LiveSendFormState,
  formData: FormData,
): Promise<LiveSendFormState> {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (!canFlipLiveSend(current.user.role)) {
    return { error: "Only the owner can change live send." };
  }

  const value = String(formData.get("enabled") ?? "");
  if (value !== "on" && value !== "off") {
    return { error: "Choose on or off." };
  }

  const enabled = value === "on";
  await saveLiveSendSwitch(enabled);
  await auditCurrentUser({
    action: "live-send.update",
    summary: enabled
      ? "Turned live send on. Confirming a notice sends it through MSG91."
      : "Turned live send off. Confirming a notice records a dry run.",
    bankId: null,
    bankName: "",
  });
  redirect("/settings?saved=1");
}
