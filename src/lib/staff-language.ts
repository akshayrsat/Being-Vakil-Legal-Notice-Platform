// Plain words for everyone except an owner admin.
// An owner admin is an owner whose email is on OWNER_ADMIN_EMAILS.
// They still see the vendor name, template ids, and dry-run wording.

import { isOwnerAdmin } from "./owner-admin";

export function seesVendorDetail(user: { role: string; email: string } | null | undefined): boolean {
  return isOwnerAdmin(user);
}

const PHRASES: Array<[RegExp, string]> = [
  [
    /Handed to MSG91 with a notice PDF\. The notice link is unchanged\./g,
    "Notice sent with a PDF. The notice link is unchanged.",
  ],
  [/Handed to MSG91\./g, "Notice sent."],
  [
    /Claimed for MSG91\. A second confirm will not send this row again\./g,
    "Sending. A second confirm will not send this row again.",
  ],
  [/The send stopped before MSG91 accepted it\./g, "The send stopped before it was accepted."],
  [/MSG91 reported this as opened\/read\./g, "Marked as opened."],
  [/MSG91 reported this as opened or read\./g, "Marked as opened."],
  [/MSG91 reported this as failed\./g, "Marked as failed."],
  [/MSG91 reported this as delivered\./g, "Marked as delivered."],
  [/Recorded on a dry run\./gi, "Recorded only. Nothing was sent."],
  [/Dry run\. Queued here as a simulated send\. Nothing was sent\./g, "Recorded only. Nothing was sent."],
  [
    /Live SMS uses the MSG91 flow Legal_Notice_12092026 \(sender BVAKIL\), not this free text\./g,
    "This is the approved SMS wording.",
  ],
  [
    /Live email uses the MSG91 template legal_notice_non_payment, not this free text\./g,
    "This is the approved email wording.",
  ],
  [
    /Live WhatsApp uses the MSG91 template legal_notice_link, not this free text\./g,
    "This is the approved WhatsApp wording.",
  ],
  [
    /Live send is on, but MSG91 is not set up, so nothing (?:is|was) sent\./g,
    "Sending is turned on, but it is not ready yet, so nothing is sent.",
  ],
  [
    /Live send is off\. Confirming records a dry run\. Nothing is sent\./g,
    "Confirming records the notice. Nothing is sent.",
  ],
  [/Confirming records a dry run\. Nothing is sent\./g, "Confirming records the notice. Nothing is sent."],
  [/A dry run still does not call MSG91\./g, "Nothing is sent until sending is turned on."],
  [
    /The send was handed to MSG91 for the people who were not skipped\./g,
    "The notice was sent for the people who were not skipped.",
  ],
  [/Dry run finished\. Nothing was sent\./g, "Recorded. Nothing was sent."],
  [/because MSG91 is not set up on this computer\./g, "on this computer."],
  [/the code MSG91 sent/g, "the code sent"],
];

const TOKENS: Array<[RegExp, string]> = [
  [/MSG91_[A-Z0-9_]+/g, ""],
  [/\bMSG91\b/gi, ""],
  [/\bDLT\b/gi, ""],
  [/\bwebhooks\b/gi, "delivery updates"],
  [/\bwebhook\b/gi, "delivery update"],
  [/\bdry-runs\b/gi, "records"],
  [/\bdry-run\b/gi, "record"],
  [/\bdry runs\b/gi, "records"],
  [/\bdry run\b/gi, "record"],
  [/\btemplate ids\b/gi, "wording"],
  [/\btemplate id\b/gi, "wording"],
  [/\bflow ids\b/gi, "SMS wording"],
  [/\bflow id\b/gi, "SMS wording"],
  [/\blegal_notice_non_payment\b/g, "the email wording"],
  [/\blegal_notice_link\b/g, "the WhatsApp wording"],
  [/\bLegal_Notice_12092026\b/g, "the SMS wording"],
  [/\b6abf5af2e9226c340a0548e2\b/g, ""],
];

export function hideVendorWording(text: string, technical: boolean): string {
  if (technical || !text) return text;
  let next = text;
  for (const [pattern, replacement] of PHRASES) next = next.replace(pattern, replacement);
  for (const [pattern, replacement] of TOKENS) next = next.replace(pattern, replacement);
  return next
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+·\s+·\s*/g, " · ")
    .replace(/^\s*·\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function confirmHelp(dryRun: boolean, technical: boolean): string {
  if (dryRun) {
    return technical
      ? "Confirming records a dry run on this computer. MSG91 is not called."
      : "Confirming records this notice. Nothing is sent.";
  }
  return technical
    ? "Confirming asks MSG91 to deliver the notices that are not skipped. Each row is claimed once, so a second confirm does not send it again."
    : "Confirming sends the notice by SMS, email, or WhatsApp. A second confirm does not send the same row again.";
}

export function confirmButtonLabel(dryRun: boolean, technical: boolean, pending: boolean): string {
  if (pending) return "Finishing…";
  if (!dryRun) return "Confirm send";
  return technical ? "Confirm dry run" : "Confirm, nothing is sent";
}
