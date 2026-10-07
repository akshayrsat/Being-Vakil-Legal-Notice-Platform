"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auditActor, recordAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { emailProblem, mobileProblem } from "@/lib/contact";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/odr-access";
import {
  canCorrectOrErase,
  canEditPrivacyContact,
  canEditPrivacyRequests,
  canReadIncidents,
  isPrivacyRequestKind,
  requestDueAt,
} from "@/lib/privacy-access";
import { INCIDENT_CHECKS } from "@/lib/privacy-copy";
import { confirmWord, correctAuditSummary, eraseAuditSummary, parseRetentionDays, privacyAccountKey, searchNeedles } from "@/lib/privacy-keys";
import { correctPersonRow, erasePersonRow, PERSON_KINDS, type PersonKind } from "@/lib/privacy-person";
import { FIRM_PRIVACY_ID, readFirmPrivacy } from "@/lib/privacy-store";
import { tooManyAttempts } from "@/lib/rate-limit";

export type PrivacyFormState = { error: string; done?: boolean } | null;

function isPersonKind(value: string): value is PersonKind {
  return (PERSON_KINDS as readonly string[]).includes(value);
}

export async function submitPrivacyRequest(
  _previous: PrivacyFormState,
  formData: FormData,
): Promise<PrivacyFormState> {
  const headerList = await headers();
  const ip = clientIp(headerList.get("x-forwarded-for"));
  if (tooManyAttempts(`privacy-request:${ip}`, 8, 15 * 60 * 1000)) {
    return { error: "Too many requests. Wait a few minutes and try again." };
  }
  const kind = String(formData.get("kind") ?? "");
  const requesterName = String(formData.get("requesterName") ?? "").trim().slice(0, 160);
  const email = String(formData.get("email") ?? "").trim().slice(0, 160);
  const mobile = String(formData.get("mobile") ?? "").trim().slice(0, 40);
  const accountHint = String(formData.get("accountHint") ?? "").trim().slice(0, 80);
  const bankName = String(formData.get("bankName") ?? "").trim().slice(0, 160);
  const detail = String(formData.get("detail") ?? "").trim().slice(0, 2000);
  if (!isPrivacyRequestKind(kind)) return { error: "Choose what you are asking for." };
  if (requesterName.length < 2) return { error: "Enter your name." };
  if (!email && !mobile) return { error: "Enter an email or a mobile number so the firm can reply." };
  const emailError = emailProblem(email);
  const mobileError = mobileProblem(mobile);
  if (emailError || mobileError) return { error: emailError || mobileError };
  if (detail.length < 4) return { error: "Say what you want done." };

  const banks = await prisma.bank.findMany({ where: { active: true }, select: { id: true, name: true } });
  const matched = banks.filter((bank) => bank.name.trim().toLowerCase() === bankName.toLowerCase());
  const bankId = matched.length === 1 ? matched[0].id : "";
  const firm = await readFirmPrivacy();
  const created = await prisma.privacyRequest.create({
    data: {
      bankId,
      bankName,
      kind,
      requesterName,
      email,
      mobile,
      accountHint,
      detail,
      dueAt: requestDueAt(new Date(), firm.requestDueDays),
    },
  });
  await recordAudit({
    actorId: null,
    actorName: "Public form",
    actorRole: "public",
    action: "privacy.request",
    summary: `Privacy request ${kind.toLowerCase()} recorded.`,
    bankId: bankId || null,
    bankName,
    targetId: created.id,
  });
  return { error: "", done: true };
}

export async function updatePrivacyRequestStatus(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !canEditPrivacyRequests(user.role)) redirect("/dashboard");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "OPEN" && status !== "IN_PROGRESS" && status !== "DONE") redirect("/privacy/requests");
  const row = await prisma.privacyRequest.findUnique({ where: { id } });
  if (!row) redirect("/privacy/requests");
  await prisma.privacyRequest.update({ where: { id }, data: { status } });
  const actor = auditActor(user);
  if (actor) {
    await recordAudit({
      ...actor,
      action: "privacy.request",
      summary: `Privacy request marked ${status.toLowerCase().replace("_", " ")}.`,
      bankId: row.bankId || null,
      bankName: row.bankName,
      targetId: id,
    });
  }
  revalidatePath("/privacy/requests");
  redirect("/privacy/requests?saved=1");
}

export async function saveFirmPrivacy(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !canEditPrivacyContact(user.role)) redirect("/dashboard");
  const officerName = String(formData.get("officerName") ?? "").trim().slice(0, 120);
  const officerEmail = String(formData.get("officerEmail") ?? "").trim().slice(0, 160);
  const officerPhone = String(formData.get("officerPhone") ?? "").trim().slice(0, 40);
  const due = Number(String(formData.get("requestDueDays") ?? ""));
  if (emailProblem(officerEmail) || !officerPhone || !Number.isInteger(due) || due < 1 || due > 365) {
    redirect("/settings?privacy=invalid");
  }
  await prisma.firmPrivacySetting.upsert({
    where: { id: FIRM_PRIVACY_ID },
    create: { id: FIRM_PRIVACY_ID, officerName, officerEmail, officerPhone, requestDueDays: due },
    update: { officerName, officerEmail, officerPhone, requestDueDays: due },
  });
  const actor = auditActor(user);
  if (actor) {
    await recordAudit({
      ...actor,
      action: "privacy.contact",
      summary: "Updated the firm privacy contact and the request due period.",
    });
  }
  revalidatePath("/privacy");
  revalidatePath("/settings");
  redirect("/settings?saved=privacy");
}

export async function saveBankRetention(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const bank = user ? workingBank(user) : null;
  if (!user || !canEditPrivacyContact(user.role) || !bank) redirect("/settings");
  const days = ["closedCaseDays", "messageDays", "documentDays", "publicNoticeDays", "campaignDays"].map((key) =>
    parseRetentionDays(String(formData.get(key) ?? "")),
  );
  if (days.some((value) => value === null)) redirect("/settings?retention=invalid");
  const [closedCaseDays, messageDays, documentDays, publicNoticeDays, campaignDays] = days as number[];
  const legalHold = String(formData.get("legalHold") ?? "") === "yes";
  await prisma.bankRetention.upsert({
    where: { bankId: bank.id },
    create: { bankId: bank.id, closedCaseDays, messageDays, documentDays, publicNoticeDays, campaignDays, legalHold },
    update: { closedCaseDays, messageDays, documentDays, publicNoticeDays, campaignDays, legalHold },
  });
  const actor = auditActor(user);
  if (actor) {
    await recordAudit({
      ...actor,
      action: "privacy.retention",
      summary: legalHold ? "Retention schedule saved. Legal hold is on for this bank." : "Retention schedule saved for this bank.",
      bankId: bank.id,
      bankName: bank.name,
    });
  }
  revalidatePath("/settings");
  redirect("/settings?saved=retention");
}

export async function correctPerson(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const bank = user ? workingBank(user) : null;
  if (!user || !bank || !canCorrectOrErase(user.role)) redirect("/privacy/find");
  if (!confirmWord(String(formData.get("confirm") ?? ""), "CORRECT")) {
    redirect(`/privacy/find?q=${encodeURIComponent(String(formData.get("q") ?? ""))}&error=confirm`);
  }
  const kind = String(formData.get("kind") ?? "");
  if (!isPersonKind(kind)) redirect("/privacy/find");
  const result = await correctPersonRow(
    prisma,
    bank.id,
    kind,
    String(formData.get("id") ?? ""),
    String(formData.get("field") ?? ""),
    String(formData.get("value") ?? ""),
  );
  const actor = auditActor(user);
  if (actor && "corrected" in result) {
    await recordAudit({
      ...actor,
      action: "privacy.correct",
      summary: correctAuditSummary(kind),
      bankId: bank.id,
      bankName: bank.name,
    });
  }
  const q = encodeURIComponent(String(formData.get("q") ?? ""));
  revalidatePath("/privacy/find");
  redirect(`/privacy/find?q=${q}&${"corrected" in result ? "saved=correct" : "error=correct"}`);
}

export async function erasePerson(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const bank = user ? workingBank(user) : null;
  if (!user || !bank || !canCorrectOrErase(user.role)) redirect("/privacy/find");
  const q = String(formData.get("q") ?? "");
  if (!confirmWord(String(formData.get("confirm") ?? ""), "ERASE")) {
    redirect(`/privacy/find?q=${encodeURIComponent(q)}&error=confirm`);
  }
  const kind = String(formData.get("kind") ?? "");
  if (!isPersonKind(kind)) redirect("/privacy/find");
  const result = await erasePersonRow(prisma, bank.id, kind, String(formData.get("id") ?? ""), q);
  const actor = auditActor(user);
  if (actor && "erased" in result) {
    const summary = eraseAuditSummary({ [kind]: result.erased });
    await recordAudit({
      ...actor,
      action: "privacy.erase",
      summary,
      bankId: bank.id,
      bankName: bank.name,
    });
  }
  revalidatePath("/privacy/find");
  redirect(`/privacy/find?q=${encodeURIComponent(q)}&${"erased" in result ? "saved=erase" : "error=hold"}`);
}

export async function placePersonHold(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const bank = user ? workingBank(user) : null;
  if (!user || !bank || !canCorrectOrErase(user.role)) redirect("/privacy/find");
  const q = String(formData.get("q") ?? "");
  if (!confirmWord(String(formData.get("confirm") ?? ""), "HOLD")) {
    redirect(`/privacy/find?q=${encodeURIComponent(q)}&error=confirm`);
  }
  const needles = searchNeedles(q);
  if (!needles.mobile && !needles.email && needles.accounts.length === 0) redirect("/privacy/find");
  await prisma.personLegalHold.create({
    data: {
      bankId: bank.id,
      accountKey: privacyAccountKey(needles.accounts[0] ?? ""),
      mobileKey: needles.mobile,
      emailKey: needles.email,
      reason: String(formData.get("reason") ?? "").trim().slice(0, 300),
      active: true,
    },
  });
  const actor = auditActor(user);
  if (actor) {
    await recordAudit({
      ...actor,
      action: "privacy.hold",
      summary: "Placed a legal hold on one person. The identifiers were not stored in this log.",
      bankId: bank.id,
      bankName: bank.name,
    });
  }
  revalidatePath("/privacy/find");
  redirect(`/privacy/find?q=${encodeURIComponent(q)}&saved=hold`);
}

export async function releasePersonHold(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const bank = user ? workingBank(user) : null;
  if (!user || !bank || !canCorrectOrErase(user.role)) redirect("/privacy/find");
  const id = String(formData.get("id") ?? "");
  await prisma.personLegalHold.updateMany({ where: { id, bankId: bank.id }, data: { active: false } });
  const actor = auditActor(user);
  if (actor) {
    await recordAudit({
      ...actor,
      action: "privacy.hold",
      summary: "Released a legal hold.",
      bankId: bank.id,
      bankName: bank.name,
    });
  }
  revalidatePath("/privacy/find");
  redirect("/privacy/find?saved=release");
}

function readStamp(formData: FormData, name: string): Date | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function savePrivacyIncident(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !canReadIncidents(user.role)) redirect("/dashboard");
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const whatHappened = String(formData.get("whatHappened") ?? "").trim().slice(0, 4000);
  const detectedAt = readStamp(formData, "detectedAt");
  if (!title || !whatHappened || !detectedAt) redirect("/privacy/incidents?error=1");
  const people = Number(String(formData.get("peopleAffectedCount") ?? "0"));
  const checks: Record<string, boolean> = {};
  const selected = new Set(formData.getAll("check").map((item) => String(item)));
  for (const item of INCIDENT_CHECKS) checks[item.id] = selected.has(item.id);
  const data = {
    title,
    whatHappened,
    detectedAt,
    banksAffected: String(formData.get("banksAffected") ?? "").trim().slice(0, 500),
    peopleAffectedCount: Number.isInteger(people) && people >= 0 ? people : 0,
    notifiedBankAt: readStamp(formData, "notifiedBankAt"),
    notifiedBoardAt: readStamp(formData, "notifiedBoardAt"),
    notifiedPeopleAt: readStamp(formData, "notifiedPeopleAt"),
    checklistJson: JSON.stringify(checks),
  };
  const id = String(formData.get("id") ?? "");
  const saved = id
    ? await prisma.privacyIncident.update({ where: { id }, data }).catch(() => null)
    : await prisma.privacyIncident.create({ data });
  if (!saved) redirect("/privacy/incidents?error=1");
  const actor = auditActor(user);
  if (actor) {
    await recordAudit({
      ...actor,
      action: "privacy.incident",
      summary: "Saved an incident note. Nothing was sent to a bank, the Board, or a person.",
      targetId: saved.id,
    });
  }
  revalidatePath("/privacy/incidents");
  redirect("/privacy/incidents?saved=1");
}
