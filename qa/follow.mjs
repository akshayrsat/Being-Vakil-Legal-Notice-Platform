import { readFileSync, writeFileSync } from "node:fs";
import playwright from "/tmp/qa/node_modules/playwright-core/index.js";
import ExcelJS from "exceljs";

const { chromium } = playwright;
const BASE = "http://127.0.0.1:4317";
const SHOTS = "/opt/cursor/artifacts/screenshots";
const code = readFileSync("/workspace/.env", "utf8")
  .split("\n")
  .find((row) => row.startsWith("NOTICE_DESK_ENTRY_CODE="))
  .split("=")
  .slice(1)
  .join("=")
  .trim()
  .replace(/^"|"$/g, "");

const out = { notes: [], bugs: [], passed: [], consoleErrors: [], httpErrors: [] };
const note = (m) => { out.notes.push(m); console.log("NOTE", m); };
const pass = (m) => { out.passed.push(m); console.log("PASS", m); };
const bug = (m) => { out.bugs.push(m); console.log("BUG", m); };

async function gate(page) {
  await page.goto(BASE + "/?staff=1", { waitUntil: "domcontentloaded" });
  await page.locator("#staff-entry-code").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/login/, { timeout: 20000 });
}
async function login(page, email, password) {
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  if (!page.url().includes("/login")) await gate(page);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|account\/password)/, { timeout: 20000 });
}

const browser = await chromium.launch({
  executablePath: "/opt/google/chrome/chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on("console", (msg) => { if (msg.type() === "error") out.consoleErrors.push(msg.text().slice(0, 300)); });
page.on("response", (res) => { if (res.status() >= 500 && res.url().startsWith(BASE)) out.httpErrors.push(res.status() + " " + res.url()); });

await gate(page);
await login(page, "admin@noticedesk.local", "admin123");

const book = new ExcelJS.Workbook();
book.addWorksheet("ODR").addRow(["Notes only"]);
await book.xlsx.writeFile("/tmp/qa/files/missing.xlsx");
await page.goto(BASE + "/odr", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.body.innerText.includes("Legal route"));
await page.locator('select[name="neutralId"]').selectOption({ index: 1 });
await page.locator('input[name="hearingDate"]').fill("2026-10-22");
await page.locator('input[name="file"]').setInputFiles("/tmp/qa/files/missing.xlsx");
await page.getByRole("button", { name: "Upload and match columns" }).click();
await page.waitForTimeout(4000);
const missingAlert = await page.locator("[role=alert]").allTextContents();
note("missing-columns url " + page.url() + " alerts " + missingAlert.join(" | "));
if (page.url().includes("/odr/uploads")) pass("Missing-column sheet reached column matching.");
else if (missingAlert.length) pass("Missing-column sheet shows: " + missingAlert.join(" "));
else {
  bug("A sheet with no customer or account column stays on the upload form with no explanation.");
  await page.screenshot({ path: SHOTS + "/qa-missing-columns.png", fullPage: true });
}

const big = new ExcelJS.Workbook();
const sheet = big.addWorksheet("ODR");
sheet.addRow(["Customer name", "Loan/card account no", "Mobile", "Email"]);
for (let i = 1; i <= 2000; i += 1) {
  sheet.addRow([`Bulk ${i}`, `LN7${String(100000 + i)}`, "9845012345", `bulk${i}@example.com`]);
}
await big.xlsx.writeFile("/tmp/qa/files/bulk2000.xlsx");
await page.goto(BASE + "/odr", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.body.innerText.includes("Legal route"));
await page.locator('input[name="legalRoute"][value="MEDIATION"]').check();
const mehta = await page.locator('select[name="neutralId"] option').evaluateAll((nodes) => {
  const hit = nodes.find((node) => /Mehta/.test(node.textContent || ""));
  return hit ? hit.value : "";
});
if (!mehta) throw new Error("Mehta option missing");
await page.locator('select[name="neutralId"]').selectOption(mehta);
await page.locator('input[name="hearingDate"]').fill("2026-10-22");
await page.locator('input[name="file"]').setInputFiles("/tmp/qa/files/bulk2000.xlsx");
const t0 = Date.now();
await page.getByRole("button", { name: "Upload and match columns" }).click();
try {
  await page.waitForURL(/\/odr\/uploads\//, { timeout: 90000 });
  await page.getByRole("button", { name: "Review the people" }).click();
  await page.waitForURL(/preview/, { timeout: 90000 });
  await page.waitForFunction(() => document.body.innerText.includes("ready"), null, { timeout: 30000 });
  const preview = await page.locator("body").innerText();
  note(`2000 preview in ${Date.now() - t0}ms. 2000 ready=${preview.includes("2000 ready")} first50=${preview.includes("first 50")}`);
  if (preview.includes("2000 ready")) pass("2000-row mediation sheet reached review.");
  else bug("2000 preview text: " + preview.replace(/\s+/g, " ").slice(0, 240));
  await page.screenshot({ path: SHOTS + "/qa-bulk-preview.png", fullPage: false });
} catch (error) {
  bug("2000 upload failed: " + page.url() + " " + String(error).slice(0, 180));
  note((await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300));
  await page.screenshot({ path: SHOTS + "/qa-bulk-fail.png", fullPage: true });
}

await page.goto(BASE + "/odr/cases/cmuy4sb2s000mjs2qqwqrnmy8", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const caseText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
note("case snippet " + caseText.slice(caseText.indexOf("QA-REF"), caseText.indexOf("QA-REF") + 280));

const pub = await context.newPage();
await pub.goto(BASE + "/odr/c/Td-Fcsyb8-BlUs42ye8nzXcJRgAy0uGbjc46egwCALE", { waitUntil: "domcontentloaded" });
await pub.waitForTimeout(500);
await pub.locator('input[name="last4"]').fill("1001");
await pub.getByRole("button", { name: /Show the case|Open/ }).click();
await pub.waitForTimeout(1500);
const customer = (await pub.locator("body").innerText()).replace(/\s+/g, " ");
note("customer after unlock " + customer.slice(0, 400));
if (customer.includes("Section 12(5)") || customer.includes("waive")) {
  pass("Customer case page shows the Section 12(5) waiver with the consent step.");
  await pub.screenshot({ path: SHOTS + "/qa-customer-consent.png", fullPage: false });
} else {
  bug("Customer page after last-4 did not show the waiver. " + customer.slice(0, 240));
  await pub.screenshot({ path: SHOTS + "/qa-customer-consent.png", fullPage: true });
}
const joinBlocked = /Joining opens after you record|not recorded|record your choice/i.test(customer);
note("join blocked before consent: " + joinBlocked);
await pub.close();

await context.clearCookies();
await gate(page);
await login(page, "viewer@noticedesk.local", "viewer123");
for (const path of ["/settings", "/audit", "/people", "/banks", "/send"]) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const pathNow = new URL(page.url()).pathname;
  const text = (await page.locator("body").innerText()).slice(0, 120);
  note(`viewer ${path} -> ${pathNow} ${text.replace(/\s+/g, " ")}`);
  if (pathNow === "/dashboard") pass(`Bank user ${path} redirects to the dashboard.`);
  else bug(`Bank user remained on ${pathNow} after opening ${path}`);
}

await context.clearCookies();
await gate(page);
await login(page, "qa.coord.965719@firm.example", "CoordPass6162");
await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const coordSettings = new URL(page.url()).pathname;
await page.goto(BASE + "/audit", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const auditText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 220);
note(`coord settings ${coordSettings} audit ${auditText}`);
if (coordSettings === "/dashboard" && /owner/i.test(auditText)) pass("Coordinator cannot open Settings, and Audit says it is for the owner.");
else bug(`Coordinator settings/audit unexpected ${coordSettings} ${auditText}`);
await page.goto(BASE + "/people", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
const people = await page.locator("body").innerText();
if (people.includes("Law-firm staff") && people.includes("QA Coordinator") && !people.includes("admin@noticedesk.local")) {
  pass("Coordinator people page lists firm staff and hides the owner.");
} else note("coord people " + people.replace(/\s+/g, " ").slice(0, 300));
await page.setViewportSize({ width: 390, height: 844 });
for (const path of ["/dashboard", "/odr/cases", "/people", "/send"]) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const box = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (box.scroll > box.client + 16) bug(`Sideways scroll on ${path} at 390px (${box.scroll}>${box.client})`);
  else pass(`${path} fits 390px.`);
}
await page.screenshot({ path: SHOTS + "/qa-mobile-cases.png", fullPage: false });

const cronGet = await fetch(BASE + "/api/odr/cron");
const cronShort = await fetch(BASE + "/api/odr/cron", { method: "POST", headers: { "x-odr-cron-secret": "short" } });
const cronWrong = await fetch(BASE + "/api/odr/cron", { method: "POST", headers: { "x-odr-cron-secret": "xxxxxxxxxxxxxxxx" } });
const cronOk = await fetch(BASE + "/api/odr/cron", { method: "POST", headers: { "x-odr-cron-secret": "qa-cron-secret-6162" } });
note(`cron ${cronGet.status} ${cronShort.status} ${cronWrong.status} ${cronOk.status} ${(await cronOk.text()).slice(0, 180)}`);

const letter = await context.newPage();
await letter.goto(BASE + "/notice-DEMO-LN10021", { waitUntil: "domcontentloaded" });
await letter.locator('input[name="last4"]').fill("0021");
await letter.getByRole("button", { name: "Open the notice" }).click();
await letter.waitForTimeout(500);
await letter.waitForFunction(() => {
  const img = document.querySelector(".notice-letterfoot img");
  return img && img.complete && img.naturalWidth > 0;
}, null, { timeout: 10000 }).catch(() => note("footer image did not load"));
await letter.emulateMedia({ media: "print" });
await letter.pdf({ path: "/tmp/qa/files/notice-wait.pdf", format: "A4", printBackground: true });
note("footer natural " + await letter.evaluate(() => {
  const img = document.querySelector(".notice-letterfoot img");
  return img ? `${img.naturalWidth}x${img.naturalHeight}` : "missing";
}));

await browser.close();
writeFileSync("/tmp/qa/follow.json", JSON.stringify(out, null, 2));
console.log("DONE");
