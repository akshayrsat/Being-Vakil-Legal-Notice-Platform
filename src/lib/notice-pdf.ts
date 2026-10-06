// A PDF of one demand notice, for an optional email attachment.
// Letterhead images are embedded when the branding files are on disk.
// The clickable notice URL is not replaced by this file.

import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { buildDemandNotice, type DemandNoticeInput } from "./demand-notice";
import { grievanceFooter, type GrievanceInfo } from "./grievance";
import { isTextLegalNotice, legalNoticeParagraphs } from "./legal-notice-templates";
import { FIRM_ADDRESS, FIRM_NAME, FIRM_TAGLINE } from "./letterhead";

export async function renderNoticePdf(
  input: DemandNoticeInput & { documentFormat?: string; filledBody?: string; grievance?: GrievanceInfo },
): Promise<Buffer> {
  const notice = isTextLegalNotice(input.documentFormat ?? "") ? null : buildDemandNotice(input);
  const header = await readOptional("letterhead-header.png");
  const footer = await readOptional("letterhead-footer.png");
  const stamp = await readOptional("stamp-signature.png");

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (header) doc.image(header, { fit: [499, 110], align: "center" });
    else {
      doc.font("Times-Bold").fontSize(16).text(FIRM_NAME);
      doc.font("Times-Roman").fontSize(10).text(FIRM_TAGLINE);
    }
    doc.moveDown(0.6);
    if (notice) {
      doc.font("Times-Bold").fontSize(10).text(notice.kicker, { align: "center" });
      doc.font("Times-Bold").fontSize(16).text(notice.title, { align: "center" });
      doc.moveDown(0.4);
      doc.font("Times-Roman").fontSize(11);
      doc.text(notice.dateLine);
      doc.text(notice.referenceLine);
      doc.moveDown(0.4);
      doc.text("To,");
      doc.font("Times-Bold").text(notice.addresseeName);
      doc.font("Times-Roman").text(notice.addresseeAddress);
      doc.moveDown(0.4);
      doc.text(notice.salutation);
      doc.font("Times-Bold").text(notice.subject);
      doc.font("Times-Roman");
      doc.moveDown(0.3);
      for (const paragraph of notice.opening) {
        doc.text(paragraph, { align: "justify" });
        doc.moveDown(0.35);
      }
      for (const row of notice.status) {
        doc.font("Times-Bold").text(`${row.label}: `, { continued: true });
        doc.font("Times-Roman").text(row.value);
      }
      doc.moveDown(0.4);
      for (const paragraph of notice.closing) {
        doc.font("Times-Roman").text(paragraph, { align: "justify" });
        doc.moveDown(0.35);
      }
    } else {
      doc.font("Times-Roman").fontSize(11);
      const paragraphs = legalNoticeParagraphs(input.filledBody ?? "");
      const lines = paragraphs.length > 0 ? paragraphs : ["This notice has no wording."];
      for (const paragraph of lines) {
        doc.text(paragraph, { align: "justify" });
        doc.moveDown(0.35);
      }
    }
    doc.moveDown(0.2);
    doc.text("Yours Faithfully,");
    if (stamp) {
      doc.moveDown(0.2);
      doc.image(stamp, { fit: [160, 90] });
    }
    if (input.grievance) {
      doc.moveDown(0.4);
      doc.font("Times-Roman").fontSize(10).text(grievanceFooter(input.grievance));
    }
    doc.moveDown(0.3);
    doc.text("Adv Shweta Sudhir");
    doc.text(`For ${FIRM_NAME}`);
    if (footer) {
      doc.moveDown(0.6);
      doc.image(footer, { fit: [499, 90], align: "center" });
    } else {
      doc.moveDown(0.4);
      doc.fontSize(9).text(FIRM_ADDRESS.join(" "));
    }
    doc.end();
  });
}

export function noticePdfDataUri(pdf: Buffer): string {
  return `data:application/pdf;base64,${pdf.toString("base64")}`;
}

export function noticePdfFileName(noticeNumber: string): string {
  const safe = noticeNumber.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40) || "notice";
  return `notice-${safe}.pdf`;
}

async function readOptional(fileName: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), "public", "branding", fileName));
  } catch {
    return null;
  }
}
