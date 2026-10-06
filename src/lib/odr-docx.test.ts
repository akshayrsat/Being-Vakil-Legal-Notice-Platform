import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import JSZip from "jszip";
import { renderDocx, renderWordXml, xmlText, type DocxModel } from "./odr-docx";

const NS = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"`;

function documentXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><w:document ${NS}><w:body>${body}</w:body></w:document>`;
}

function paragraph(text: string): string {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function model(partial: Partial<DocxModel> = {}): DocxModel {
  return {
    values: {},
    flags: {},
    repeats: {},
    rows: {},
    ...partial,
  };
}

test("conditional, repeat, and row markers fill a Word document", () => {
  const xml = documentXml(
    [
      paragraph("Hello {{name}}"),
      paragraph("[[IF show]]"),
      paragraph("Shown {{name}}"),
      paragraph("[[ELSE]]"),
      paragraph("Hidden"),
      paragraph("[[END]]"),
      paragraph("[[IF nested]]"),
      paragraph("[[IF inner]]"),
      paragraph("Inner"),
      paragraph("[[ELSE]]"),
      paragraph("Inner else"),
      paragraph("[[END]]"),
      paragraph("[[END]]"),
      paragraph("[[REPEAT people]]"),
      paragraph("Person {{person}}"),
      paragraph("[[END_REPEAT]]"),
      `<w:tbl><w:tr><w:tc>${paragraph("[[ROW items]]  repeat the next row once per entry; delete this row")}</w:tc></w:tr><w:tr><w:tc>${paragraph("{{item}}")}</w:tc></w:tr></w:tbl>`,
      `<w:tbl><w:tr><w:tc>${paragraph("[[ROW empty_rows]] note")}</w:tc></w:tr><w:tr><w:tc>${paragraph("Gone {{item}}")}</w:tc></w:tr></w:tbl>`,
    ].join(""),
  );
  const filled = xmlText(
    renderWordXml(
      xml,
      model({
        values: { name: "Ravi" },
        flags: { show: true, nested: true, inner: false },
        repeats: { people: [{ person: "Anita" }, { person: "Meera" }] },
        rows: { items: [{ item: "One" }, { item: "Two" }], empty_rows: [] },
      }),
    ),
  );
  assert.match(filled, /Hello Ravi/);
  assert.match(filled, /Shown Ravi/);
  assert.equal(filled.includes("Hidden"), false);
  assert.equal(filled.includes("Inner else"), true);
  assert.equal(filled.includes("[["), false);
  assert.match(filled, /Person Anita/);
  assert.match(filled, /Person Meera/);
  assert.match(filled, /One/);
  assert.match(filled, /Two/);
  assert.equal(filled.includes("Gone"), false);
});

test("the approved award template drops the contested branch when the matter is ex parte", async () => {
  const template = readFileSync(path.join(process.cwd(), "templates/odr/Arbitral_Award_Template.docx"));
  const bytes = await renderDocx(template, model({
    values: { case_no: "BV/ARB/2026/0001", respondent_name: "Ravi Shah", claimant_short_name: "Northwind", seat_city: "" },
    flags: { ex_parte: true, personal_loan: true, credit_card: false, time_extended: false, has_co_respondents: true },
    rows: {
      co_respondents: [{ co_respondent_no: "2", co_respondent_name: "Anita Shah", co_respondent_capacity: "Co-borrower" }],
      notice_log: [
        { notice_no: "1", notice_description: "Notice of first hearing", notice_date: "06.10.2026", notice_mode: "E-mail", notice_addressee: "Ravi Shah", notice_proof_ref: "msg-1", notice_status: "Skipped" },
      ],
      hearing_log: [],
      exhibits: [],
      award_delivery: [],
    },
  }));
  const zip = await JSZip.loadAsync(bytes);
  const text = xmlText(await zip.file("word/document.xml")!.async("string"));
  assert.equal(text.includes("[["), false);
  assert.match(text, /proceeded under Section 25/);
  assert.equal(text.includes("Both parties consented to online hearings"), false);
  assert.match(text, /Anita Shah/);
  assert.match(text, /Notice of first hearing/);
  const header = xmlText(await zip.file("word/header1.xml")!.async("string"));
  assert.match(header, /BV\/ARB\/2026\/0001/);
  assert.match(header, /Ravi Shah/);
});
