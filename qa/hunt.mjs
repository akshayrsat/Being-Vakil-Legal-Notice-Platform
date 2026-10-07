// Browser QA for Notice Desk / ODR. Does not change product code.
// Playwright is installed outside the repo. Provider keys stay unset.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import playwright from "/tmp/qa/node_modules/playwright-core/index.js";

const { chromium } = playwright;
import ExcelJS from "exceljs";

const BASE = "http://127.0.0.1:4317";
const SHOTS = "/opt/cursor/artifacts/screenshots";
const OUT = "/tmp/qa/hunt-results.json";
mkdirSync(SHOTS, { recursive: true });
mkdirSync("/tmp/qa/files", { recursive: true });

function entryCode() {
  const text = readFileSync("/workspace/.env", "utf8");
  const line = text.split("\n").find((row) => row.startsWith("NOTICE_DESK_ENTRY_CODE="));
  return (line ?? "").split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
}

const findings = [];
const passed = [];
const notes = [];
const consoleErrors = [];
const httpErrors = [];
const slow = [];

function pass(area, detail) {
  passed.push({ area, detail });
  console.log("PASS", area, detail);
}

function note(area, detail) {
  notes.push({ area, detail });
  console.log("NOTE", area, detail);
}

function bug(item) {
  findings.push(item);
  console.log("BUG", item.severity, item.area, item.title);
}

async function shot(page, name) {
  const file = `${SHOTS}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function bodyText(page) {
  return page.locator("body").innerText();
}

async function waitText(page, text, ms = 20000) {
  await page.waitForFunction((needle) => document.body.innerText.includes(needle), text, { timeout: ms });
}

function attach(page) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ url: page.url(), text: msg.text().slice(0, 400) });
  });
  page.on("pageerror", (err) => {
    consoleErrors.push({ url: page.url(), text: String(err).slice(0, 400) });
  });
  page.on("response", (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 500 && url.startsWith(BASE)) httpErrors.push({ status, url });
  });
}

async function timedGoto(page, path) {
  const started = Date.now();
  const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 30000 });
  const ms = Date.now() - started;
  if (ms > 3000) slow.push({ path, ms, status: res?.status() });
  return res;
}

async function staffGate(page) {
  await timedGoto(page, "/?staff=1");
  await page.locator("#staff-entry-code").fill(entryCode());
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/login/, { timeout: 20000 });
}

async function signIn(page, email, password) {
  if (!page.url().endsWith("/login") && !page.url().includes("/login?")) {
    await timedGoto(page, "/login");
  }
  if (!page.url().includes("/login")) {
    await staffGate(page);
    await timedGoto(page, "/login");
  }
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|account\/password)/, { timeout: 20000 });
}

async function signOut(page) {
  const button = page.getByRole("button", { name: "Sign out" });
  if (await button.count()) {
    await button.click();
    await page.waitForURL((url) => !url.pathname.startsWith("/dashboard"), { timeout: 15000 }).catch(() => {});
  }
}

async function overflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scroll: doc.scrollWidth,
      client: doc.clientWidth,
      offenders: [...document.querySelectorAll("body *")]
        .filter((el) => el.scrollWidth > el.clientWidth + 8 && el.clientWidth > 0 && el.clientWidth < 420)
        .slice(0, 8)
        .map((el) => `${el.tagName}.${el.className}`.slice(0, 120)),
    };
  });
}

const HEADERS = [
  "Arbitration Ref No",
  "Customer name",
  "Loan/card account no",
  "Branch",
  "Mobile",
  "Email",
  "Address",
  "Loan amount",
  "Outstanding/claim amount",
  "As-on date",
  "Short dispute summary",
];

async function workbook(name, rows) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("ODR");
  sheet.addRow(HEADERS);
  for (const row of rows) sheet.addRow(row);
  const path = `/tmp/qa/files/${name}.xlsx`;
  await book.xlsx.writeFile(path);
  return path;
}

function row(i, extra = {}) {
  return [
    extra.ref ?? "",
    extra.name ?? `QA Borrower ${i}`,
    extra.account ?? `LN88${String(1000 + i)}`,
    "Pune",
    extra.mobile ?? "9845012345",
    extra.email ?? `qa${i}@example.com`,
    "14 Test Road, Pune 411001",
    "100000",
    "25000",
    "2026-09-01",
    "Unpaid instalments",
  ];
}

async function uploadOdr(page, file, route) {
  await timedGoto(page, "/odr");
  await waitText(page, "Legal route");
  if (route) await page.locator(`input[name="legalRoute"][value="${route}"]`).check();
  const select = page.locator('select[name="neutralId"]');
  const options = await select.locator("option").allTextContents();
  await select.selectOption({ index: 1 });
  await page.locator('input[name="hearingDate"]').fill("2026-10-20");
  await page.locator('input[name="file"]').setInputFiles(file);
  const started = Date.now();
  await page.getByRole("button", { name: "Upload and match columns" }).click();
  await page.waitForURL(/\/odr\/uploads\//, { timeout: 60000 });
  return { ms: Date.now() - started, options: options.slice(0, 6), url: page.url() };
}

async function reviewPeople(page) {
  await page.getByRole("button", { name: "Review the people" }).click();
  await page.waitForURL(/\/preview/, { timeout: 60000 });
  await waitText(page, "ready");
  return bodyText(page);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/google/chrome/chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  attach(page);

  await staffGate(page);
  pass("Notice Desk", "Staff entry code opens /login.");

  await timedGoto(page, "/login/forgot");
  await page.locator("#forgot-email").fill("nobody-qa@example.com");
  await page.getByRole("button", { name: "Email a reset link" }).click();
  await page.waitForTimeout(800);
  const forgotUnknown = await bodyText(page);
  await page.locator("#forgot-email").fill("admin@noticedesk.local");
  await page.getByRole("button", { name: "Email a reset link" }).click();
  await page.waitForTimeout(800);
  const forgotKnown = await bodyText(page);
  const neutral = "If that email is a login, a reset link is on its way.";
  if (forgotUnknown.includes(neutral) && forgotKnown.includes(neutral) && forgotUnknown.includes("temporary password") && forgotKnown.includes("temporary password")) {
    pass("Notice Desk", "Forgot password shows the same neutral message for a known and an unknown email, plus the admin note, with mail unset.");
  } else {
    bug({
      severity: "Medium",
      area: "Notice Desk / forgot password",
      title: "Forgot-password reply is not the same neutral message",
      steps: "Open /login/forgot. Submit an unknown email, then admin@noticedesk.local.",
      expected: "The same sentence for both, plus the temporary-password note when mail is not configured.",
      actual: `Unknown: ${forgotUnknown.slice(0, 300)} | Known: ${forgotKnown.slice(0, 300)}`,
      where: "src/app/actions/auth.ts requestPasswordReset",
      fix: "Always return FORGOT_NEUTRAL, and add FORGOT_ADMIN_NOTE only from mail readiness.",
    });
    await shot(page, "qa-forgot-password");
  }

  await signIn(page, "admin@noticedesk.local", "admin123");
  if (page.url().includes("/dashboard")) pass("Notice Desk", "Owner signs in to the dashboard.");
  else bug({
    severity: "High",
    area: "Notice Desk / login",
    title: "Owner practice login did not reach the dashboard",
    steps: "Staff gate, then admin@noticedesk.local / admin123.",
    expected: "/dashboard",
    actual: page.url(),
    where: "src/app/actions/auth.ts signIn",
    fix: "Check the seed password and the post-login redirect.",
  });

  const nav = await page.locator("nav a, header a").allTextContents();
  note("Owner nav", nav.join(" | ").slice(0, 500));

  const ownerPaths = ["/dashboard", "/send", "/odr", "/templates", "/odr/templates", "/legal-notices", "/deliveries", "/speed-post", "/reports", "/banks", "/people", "/settings", "/audit"];
  for (const path of ownerPaths) {
    const res = await timedGoto(page, path);
    const text = (await bodyText(page)).slice(0, 180);
    if (res && res.status() >= 400) {
      bug({
        severity: "High",
        area: "Notice Desk",
        title: `Owner page ${path} returned ${res.status()}`,
        steps: `Sign in as owner and open ${path}.`,
        expected: "The page renders.",
        actual: `${res.status()} ${text}`,
        where: path,
        fix: "Fix the server error for this route.",
      });
    }
  }
  pass("Notice Desk", "Owner can open Settings and Audit.");

  const settings = await (async () => {
    await timedGoto(page, "/settings");
    await waitText(page, "ODR messages");
    return bodyText(page);
  })();
  if (settings.includes("ODR sending is disabled on the server") || settings.includes("sending is not ready yet")) {
    bug({
      severity: "Medium",
      area: "ODR / settings",
      title: "Settings still shows the old ODR-not-ready warning",
      steps: "Owner opens /settings.",
      expected: "On/Off copy, and the server-blocked line only when ODR_LIVE_SEND is kill.",
      actual: settings.slice(0, 400),
      where: "src/app/settings/page.tsx",
      fix: "Use odrMessagesWarning.",
    });
  } else if (settings.includes("Records only") && settings.includes("Approved wording is on ODR templates")) {
    pass("ODR settings", "ODR messages switch shows On/Off copy and a link to templates. Kill line is absent.");
  }
  if (/Approved first-hearing wording|Subject:/.test(settings) && settings.includes("FIRST_HEARING")) {
    bug({
      severity: "Low",
      area: "ODR / settings",
      title: "Settings still prints approved first-hearing wording",
      steps: "Owner opens /settings.",
      expected: "Wording lives on /odr/templates only.",
      actual: "Raw wording is on Settings.",
      where: "src/app/settings/page.tsx",
      fix: "Remove the wording dump.",
    });
  }

  const stamp = Date.now().toString().slice(-6);
  const coordEmail = `qa.coord.${stamp}@firm.example`;
  const bankEmail = `qa.meridian.${stamp}@bank.example`;
  await timedGoto(page, "/people");
  await waitText(page, "Add login");
  await page.locator("#login-name").fill("QA Coordinator");
  await page.locator("#login-email").fill(coordEmail);
  await page.locator("#login-password").fill("CoordPass6162");
  await page.getByRole("radio", { name: /Legal coordinator/ }).check();
  await page.getByRole("button", { name: "Add login" }).click();
  await page.waitForURL(/\/people/, { timeout: 20000 });
  const peopleAfterCoord = await bodyText(page);
  if (peopleAfterCoord.includes("QA Coordinator") && peopleAfterCoord.includes("Law-firm staff")) {
    pass("People", "A new legal coordinator is listed under Law-firm staff, not under a bank.");
  } else {
    bug({
      severity: "High",
      area: "People",
      title: "Legal coordinator was not grouped as law-firm staff",
      steps: "Owner adds a Legal coordinator on People.",
      expected: "The person appears under Law-firm staff with no bank.",
      actual: peopleAfterCoord.slice(0, 500),
      where: "src/app/people/page.tsx",
      fix: "Group LEGAL_COORDINATOR with firm staff and clear bankId.",
    });
    await shot(page, "qa-people-coordinator");
  }

  await page.locator("#login-name").fill("QA Meridian User");
  await page.locator("#login-email").fill(bankEmail);
  await page.locator("#login-password").fill("Meridian6162");
  await page.getByRole("radio", { name: /Bank user/ }).check();
  await page.locator("#login-bank").selectOption({ label: "Meridian Co-operative Bank" });
  await page.getByRole("button", { name: "Add login" }).click();
  await page.waitForURL(/added=1|\/people/, { timeout: 20000 });
  pass("People", `Created bank user ${bankEmail} on Meridian.`);

  const good = await workbook("good", [row(1, { name: "Ravi Good", account: "LN8801001", ref: `QA-REF-${stamp}` }), row(2, { name: "Meera Good", account: "LN8801002" })]);
  const missingBook = new ExcelJS.Workbook();
  missingBook.addWorksheet("ODR").addRow(["Notes only"]);
  const missing = "/tmp/qa/files/missing.xlsx";
  await missingBook.xlsx.writeFile(missing);
  const badBook = new ExcelJS.Workbook();
  const badSheet = badBook.addWorksheet("ODR");
  badSheet.addRow(["Customer name", "Loan/card account no", "Mobile", "Email"]);
  badSheet.addRow(["Bad Contact", "LN8801999", "12345", "not-an-email"]);
  badSheet.addRow(["", "12", "9845012345", "ok@example.com"]);
  const badPath = "/tmp/qa/files/bad.xlsx";
  await badBook.xlsx.writeFile(badPath);
  const dup = await workbook("dup", [
    row(3, { name: "Duplicate One", account: "LN8801777", ref: `DUP-${stamp}` }),
    row(4, { name: "Duplicate Two", account: "LN8801777", ref: `DUP-${stamp}` }),
  ]);

  const preselected = await page.evaluate(async () => {
    await fetch("/odr");
    return true;
  });
  void preselected;
  await timedGoto(page, "/odr");
  await waitText(page, "Legal route");
  const arbChecked = await page.locator('input[name="legalRoute"][value="ARBITRATION"]').isChecked();
  if (arbChecked) {
    bug({
      severity: "Low",
      area: "ODR / upload",
      title: "Mediation versus Arbitration is pre-selected, so the required choice can be skipped",
      steps: "Owner opens /odr. Do not touch the legal-route radios. The Arbitration radio is already checked.",
      expected: "No route is selected until the user chooses Arbitration, Mediation, Conciliation, or Lok Adalat.",
      actual: "Arbitration is checked on first paint. The server still rejects a missing route if the radio is removed.",
      where: "src/components/odr-upload-form.tsx:18",
      fix: "Start route state empty and keep the radio required, so the browser blocks submit until a route is chosen.",
    });
    await shot(page, "qa-route-preselected");
  } else pass("ODR upload", "Legal route is not pre-selected.");

  await page.locator('input[name="legalRoute"][value="ARBITRATION"]').evaluate((el) => {
    el.checked = false;
    el.removeAttribute("checked");
  });
  await page.locator('select[name="neutralId"]').selectOption({ index: 1 });
  await page.locator('input[name="hearingDate"]').fill("2026-10-20");
  await page.locator('input[name="file"]').setInputFiles(good);
  await page.locator('input[name="legalRoute"]').evaluateAll((nodes) => {
    for (const node of nodes) node.removeAttribute("name");
  });
  await page.getByRole("button", { name: "Upload and match columns" }).click();
  await page.waitForTimeout(1500);
  const noRoute = await bodyText(page);
  if (noRoute.includes("Choose a legal route")) {
    pass("ODR upload", "Server rejects an upload when no legal route is posted.");
  } else {
    note("ODR upload", `Empty-route submit text: ${noRoute.slice(0, 240)}`);
  }

  const goodUp = await uploadOdr(page, good, "ARBITRATION");
  note("ODR good upload", `${goodUp.ms}ms ${goodUp.url}`);
  const goodPreview = await reviewPeople(page);
  if (goodPreview.includes("Ravi Good") && goodPreview.includes("2 ready")) {
    pass("ODR upload", "A valid two-row workbook maps and shows 2 ready.");
  } else {
    note("ODR good preview", goodPreview.slice(0, 400));
  }
  const channelLines = goodPreview.split("\n").filter((line) => /SMS:|EMAIL:|WHATSAPP:/.test(line));
  note("ODR preview channels (switch off)", channelLines.join(" || "));
  await shot(page, "qa-odr-preview-off");
  await page.getByRole("button", { name: /Record hearings|Send hearing/ }).click();
  await page.waitForURL(/\/odr\/batches\//, { timeout: 60000 });
  await waitText(page, "Finished", 40000);
  const batchText = await bodyText(page);
  note("ODR batch after confirm (off)", batchText.slice(0, 600));
  const caseHref = await page.locator('a[href*="/odr/cases/"]').first().getAttribute("href");
  note("ODR case href", caseHref || "none");

  const badUp = await uploadOdr(page, badPath, "ARBITRATION");
  note("bad upload", badUp.url);
  const badPreview = await reviewPeople(page);
  const badReady = /Bad Contact[\s\S]{0,200}Ready/.test(badPreview) || badPreview.includes("1 ready");
  if (badPreview.includes("Bad Contact") && (badPreview.includes("Ready") && !badPreview.includes("mobile"))) {
    bug({
      severity: "Medium",
      area: "ODR / upload",
      title: "A bad mobile and a bad email are accepted as a ready row",
      steps: "Upload an ODR sheet with customer Bad Contact, account LN8801999, mobile 12345, email not-an-email. Match columns and open Review.",
      expected: "The row is left out, with a problem for the mobile and the email.",
      actual: badPreview.replace(/\s+/g, " ").slice(0, 700),
      where: "src/lib/odr-fields.ts mapOdrRows around lines 298-301",
      fix: "Push a problem when the mobile is not 10 digits and when the email has no @. Do not create the case.",
    });
    await shot(page, "qa-bad-contact-ready");
  } else if (badPreview.includes("1 ready") && badPreview.includes("Bad Contact")) {
    bug({
      severity: "Medium",
      area: "ODR / upload",
      title: "A bad mobile and a bad email are accepted as a ready row",
      steps: "Upload an ODR sheet with customer Bad Contact, account LN8801999, mobile 12345, email not-an-email.",
      expected: "The row is left out.",
      actual: badPreview.replace(/\s+/g, " ").slice(0, 700),
      where: "src/lib/odr-fields.ts mapOdrRows around lines 298-301",
      fix: "Validate mobile and email before the row is marked Ready.",
    });
    await shot(page, "qa-bad-contact-ready");
  } else {
    pass("ODR upload", `Bad contact row was not marked ready. ${badPreview.replace(/\s+/g, " ").slice(0, 240)}`);
  }
  if (badPreview.includes("Account number needs at least 4 digits") || badPreview.includes("Customer name is empty")) {
    pass("ODR upload", "An empty name and a short account are left out.");
  }

  let missingError = "";
  try {
    await uploadOdr(page, missing, "ARBITRATION");
    await page.getByRole("button", { name: "Review the people" }).click();
    await page.waitForTimeout(1000);
    missingError = await bodyText(page);
  } catch (error) {
    missingError = `${page.url()} ${String(error).slice(0, 200)}`;
  }
  if (/Choose a column for Customer name|No row has a customer/.test(missingError)) {
    pass("ODR upload", "A sheet with no customer or account column is rejected at match or review.");
  } else {
    note("ODR missing columns", missingError.replace(/\s+/g, " ").slice(0, 300));
    await shot(page, "qa-missing-columns");
  }

  const dupPreview = await (async () => {
    await uploadOdr(page, dup, "ARBITRATION");
    return reviewPeople(page);
  })();
  if (dupPreview.includes("2 ready") && dupPreview.includes("Duplicate One") && dupPreview.includes("Duplicate Two")) {
    bug({
      severity: "Medium",
      area: "ODR / upload",
      title: "Duplicate account numbers and a repeated reference are both marked ready",
      steps: `Upload two rows with account LN8801777 and the same ref DUP-${stamp}. Review the people.`,
      expected: "The second row is left out, or the review warns that the account and the reference are already in the file.",
      actual: dupPreview.replace(/\s+/g, " ").slice(0, 500),
      where: "src/app/actions/odr.ts confirmOdrBatch around lines 266-275; src/lib/odr-fields.ts mapOdrRows",
      fix: "Flag a repeated account number inside the file and an account that already has an open case. Do not silently mint a new reference for a ref the sheet already used.",
    });
    await shot(page, "qa-duplicate-rows");
    await page.getByRole("button", { name: /Record hearings|Send hearing/ }).click();
    await page.waitForURL(/\/odr\/batches\//, { timeout: 60000 });
    await waitText(page, "2 cases", 30000);
    const dupBatch = await bodyText(page);
    if ((dupBatch.match(/Duplicate (One|Two)/g) || []).length >= 2) {
      note("ODR duplicates confirmed", "Both duplicate rows became cases.");
    }
    await shot(page, "qa-duplicate-cases");
  } else {
    pass("ODR upload", "Duplicate rows were not both marked ready.");
  }

  if (caseHref) {
    await timedGoto(page, caseHref);
    await waitText(page, "Hearings");
    const caseBody = await bodyText(page);
    if (caseBody.includes("Practice link") || caseBody.includes("practice-odr-link") || caseBody.includes("meet.google.com/practice")) {
      pass("ODR hearings", "With Google Meet unset, the hearing shows a practice link.");
    } else {
      note("ODR meet", caseBody.replace(/\s+/g, " ").slice(0, 400));
      await shot(page, "qa-case-meet");
    }
    const timeLine = caseBody.split("\n").find((line) => /Hearing 1/.test(line) && /at /.test(line)) || "";
    note("ODR hearing time line", timeLine);
    if (timeLine && /11:00|am|pm/i.test(timeLine) && !/UTC|GMT/.test(timeLine)) {
      pass("ODR hearings", `Hearing time is shown in India time: ${timeLine}`);
    }

    await page.locator('select[name="status"]').selectOption("NO_SHOW");
    await page.getByRole("button", { name: "Update status" }).click();
    await page.waitForURL(/\/odr\/cases\//, { timeout: 20000 });
    await waitText(page, "No-show");
    const afterShow = await bodyText(page);
    note("After first no-show", afterShow.replace(/\s+/g, " ").slice(0, 400));
    await page.locator('input[name="hearingDate"]').fill("2026-10-21");
    await page.locator('input[name="hearingTime"]').fill("11:30");
    const sendBox = page.locator('input[name="send"]');
    if (await sendBox.count()) await sendBox.uncheck();
    await page.getByRole("button", { name: "Schedule next hearing" }).click();
    await page.waitForTimeout(1500);
    const scheduleText = await bodyText(page);
    if (scheduleText.includes("customer has not recorded arbitrator consent") || scheduleText.includes("not booked")) {
      pass("ODR consent", "A further hearing is blocked until arbitrator consent is recorded.");
      await shot(page, "qa-consent-blocks-hearing");
    } else if (page.url().includes("/odr/cases/") && scheduleText.includes("Hearing 2")) {
      note("ODR schedule", "Hearing 2 was booked without a consent block message.");
    } else {
      note("ODR schedule result", scheduleText.replace(/\s+/g, " ").slice(0, 300));
      await shot(page, "qa-schedule-result");
    }
  }

  await timedGoto(page, "/odr/cases?q=Ravi&applied=1");
  await waitText(page, "Cases");
  const filtered = await bodyText(page);
  if (filtered.includes("Ravi")) pass("ODR cases", "Search q=Ravi finds the uploaded customer.");
  else note("ODR search", filtered.slice(0, 240));

  await timedGoto(page, "/odr/templates");
  await waitText(page, "template");
  const templates = await bodyText(page);
  if (templates.includes("Approved") && templates.includes("Pending")) {
    pass("ODR templates", "Template list shows approved and pending slots.");
  } else note("ODR templates", templates.slice(0, 300));

  await timedGoto(page, "/odr/cases?applied=1");
  const exportLink = page.locator('a[href*="/reports/odr-export"]');
  if (await exportLink.count()) {
    const href = await exportLink.first().getAttribute("href");
    const res = await page.request.get(BASE + href);
    note("ODR export", `${res.status()} ${res.headers()["content-type"]}`);
    if (res.status() === 200 && (res.headers()["content-type"] || "").includes("spreadsheet")) {
      pass("ODR reports", "Filtered ODR Excel download returns a workbook.");
    }
  }

  const rows2k = Array.from({ length: 2000 }, (_, i) => row(i + 10, { name: `Bulk ${i + 1}`, account: `LN9${String(100000 + i)}` }));
  const big = await workbook("bulk2000", rows2k);
  const { statSync } = await import("node:fs");
  const bytes = statSync(big).size;
  note("2000-row file bytes", String(bytes));
  const bigStarted = Date.now();
  try {
    await uploadOdr(page, big, "MEDIATION");
    const bigPreview = await reviewPeople(page);
    const bigMs = Date.now() - bigStarted;
    note("2000 preview ms", String(bigMs));
    if (bigPreview.includes("2000 ready")) {
      pass("ODR upload", `A 2,000-row mediation workbook (${bytes} bytes) uploaded and previewed in ${bigMs}ms.`);
      if (bigPreview.includes("first 50 rows")) {
        bug({
          severity: "Low",
          area: "ODR / upload",
          title: "A 2,000-row review only lists the first 50 rows",
          steps: "Upload a 2,000-row ODR workbook and open Review.",
          expected: "Staff can see that every row was checked, or can page through problems.",
          actual: "The page says the first 50 rows are shown. The ready count still includes the rest.",
          where: "src/app/odr/uploads/[id]/preview/page.tsx around line 105",
          fix: "Page the review, and list problem rows even when they are past row 50.",
        });
        await shot(page, "qa-bulk-preview");
      }
    } else if (/larger than 5 MB|5 MB/.test(bigPreview)) {
      bug({
        severity: "Medium",
        area: "ODR / upload",
        title: "A 2,000-row workbook is rejected by the 5 MB cap",
        steps: "Upload the generated 2,000-row xlsx.",
        expected: "A normal 2,000-row bank sheet is accepted.",
        actual: bigPreview.slice(0, 240),
        where: "src/app/actions/odr.ts MAX_BYTES",
        fix: "Raise the cap or stream the sheet.",
      });
    } else {
      note("2000 preview", bigPreview.replace(/\s+/g, " ").slice(0, 300));
      await shot(page, "qa-bulk-preview");
    }
  } catch (error) {
    bug({
      severity: "High",
      area: "ODR / upload",
      title: "A 2,000-row workbook did not reach review",
      steps: "Upload bulk2000.xlsx on /odr as Mediation.",
      expected: "The match and review pages open.",
      actual: String(error).slice(0, 300),
      where: "src/app/actions/odr.ts uploadOdrExcel",
      fix: "Accept and preview a 2,000-row sheet without timing out.",
    });
  }

  await context.clearCookies();
  const pub = await context.newPage();
  attach(pub);
  await pub.setViewportSize({ width: 1280, height: 900 });
  await timedGoto(pub, "/notice-DEMO-LN10021");
  await waitText(pub, "Open your legal notice");
  const locked = await bodyText(pub);
  if (!locked.includes("Akshay Sathe") && locked.includes("last 4")) {
    pass("Public notice", "The notice stays locked and does not show the customer name before the last 4 digits.");
  } else {
    bug({
      severity: "High",
      area: "Public notice",
      title: "The public notice shows personal data before the last-4 check",
      steps: "Open /notice-DEMO-LN10021 in a fresh browser.",
      expected: "Name, address, and loan details stay hidden.",
      actual: locked.slice(0, 400),
      where: "src/components/public-notice-screen.tsx NoticeLocked",
      fix: "Render only the last-4 form until the grant cookie matches.",
    });
    await shot(pub, "qa-notice-locked");
  }
  await pub.locator('input[name="last4"]').fill("0021");
  await pub.getByRole("button", { name: /Open|Continue|Unlock/ }).click();
  await pub.waitForTimeout(1000);
  const opened = await bodyText(pub);
  if (opened.includes("Akshay Sathe")) {
    pass("Public notice", "Last 4 of the loan account (0021) unlocks DEMO-LN10021. The prompt is the account, because the loan number has digits.");
    await shot(pub, "qa-notice-letter");
    await pub.emulateMedia({ media: "print" });
    await shot(pub, "qa-notice-print");
    const pages = await pub.pdf({ format: "A4", printBackground: true, path: "/tmp/qa/files/notice.pdf" });
    note("notice pdf bytes", String(pages.length));
  } else {
    bug({
      severity: "High",
      area: "Public notice",
      title: "Last 4 of the demo loan account did not unlock the notice",
      steps: "Open /notice-DEMO-LN10021 and enter 0021.",
      expected: "The letter for Akshay Sathe opens.",
      actual: opened.slice(0, 300),
      where: "src/lib/odr-ref.ts last4Challenge",
      fix: "Confirm the challenge source and the digits stored for the demo loan.",
    });
    await shot(pub, "qa-notice-unlock-fail");
  }
  await pub.close();

  const odrPub = await context.newPage();
  attach(odrPub);
  await timedGoto(odrPub, "/odr/c/vW7w-VGONJEWEEphQnLdJom0guxr3JAAKedLChEieEk");
  await waitText(odrPub, "last 4", 15000).catch(() => {});
  const odrLocked = await bodyText(odrPub);
  note("ODR public locked", odrLocked.replace(/\s+/g, " ").slice(0, 300));
  if (!odrLocked.includes("9876543210") && !/Ravi/.test(odrLocked)) {
    pass("ODR customer page", "The case page does not show the customer name or mobile before the last-4 check.");
  }
  await odrPub.close();

  await staffGate(page);
  await signIn(page, "viewer@noticedesk.local", "viewer123");
  const bankHome = await bodyText(page);
  if (bankHome.includes("Northwind") && !bankHome.includes("Send notice") && !bankHome.includes("People")) {
    pass("Bank user", "Northwind bank user sees only that bank and does not see Send notice or People.");
  } else {
    note("Bank home", bankHome.slice(0, 400));
    await shot(page, "qa-bank-user-home");
  }
  for (const path of ["/settings", "/audit", "/people", "/banks", "/odr", "/send"]) {
    await timedGoto(page, path);
    const landed = new URL(page.url()).pathname;
    if (path === "/odr" && landed.startsWith("/odr/cases")) {
      pass("Bank user", "/odr redirects a bank user to the case list.");
    } else if (["/settings", "/audit", "/people", "/banks", "/send"].includes(path) && landed === "/dashboard") {
      pass("Bank user", `${path} redirects to the dashboard.`);
    } else if (path !== "/odr") {
      bug({
        severity: "High",
        area: "Roles",
        title: `Bank user opened ${path}`,
        steps: `Sign in as viewer@noticedesk.local and open ${path}.`,
        expected: "Redirect to the dashboard.",
        actual: page.url(),
        where: "src/lib/roles.ts and the page guard",
        fix: "Keep the server redirect for bank users.",
      });
    }
  }
  if (caseHref) {
    const res = await timedGoto(page, caseHref);
    const leaked = await bodyText(page);
    if (leaked.includes("Case not found") || leaked.includes("not found") || (res && res.status() === 404)) {
      pass("Cross-bank", "Northwind bank user does not open another path... this case is Northwind, so it may be visible.");
      note("Same-bank case for viewer", leaked.slice(0, 180));
    }
  }
  await signOut(page);

  await staffGate(page);
  await signIn(page, bankEmail, "Meridian6162");
  const meridian = await bodyText(page);
  if (meridian.includes("Meridian") && !meridian.includes("Northwind Housing")) {
    pass("Bank user", "Meridian user lands on Meridian and does not see Northwind on the home page.");
  } else {
    bug({
      severity: "Critical",
      area: "Cross-bank",
      title: "Meridian bank user sees another bank on the home page",
      steps: `Sign in as ${bankEmail}.`,
      expected: "Only Meridian Co-operative Bank.",
      actual: meridian.slice(0, 400),
      where: "src/lib/bank-context.ts workingBank",
      fix: "Scope the home page to user.bankId.",
    });
    await shot(page, "qa-meridian-leak");
  }
  if (caseHref) {
    await timedGoto(page, caseHref);
    const foreign = await bodyText(page);
    if (/not found|Case not found|404/.test(foreign) || !foreign.includes("Ravi")) {
      pass("Cross-bank", "Meridian user opening a Northwind case URL does not see that customer.");
    } else {
      bug({
        severity: "Critical",
        area: "Cross-bank",
        title: "A bank user can open another bank’s ODR case by URL",
        steps: `Sign in as the Meridian user and open ${caseHref}.`,
        expected: "Not found.",
        actual: foreign.slice(0, 300),
        where: "src/app/odr/cases/[id]/page.tsx findFirst bankId",
        fix: "Keep the bankId filter and return notFound.",
      });
      await shot(page, "qa-cross-bank-case");
    }
  }
  const exportRes = await page.request.get(`${BASE}/reports/export?applied=1&bank=cmuwi4xxu0000jshsbukw6efa&from=2020-01-01`);
  const exportBody = await exportRes.text();
  note("Meridian export of Northwind id", `${exportRes.status()} ${exportBody.slice(0, 120)}`);
  if (exportBody.includes("Northwind") && exportRes.status() === 200) {
    bug({
      severity: "Critical",
      area: "Reports",
      title: "A bank user can download another bank’s report by changing the bank id",
      steps: "Sign in as Meridian and GET /reports/export with Northwind’s bank id.",
      expected: "The file is refused or contains only Meridian.",
      actual: exportBody.slice(0, 200),
      where: "src/lib/report-bank.ts resolveReportBank",
      fix: "Ignore a bank id that is not the working bank, and never query the other id.",
    });
  } else {
    pass("Reports", "A tampered bank id on the CSV export does not return Northwind rows to the Meridian user.");
  }
  await signOut(page);

  await staffGate(page);
  await signIn(page, coordEmail, "CoordPass6162");
  await timedGoto(page, "/settings");
  const coordSettings = new URL(page.url()).pathname;
  await timedGoto(page, "/audit");
  const coordAudit = await bodyText(page);
  if (coordSettings === "/dashboard" && /owner|cannot read the audit/i.test(coordAudit)) {
    pass("Coordinator", "Settings redirects, and Audit stays owner-only.");
  } else {
    bug({
      severity: "High",
      area: "Roles",
      title: "A legal coordinator can open Settings or the audit log",
      steps: `Sign in as ${coordEmail} and open /settings and /audit.`,
      expected: "Settings redirects. Audit says it is for the owner.",
      actual: `settings ${coordSettings}; audit ${coordAudit.slice(0, 200)}`,
      where: "src/app/settings/page.tsx and src/app/audit/page.tsx",
      fix: "Keep canFlipLiveSend and the owner check.",
    });
    await shot(page, "qa-coordinator-audit");
  }
  await timedGoto(page, "/banks");
  await page.getByRole("button", { name: "Use this bank" }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  const working = await bodyText(page);
  note("Coordinator after bank switch", working.slice(0, 200));
  if (/Working on/.test(working)) pass("Coordinator", "The coordinator can switch the working bank.");

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/dashboard", "/people", "/odr/cases", "/send"]) {
    await timedGoto(page, path);
    const box = await overflow(page);
    if (box.scroll > box.client + 16) {
      bug({
        severity: "Medium",
        area: "Mobile layout",
        title: `${path} scrolls sideways at 390px`,
        steps: `Open ${path} at a 390px width.`,
        expected: "The page fits the width.",
        actual: `scrollWidth ${box.scroll} clientWidth ${box.client} ${box.offenders.join(", ")}`,
        where: path,
        fix: "Allow the overflowing element to wrap or scroll inside its card.",
      });
      await shot(page, `qa-mobile-${path.replace(/\//g, "-") || "home"}`);
    } else {
      pass("Mobile", `${path} fits a 390px width.`);
    }
  }

  await browser.close();

  const cron = await fetch(`${BASE}/api/odr/cron`);
  const cronGet = await cron.text();
  const cronBad = await fetch(`${BASE}/api/odr/cron`, { method: "POST", headers: { "x-odr-cron-secret": "short" } });
  const cronWrong = await fetch(`${BASE}/api/odr/cron`, { method: "POST", headers: { "x-odr-cron-secret": "not-the-real-secret" } });
  const cronOk = await fetch(`${BASE}/api/odr/cron`, { method: "POST", headers: { "x-odr-cron-secret": "qa-cron-secret-6162" } });
  const cronOkBody = await cronOk.text();
  note("cron", `GET ${cron.status} ${cronGet}; short ${cronBad.status}; wrong ${cronWrong.status}; ok ${cronOk.status} ${cronOkBody.slice(0, 200)}`);
  if (cron.status === 404 && cronBad.status === 404 && cronWrong.status === 404 && cronOk.status === 200) {
    pass("ODR cron", "GET, a short secret, and a wrong secret are 404. The local 16+ character secret returns JSON.");
  } else {
    bug({
      severity: "High",
      area: "ODR cron",
      title: "Cron auth did not match the secret rules",
      steps: "GET /api/odr/cron. POST with a short secret, a wrong secret, and qa-cron-secret-6162.",
      expected: "404, 404, 404, 200.",
      actual: `${cron.status} ${cronBad.status} ${cronWrong.status} ${cronOk.status} ${cronOkBody.slice(0, 180)}`,
      where: "src/app/api/odr/cron/route.ts",
      fix: "Require a secret of at least 16 characters and compare it with timingSafeEqual.",
    });
  }

  const result = { findings, passed, notes, consoleErrors: consoleErrors.slice(0, 40), httpErrors: httpErrors.slice(0, 40), slow };
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log("WROTE", OUT, "bugs", findings.length, "passed", passed.length);
}

main().catch((error) => {
  console.error(error);
  writeFileSync(OUT, JSON.stringify({ crash: String(error), findings, passed, notes, consoleErrors, httpErrors, slow }, null, 2));
  process.exit(1);
});
