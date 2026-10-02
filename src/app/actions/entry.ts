"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ENTRY_COOKIE,
  entryCookieOptions,
  entryGateEnabled,
  entryToken,
  safeNextPath,
  submittedCodeMatches,
} from "@/lib/entry-gate";
import { logDesk } from "@/lib/desk-log";
import { tooManyAttempts } from "@/lib/rate-limit";

export type EntryFormState = { error: string } | null;

export async function submitEntryCode(
  _previous: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  if (!entryGateEnabled()) redirect("/login");
  const headerList = await headers();
  const ip = (headerList.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() || "local";
  if (tooManyAttempts(`entry:${ip}`, 8, 15 * 60 * 1000)) {
    return { error: "Too many tries. Wait a few minutes and try again." };
  }

  const provided = String(formData.get("code") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));
  if (!submittedCodeMatches(provided)) {
    logDesk("entry.rejected", { ip: ip.slice(0, 64) });
    return { error: "That entry code is not correct." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ENTRY_COOKIE, entryToken(), entryCookieOptions());
  logDesk("entry.accepted");
  redirect(next);
}
