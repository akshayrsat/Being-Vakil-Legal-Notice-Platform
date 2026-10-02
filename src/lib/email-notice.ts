// The short email that points at one public notice, on the firm letterhead.

import { FIRM_ADDRESS, FIRM_NAME, FIRM_TAGLINE } from "./letterhead";
import { noticePublicUrl } from "./notice-link";

export function emailDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function emailNoticeText(input: {
  customerName: string;
  bankName: string;
  noticeNumber: string;
  dated: Date;
}): string {
  const name = input.customerName.trim() || "Sir/Madam";
  const bank = input.bankName.trim() || "our client";
  const url = noticePublicUrl(input.noticeNumber);
  return [
    emailDateLabel(input.dated),
    "",
    `Dear ${name},`,
    "",
    `This is in reference to the loan advance facility availed by you from our client ${bank}.`,
    "",
    "As per the terms and conditions, envisaged in the Loan Agreement/MITC signed/accepted by you with our client, it is customary for you to repay the monthly equated instalment towards the said loan/credit facility regularly and within stipulated time.",
    "",
    "Our Client have previously contacted you on numerous occasions for repayment of due amount. However, Our Client are yet to receive the payment. There are no visible signs at your end to respect the terms of repayment established in the agreement.",
    "",
    "Under such circumstances and upon instructions ,from Our Client we are compelled to issue a Demand Legal Notice against the total due amount. We request you to pay the total due amount within 7 days from the date of this notice.",
    "",
    "Quick links:",
    `To view the Legal Notice issued to you, click ${url}`,
    "",
    "Please ignore this notice, if you have already made the requisite payments.",
    "",
    "Yours Faithfully,",
    "",
    "Adv Shweta Sudhir",
    `For ${FIRM_NAME}`,
  ].join("\n");
}

export function emailNoticeHtml(plain: string, baseUrl: string): string {
  const origin = baseUrl.replace(/\/+$/, "");
  const header = `${origin}/branding/letterhead-header.png`;
  const footer = `${origin}/branding/letterhead-footer.png`;
  const stamp = `${origin}/branding/stamp-signature.png`;
  const blocks = plain
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const parts: string[] = [];
  for (const block of blocks) {
    const html = linkify(escapeHtml(block)).replace(/\n/g, "<br>");
    const lines = block.split("\n");
    const signAt = lines.findIndex((line) => line.trim() === "Yours Faithfully,");
    if (signAt >= 0) {
      const before = lines.slice(0, signAt).join("\n").trim();
      const after = lines.slice(signAt + 1).join("\n").trim();
      if (before) parts.push(paragraph(linkify(escapeHtml(before))));
      parts.push(paragraph("Yours Faithfully,"));
      parts.push(
        `<p style="margin:0 0 8px;"><img src="${escapeHtml(stamp)}" alt="Signature of Shweta and the Being Vakil Associates stamp" width="220" style="display:block;width:220px;max-width:100%;height:auto;border:0;"></p>`,
      );
      if (after) parts.push(paragraph(linkify(escapeHtml(after))));
      continue;
    }
    parts.push(paragraph(html));
  }
  const address = FIRM_ADDRESS.join(" ");
  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f6f1e6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e6;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;font-family:'Times New Roman',Times,serif;color:#161616;">
          <tr>
            <td style="padding:28px 32px 8px;">
              <img src="${escapeHtml(header)}" alt="${escapeHtml(`${FIRM_NAME}. ${FIRM_TAGLINE}`)}" width="576" style="display:block;width:100%;max-width:576px;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 12px;">
              ${parts.join("\n")}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;">
              <img src="${escapeHtml(footer)}" alt="${escapeHtml(`${FIRM_NAME}. ${address}`)}" width="576" style="display:block;width:100%;max-width:576px;height:auto;border:0;">
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function paragraph(inner: string): string {
  return `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;">${inner.replace(/\n/g, "<br>")}</p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<>"'&]+/g, (url) => `<a href="${url}">${url}</a>`);
}
