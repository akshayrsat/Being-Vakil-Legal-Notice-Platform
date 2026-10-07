import { readFileSync, writeFileSync } from "node:fs";
import playwright from "/tmp/qa/node_modules/playwright-core/index.js";
import ExcelJS from "exceljs";

const { chromium } = playwright;
const BASE = "http://127.0.0.1:4317";
const SHOTS = "/opt/cursor/artifacts/screenshots";
const code = readFileSync("/workspace/.env", "utf8").split("\n").find((row) => row.startsWith("NOTICE_DESK_ENTRY_CODE=")).split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const pdf = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
writeFileSync("/tmp/qa/files/stub.pdf", pdf);

const note = (m) => console.log("NOTE", m);
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + "/?staff=1", { waitUntil: "domcontentloaded" });
await page.locator("#staff-entry-code").fill(code);
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForURL(/\/login/);
await page.locator("#email").fill("admin@noticedesk.local");
await page.locator("#password").fill("admin123");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/\/dashboard/);

await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.body.innerText.includes("ODR messages"));
await page.getByRole("radio", { name: "On Confirming sends ODR" }).check();
await page.locator("form").filter({ has: page.getByRole("radio", { name: "On Confirming sends ODR" }) }).getByRole("button", { name: "Save" }).click();
await page.waitForTimeout(1200);
const settings = (await page.locator("body").innerText()).replace(/\s+/g, " ");
note("settings after on " + (settings.includes("ODR messages are on") ? "banner on" : settings.slice(settings.indexOf("ODR"), settings.indexOf("ODR") + 180)));
await page.screenshot({ path: SHOTS + "/qa-odr-switch-on.png", fullPage: false });

const book = new ExcelJS.Workbook();
const sheet = book.addWorksheet("ODR");
sheet.addRow(["Customer name", "Loan/card account no", "Mobile", "Email"]);
sheet.addRow(["Mediation Mina", "LN6601001", "9845011111", "mina@example.com"]);
await book.xlsx.writeFile("/tmp/qa/files/med.xlsx");
await page.goto(BASE + "/odr", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.body.innerText.includes("Legal route"));
await page.locator('input[name="legalRoute"][value="MEDIATION"]').check();
const mehta = await page.locator('select[name="neutralId"] option').evaluateAll((nodes) => nodes.find((node) => /Mehta/.test(node.textContent || ""))?.value || "");
await page.locator('select[name="neutralId"]').selectOption(mehta);
await page.locator('input[name="hearingDate"]').fill("2026-10-22");
await page.locator('input[name="file"]').setInputFiles("/tmp/qa/files/med.xlsx");
await page.getByRole("button", { name: "Upload and match columns" }).click();
await page.waitForURL(/\/odr\/uploads\//);
await page.getByRole("button", { name: "Review the people" }).click();
await page.waitForURL(/preview/);
await page.waitForFunction(() => /SMS:/.test(document.body.innerText));
const preview = (await page.locator("body").innerText()).split("\n").filter((line) => /SMS:|EMAIL:|WHATSAPP:|Send hearing|Record hearings/.test(line));
note("mediation preview " + preview.join(" || "));
await page.screenshot({ path: SHOTS + "/qa-mediation-preview-on.png", fullPage: false });
await page.getByRole("button", { name: /Send hearing|Record hearings/ }).click();
await page.waitForURL(/\/odr\/batches\//);
await page.waitForFunction(() => document.body.innerText.includes("Finished"), null, { timeout: 30000 });
note("mediation batch " + (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400));

await page.goto(BASE + "/odr/cases/cmuy4sb2s000mjs2qqwqrnmy8", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.body.innerText.includes("Section 11") || document.body.innerText.includes("No valid appointment"));
const award = (await page.locator("body").innerText()).replace(/\s+/g, " ");
const warning = award.includes("No valid appointment") ? "section11 warning visible" : "warning missing";
note("award block " + warning + " " + award.slice(award.indexOf("Consent:"), award.indexOf("Consent:") + 220));
await page.screenshot({ path: SHOTS + "/qa-section11-warning.png", fullPage: false });

for (const kind of ["SECTION_12_DISCLOSURE", "ARBITRATOR_ACCEPTANCE", "SECTION_21"]) {
  const form = page.locator("form").filter({ has: page.locator('select[name="kind"]') });
  await form.locator('select[name="kind"]').selectOption(kind);
  await form.locator('input[name="file"]').setInputFiles("/tmp/qa/files/stub.pdf");
  await form.getByRole("button", { name: "Upload PDF" }).click();
  await page.waitForURL(/\/odr\/cases\//, { timeout: 20000 });
  await page.waitForTimeout(600);
}
await page.waitForTimeout(2500);
const afterDocs = (await page.locator("body").innerText()).replace(/\s+/g, " ");
note("after docs " + afterDocs.slice(afterDocs.indexOf("Messages"), afterDocs.indexOf("Messages") + 500));
await page.screenshot({ path: SHOTS + "/qa-arbitration-messages.png", fullPage: false });

await browser.close();
console.log("DONE");
