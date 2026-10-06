// A referral pack for the DLSA or DRT Lok Adalat. Hearings stay off this platform.

import JSZip from "jszip";

export type LokAdalatCase = {
  refNo: string;
  bank: string;
  customer: string;
  coParties: string;
  accountNumber: string;
  claimAmount: string;
  branch: string;
  mobile: string;
  email: string;
  address: string;
  status: string;
  limitationDate: string;
};

export function lokAdalatColumns(): string[] {
  return ["Reference", "Bank", "Customer", "Co-parties", "Account", "Claim", "Branch", "Mobile", "Email", "Address", "Outcome", "Limitation date"];
}

export function lokAdalatCells(item: LokAdalatCase): string[] {
  return [
    item.refNo,
    item.bank,
    item.customer,
    item.coParties,
    item.accountNumber,
    item.claimAmount,
    item.branch,
    item.mobile,
    item.email,
    item.address,
    item.status || "Not referred yet",
    item.limitationDate,
  ];
}

export function lokAdalatCsv(item: LokAdalatCase): string {
  const line = (cells: string[]) => cells.map((cell) => `"${cell.replaceAll("\"", "\"\"")}"`).join(",");
  return `${line(lokAdalatColumns())}\n${line(lokAdalatCells(item))}\n`;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export async function lokAdalatSummaryDocx(item: LokAdalatCase): Promise<Uint8Array> {
  const paragraphs = [
    "Lok Adalat referral summary",
    "For the District Legal Services Authority or the DRT Lok Adalat.",
    `Reference: ${item.refNo}`,
    `Bank: ${item.bank}`,
    `Customer: ${item.customer}`,
    item.coParties ? `Co-parties: ${item.coParties}` : "",
    `Account: ${item.accountNumber}`,
    `Claim: ${item.claimAmount || "—"}`,
    `Branch: ${item.branch || "—"}`,
    `Mobile: ${item.mobile || "—"}`,
    `Email: ${item.email || "—"}`,
    `Address: ${item.address || "—"}`,
    `Outcome on this platform: ${item.status || "Not referred yet"}`,
    `Limitation date: ${item.limitationDate || "Not entered"}`,
    "A hearing is not scheduled on this platform. The Lok Adalat award, if any, is uploaded on the case.",
  ].filter(Boolean);
  const body = paragraphs.map((text) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`).join("");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`);
  return zip.generateAsync({ type: "uint8array" });
}
