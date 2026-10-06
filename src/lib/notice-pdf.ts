// A PDF of one demand notice, for an optional email attachment.
// Letterhead images are embedded when the branding files are on disk.
// The letter uses A4 and 12pt Times. A longer notice continues on the next page.

import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { buildDemandNotice, type DemandNoticeInput } from "./demand-notice";
import { grievanceFooter, type GrievanceInfo } from "./grievance";
import { isTextLegalNotice, legalNoticeParagraphs } from "./legal-notice-templates";
import { FIRM_ADDRESS, FIRM_NAME, FIRM_TAGLINE } from "./letterhead";

export const NOTICE_BODY_PT = 12;
export const NOTICE_MARGIN_PT = 72;
const NOTICE_LINE_GAP = 5;

export async function renderNoticePdf(
  input: DemandNoticeInput & { documentFormat?: string; filledBody?: string; grievance?: GrievanceInfo },
): Promise<Buffer> {
  const notice = isTextLegalNotice(input.documentFormat ?? "") ? null : buildDemandNotice(input);
  const header = await readOptional("letterhead-header.png");
  const footer = await readOptional("letterhead-footer.png");
  const stamp = await readOptional("stamp-signature.png");

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: NOTICE_MARGIN_PT });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.font("Times-Roman").fontSize(NOTICE_BODY_PT).lineGap(NOTICE_LINE_GAP);

    if (header) drawFullWidthImage(doc, header);
    else {
      doc.font("Times-Bold").fontSize(16).text(FIRM_NAME, { align: "center" });
      doc.font("Times-Italic").fontSize(NOTICE_BODY_PT).text(FIRM_TAGLINE, { align: "center" });
    }
    doc.moveDown(0.6);
    if (notice) {
      doc.font("Times-Bold").fontSize(NOTICE_BODY_PT).text(notice.kicker, { align: "center" });
      doc.font("Times-Bold").fontSize(14).text(notice.title, { align: "center" });
      doc.moveDown(0.5);
      doc.font("Times-Roman").fontSize(NOTICE_BODY_PT);
      doc.text(notice.dateLine);
      doc.text(notice.referenceLine);
      doc.moveDown(0.5);
      doc.text("To,");
      doc.font("Times-Bold").fontSize(NOTICE_BODY_PT).text(notice.addresseeName);
      doc.font("Times-Roman").fontSize(NOTICE_BODY_PT).text(notice.addresseeAddress);
      doc.moveDown(0.5);
      doc.text(notice.salutation);
      doc.font("Times-Bold").fontSize(NOTICE_BODY_PT).text(notice.subject);
      doc.font("Times-Roman").fontSize(NOTICE_BODY_PT);
      doc.moveDown(0.4);
      for (const paragraph of notice.opening) {
        doc.text(paragraph, { align: "justify" });
        doc.moveDown(0.45);
      }
      for (const row of notice.status) {
        doc.font("Times-Bold").fontSize(NOTICE_BODY_PT).text(`${row.label}: `, { continued: true });
        doc.font("Times-Roman").fontSize(NOTICE_BODY_PT).text(row.value);
      }
      doc.moveDown(0.5);
      for (const paragraph of notice.closing) {
        doc.font("Times-Roman").fontSize(NOTICE_BODY_PT).text(paragraph, { align: "justify" });
        doc.moveDown(0.45);
      }
    } else {
      doc.font("Times-Roman").fontSize(NOTICE_BODY_PT);
      const paragraphs = legalNoticeParagraphs(input.filledBody ?? "");
      const lines = paragraphs.length > 0 ? paragraphs : ["This notice has no wording."];
      for (const paragraph of lines) {
        doc.text(paragraph, { align: "justify" });
        doc.moveDown(0.45);
      }
    }
    doc.moveDown(0.4);
    doc.font("Times-Roman").fontSize(NOTICE_BODY_PT).text("Yours Faithfully,");
    if (stamp) {
      doc.moveDown(0.3);
      drawImageBox(doc, stamp, 170, 96);
    }
    doc.moveDown(0.3);
    doc.font("Times-Bold").fontSize(NOTICE_BODY_PT).text("Adv Shweta Sudhir");
    doc.text(`For ${FIRM_NAME}`);
    if (input.bankName.trim()) doc.font("Times-Roman").fontSize(NOTICE_BODY_PT).text(`Advocates acting for ${input.bankName.trim()}`);
    if (input.grievance) {
      doc.moveDown(0.6);
      doc.font("Times-Roman").fontSize(NOTICE_BODY_PT).text(grievanceFooter(input.grievance));
    }
    doc.moveDown(0.6);
    if (footer) drawFullWidthImage(doc, footer);
    else doc.font("Times-Roman").fontSize(NOTICE_BODY_PT).text(FIRM_ADDRESS.join(" "), { align: "center" });
    doc.end();
  });
}

export function noticePdfPageCount(pdf: Buffer): number {
  const text = pdf.toString("latin1");
  return text.match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function pageBottom(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom;
}

function drawFullWidthImage(doc: PDFKit.PDFDocument, image: Buffer) {
  const size = pngSize(image);
  const width = contentWidth(doc);
  const height = size ? (width * size.h) / size.w : 72;
  if (doc.y + height > pageBottom(doc)) doc.addPage();
  const y = doc.y;
  doc.image(image, doc.page.margins.left, y, { width });
  doc.y = y + height;
}

function drawImageBox(doc: PDFKit.PDFDocument, image: Buffer, maxWidth: number, maxHeight: number) {
  const size = pngSize(image);
  const width = Math.min(maxWidth, contentWidth(doc));
  const height = size ? Math.min(maxHeight, (width * size.h) / size.w) : maxHeight;
  if (doc.y + height > pageBottom(doc)) doc.addPage();
  const y = doc.y;
  doc.image(image, doc.page.margins.left, y, { fit: [width, height] });
  doc.y = y + height;
}

function pngSize(image: Buffer): { w: number; h: number } | null {
  if (image.length < 24 || image.toString("ascii", 1, 4) !== "PNG") return null;
  return { w: image.readUInt32BE(16), h: image.readUInt32BE(20) };
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
