import { readFileSync, writeFileSync } from "node:fs";
import playwright from "/tmp/qa/node_modules/playwright-core/index.js";

const { chromium } = playwright;
const BASE = "http://127.0.0.1:4317";
const SHOTS = "/opt/cursor/artifacts/screenshots";
const code = readFileSync("/workspace/.env", "utf8")
  .split("\n")
  .find((row) => row.startsWith("NOTICE_DESK_ENTRY_CODE="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const out = { notes: [], bugs: [], passed: [], consoleErrors: [] };
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

const customerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pub = await customerCtx.newPage();
pub.on("console", (msg) => { if (msg.type() === "error") out.consoleErrors.push("cust " + msg.text().slice(0, 200)); });
await pub.goto(BASE + "/odr/c/Td-Fcsyb8-BlUs42ye8nzXcJRgAy0uGbjc46egwCALE", { waitUntil: "domcontentloaded" });
await pub.waitForTimeout(600);
let customer = (await pub.locator("body").innerText()).replace(/\s+/g, " ");
note("customer locked " + customer.slice(0, 240));
if (await pub.locator('input[name="last4"]').count()) {
  await pub.locator('input[name="last4"]').fill("1001");
  await pub.getByRole("button", { name: /Show the case|Open/ }).click();
  await pub.waitForTimeout(1500);
  customer = (await pub.locator("body").innerText()).replace(/\s+/g, " ");
}
note("customer open " + customer.slice(0, 500));
const box = await pub.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
note("customer 390 " + JSON.stringify(box));
if (box.scroll > box.client + 16) bug("Customer case page scrolls sideways at 390px");
else pass("Customer case page fits 390px.");
if (/12\(5\)|waive/i.test(customer)) {
  pass("Consent step and Section 12(5) waiver are on the customer case page.");
  await pub.screenshot({ path: SHOTS + "/qa-customer-consent.png", fullPage: false });
} else bug("Waiver text missing. " + customer.slice(0, 200));
if (/practice Meet|practice link|not a live Google/i.test(customer)) pass("Customer page says the Meet link is a practice link.");
else note("meet copy not found");
if (/Joining opens after|record your choice/i.test(customer)) pass("Join stays closed until arbitrator consent is recorded.");
await customerCtx.close();

const staff = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await staff.newPage();
page.on("console", (msg) => { if (msg.type() === "error") out.consoleErrors.push(msg.text().slice(0, 220)); });
await gate(page);
await login(page, "viewer@noticedesk.local", "viewer123");
for (const path of ["/settings", "/audit", "/people", "/banks", "/send"]) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const pathNow = new URL(page.url()).pathname;
  if (pathNow === "/dashboard") pass(`Bank user ${path} redirects to the dashboard.`);
  else bug(`Bank user stayed on ${pathNow} for ${path}. ${(await page.locator("body").innerText()).slice(0, 100)}`);
}
await staff.close();

const coordCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const coord = await coordCtx.newPage();
coord.on("console", (msg) => { if (msg.type() === "error") out.consoleErrors.push("coord " + msg.text().slice(0, 200)); });
await gate(coord);
await login(coord, "qa.coord.965719@firm.example", "CoordPass6162");
await coord.goto(BASE + "/settings", { waitUntil: "domcontentloaded" });
await coord.waitForTimeout(700);
const settingsPath = new URL(coord.url()).pathname;
await coord.goto(BASE + "/audit", { waitUntil: "domcontentloaded" });
await coord.waitForTimeout(700);
const auditText = (await coord.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 240);
note(`coord settings ${settingsPath} audit ${auditText}`);
if (settingsPath === "/dashboard" && /owner/i.test(auditText)) pass("Coordinator: Settings redirects, Audit is owner-only.");
else bug(`Coordinator access ${settingsPath} ${auditText}`);
await coord.goto(BASE + "/banks", { waitUntil: "domcontentloaded" });
await coord.waitForTimeout(500);
const banks = await coord.locator("body").innerText();
if (banks.includes("Meridian") && banks.includes("Northwind") && !banks.includes("Mark inactive")) {
  pass("Coordinator sees every bank and cannot mark a bank inactive.");
} else note("coord banks " + banks.replace(/\s+/g, " ").slice(0, 240));
for (const path of ["/dashboard", "/people", "/odr/cases", "/send"]) {
  await coord.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await coord.waitForTimeout(400);
  const width = await coord.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (width.scroll > width.client + 16) {
    bug(`Sideways scroll ${path} at 390px ${width.scroll}>${width.client}`);
    await coord.screenshot({ path: `${SHOTS}/qa-mobile${path.replace(/\//g, "-")}.png`, fullPage: false });
  } else pass(`${path} fits 390px.`);
}
await coordCtx.close();

const cronGet = await fetch(BASE + "/api/odr/cron");
const cronShort = await fetch(BASE + "/api/odr/cron", { method: "POST", headers: { "x-odr-cron-secret": "short" } });
const cronWrong = await fetch(BASE + "/api/odr/cron", { method: "POST", headers: { "x-odr-cron-secret": "xxxxxxxxxxxxxxxx" } });
const cronOk = await fetch(BASE + "/api/odr/cron", { method: "POST", headers: { "x-odr-cron-secret": "qa-cron-secret-6162" } });
const cronBody = await cronOk.text();
note(`cron GET ${cronGet.status} short ${cronShort.status} wrong ${cronWrong.status} ok ${cronOk.status} ${cronBody.slice(0, 200)}`);
if (cronGet.status === 404 && cronShort.status === 404 && cronWrong.status === 404 && cronOk.status === 200) {
  pass("Cron rejects GET, a short secret, and a wrong secret, and accepts the local secret.");
} else bug("Cron auth unexpected.");

const letterCtx = await browser.newContext();
const letter = await letterCtx.newPage();
await letter.goto(BASE + "/notice-DEMO-LN10021", { waitUntil: "domcontentloaded" });
await letter.locator('input[name="last4"]').fill("0021");
await letter.getByRole("button", { name: "Open the notice" }).click();
await letter.waitForTimeout(800);
const loaded = await letter.waitForFunction(() => {
  const img = document.querySelector(".notice-letterfoot img");
  return img && img.complete && img.naturalWidth > 0;
}, null, { timeout: 10000 }).then(() => true).catch(() => false);
note("footer loaded before pdf " + loaded);
await letter.emulateMedia({ media: "print" });
await letter.pdf({ path: "/tmp/qa/files/notice-wait.pdf", format: "A4", printBackground: true });
await letterCtx.close();

await browser.close();
writeFileSync("/tmp/qa/follow2.json", JSON.stringify(out, null, 2));
console.log("DONE");
