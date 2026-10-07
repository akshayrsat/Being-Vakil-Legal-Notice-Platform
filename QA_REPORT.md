# QA report — Notice Desk and ODR

This is a test report only. No product code was changed, and nothing here should be merged as a fix.

Date: 7 October 2026. App: Next.js 16.3.8, local `next start` on port 4317, SQLite seed. Google Meet, India Post, and live MSG91 credentials were unset. One pass used a local fetch stub that answered `control.msg91.com` and `api.msg91.com` and wrote the URL to a log. No message left this machine. `ODR_LIVE_SEND=kill` was checked on a separate start. The ODR messages switch and the send window were put back afterwards.

Practice logins from the seed were used (owner, Northwind bank user). A legal coordinator and a Meridian bank user were created in the local database for the role checks.

## Summary

| Severity | Count |
| --- | --- |
| Critical | 0 |
| High | 2 |
| Medium | 5 |
| Low | 2 |

Cross-bank isolation held. The ODR messages switch, the kill switch, the cron secret, the customer last-4 gate, and the Section 11 award block behaved as designed. The defects below are the ones that failed a click or a direct code check.

## Bugs

### High

#### 1. The sign-in cookie is never marked Secure

**Steps.** Read `startSession` and `signOut` in `src/app/actions/auth.ts`.

**Expected.** On the HTTPS Cloud Run site, the session cookie is `Secure` and `HttpOnly`, the same way the staff-door cookie is `Secure` when `NODE_ENV` is production (`src/lib/staff-gate.ts`).

**Actual.** The session cookie is set with `secure: false` in every environment (`src/app/actions/auth.ts` around lines 206–212, and the matching clear around lines 326–333). A comment says to turn Secure on for HTTPS. The code never does. The cookie is `HttpOnly` and `SameSite=Lax`, and it lasts 14 days. Anyone who can read it can open every bank’s notices and ODR cases.

**Where.** `src/app/actions/auth.ts` lines 206–212.

**Fix.** Set `secure: true` when the site is served over HTTPS (production, or when `NOTICE_PUBLIC_BASE_URL` is `https`). Keep the clear-cookie call on the same flags.

#### 2. The last-4 check can be guessed once the link is known

**Steps.** Open a public notice or an ODR customer link. The page asks for 4 digits. The limit is 8 tries in 15 minutes, counted in memory, keyed on the first `X-Forwarded-For` value (`src/lib/rate-limit.ts`, `src/lib/odr-access.ts` `clientIp`, `src/app/actions/notice-public.ts` line 42, `src/app/actions/odr-public.ts` line 79).

**Expected.** A wrong guess locks the link for everyone, on every server instance, and the client cannot pick a fresh counter by sending a new forwarding header.

**Actual.** There are 10,000 possible values. The counter lives in one Node process and is dropped on restart. Cloud Run can run more than one instance, and the file itself says this is only a backstop. The client can send a new first `X-Forwarded-For` value and get a new counter. The notice number and the ODR token are unguessable on their own (12 random characters, or 32 random bytes). The last 4 digits are the weak part after the SMS or email is seen.

**Where.** `src/lib/rate-limit.ts` lines 1–23; `src/lib/odr-access.ts` lines 7–14.

**Fix.** Count failures in the database, per notice or per case, and ignore a client-supplied forwarding header. Use the connecting address Cloud Run sets. Add a lockout that does not reset when a new instance starts.

### Medium

#### 3. A bad mobile and a bad email are still a ready row

**Steps.** Upload an ODR workbook with customer `Bad Contact`, account `LN8801999`, mobile `12345`, email `not-an-email`. Match the columns and open Review.

**Expected.** The row is left out, with a problem for the mobile and the email.

**Actual.** The row is **Ready**. The channel lines say “No mobile number” and “No email address”, so the case would be filed with nobody to contact. An empty name and an account shorter than 4 digits on the next row were left out, which is correct. This batch was not confirmed, so no case was created.

**Where.** `src/lib/odr-fields.ts` lines 298–300. Only the name and the account length add a problem. Mobile and email are copied through.

**Fix.** Treat a non-empty mobile that is not 10 digits, and a non-empty email with no `@`, as problems. Leave the row out.

**Screen.** `qa-bad-contact-ready.png`

#### 4. The same account and the same reference become two cases

**Steps.** Upload two ODR rows with account `LN8801777` and reference `DUP-965719`. Review, then confirm.

**Expected.** The second row is left out, or the review says the account and the reference are already in the file.

**Actual.** Both rows are Ready, both showing `DUP-965719`. Confirm created two Northwind cases: `DUP-965719` / Duplicate One and `ARB-2026-NY4V39` / Duplicate Two. The second reference was replaced with no message (`src/app/actions/odr.ts` lines 272–274: if the reference is already taken, a new one is generated).

**Where.** `src/lib/odr-fields.ts` `mapOdrRows`; `src/app/actions/odr.ts` lines 272–274.

**Fix.** Flag a repeated account inside the file, and an account that already has an open case for that bank. Do not mint a new reference for a reference the sheet already used.

**Screens.** `qa-duplicate-rows.png`, `qa-duplicate-cases.png`

#### 5. The printed letter drops the footer image

**Steps.** Open `/notice-DEMO-LN10021`, enter `0021` (last 4 digits of loan `LN10021`), wait until the footer image has loaded, then print to A4 PDF.

**Expected.** Every page is A4. The letterhead is on the first page. The signature, the bank grievance block, and the Being Vakil footer image finish the letter. Nothing is cut off.

**Actual.** The PDF is 3 A4 pages (595.92 × 842.88 pt). The body and the grievance text are complete. Page 3 has the signature and the grievance text, then a blank lower half. The footer image (`/branding/letterhead-footer.png`) is not on the page, even after the image had loaded in the browser. The on-screen letter includes that image. Print CSS marks `.notice-closing` as `break-inside: avoid`. That block holds the signature, the grievance note, and the footer image together (`src/components/public-notice-screen.tsx` `NoticeClosing`).

**Where.** `src/app/globals.css` lines 496–502; `src/components/notice-letter.tsx` lines 22–32.

**Fix.** Let the closing block split, and keep `break-inside: avoid` only on the footer image so it moves to the next page instead of being dropped.

**Screen.** `qa-notice-pdf-p3-3.png`

#### 6. Review describes a send that confirm does not record, and the button says Send when every channel is skipped

**Steps.**

1. With ODR messages off, upload a valid arbitration sheet and open Review. The lines were `SMS: template not ready`, `EMAIL: not sent (ODR sending off)`, `WHATSAPP: not sent (ODR sending off)`. Confirm. The batch finished with 0 sent, 0 not sent, and em dashes for every channel. No message rows existed until the Section 12 disclosure, the arbitrator acceptance, and the Section 21 notice were uploaded later.
2. Turn ODR messages on. Upload a mediation sheet. Review said `template not ready` for SMS, email, and WhatsApp, and the button still said **Send hearing messages**. Confirm recorded three skipped rows and sent nothing.

**Expected.** The review says when arbitration notices are held for the three tribunal PDFs. The button says “Record hearings, do not send” when every channel will be skipped.

**Actual.** The preview calls `planOdrChannels` without the hearing slot (`src/app/odr/uploads/[id]/preview/page.tsx` lines 37–39). In `templateReady`, a missing slot with any vendor id is treated as ready (`src/lib/odr-plan.ts` lines 28–32, `if (!slot) return true`). The runner passes the slot and skips a channel that is not on the approved list. Arbitration confirm also sets `sendMessages` to false until `releaseArbitrationNotices` (`src/app/actions/odr.ts` around line 348, `src/lib/odr-notice-gate.ts`). The review does not say that.

**Fix.** Pass `"first"` (or the real slot) into `planOdrChannels`. On the preview, if the route holds notices, say they stay held until the three PDFs are on the case. If every channel is skipped, label the button “Record hearings, do not send”.

**Screens.** `qa-odr-preview-off.png`, `qa-mediation-preview-on.png`

#### 7. The session token is stored in clear text

**Steps.** Read `startSession` and the `Session` model.

**Expected.** A stolen database does not contain a usable session. Password-reset tokens are already stored as a SHA-256 hash (`src/lib/passwords.ts`).

**Actual.** `prisma.session.create` stores `randomBytes(32).toString("hex")` as `Session.token` (`src/app/actions/auth.ts` lines 172–181; `prisma/schema.prisma` model `Session`). Passwords are bcrypt with 10 rounds. Reset tokens are hashed. Session tokens are not.

**Fix.** Store the hash of the session token. Send the raw token only in the cookie.

### Low

#### 8. Arbitration is already selected on the upload form

**Steps.** Open `/odr` and do not touch the legal-route radios.

**Expected.** No route is selected until the user chooses Arbitration, Mediation, Conciliation, or Lok Adalat. The server does reject a post with no route (checked by removing the radio names).

**Actual.** Arbitration is checked on first paint (`src/components/odr-upload-form.tsx`, `useState("ARBITRATION")`).

**Fix.** Start the route state empty and keep the radio required.

**Screen.** `qa-route-preselected.png`

#### 9. A 2,000-row review lists only the first 50 rows

**Steps.** Upload a 98 KB mediation workbook with 2,000 data rows (customer, account, mobile, email) and open Review.

**Expected.** Staff can see that every row was checked, or can page through the rows.

**Actual.** The upload and review finished in about 755 ms. The page said **2000 ready** and “the first 50 rows”. A sheet with only a header and no data rows stayed on the form and said “The sheet has column names but no data rows.”

**Where.** `src/app/odr/uploads/[id]/preview/page.tsx` (the 50-row slice).

**Fix.** Page the review, and always list problem rows even when they are past row 50.

**Screen.** `qa-bulk-preview.png`

## What passed

**Notice Desk**

- The staff entry code opens `/login`. A wrong path back to `/login` without the cookie returns to the public page (existing behaviour, not re-broken).
- Forgot password returned the same sentence for `nobody-qa@example.com` and `admin@noticedesk.local`, plus the note to ask an admin, while mail was unset. No mail was sent.
- The owner can open Home, Send notice, ODR, Templates, ODR templates, Legal notice templates, Tracking, Speed Post, Reports, Banks, People, Settings, and Audit.
- A new legal coordinator is stored with no bank and is listed under Law-firm staff. The owner is hidden from that coordinator’s People page.
- A new Meridian bank user is listed under that bank.
- The Northwind bank user does not see Send notice or People. `/settings`, `/people`, and `/banks` redirect to the dashboard. `/send` redirects to Tracking (`/deliveries`), which is the bank user’s own list. `/audit` stays on the URL and shows only “This page is for the owner…” with no events.
- The coordinator’s Settings redirect to the dashboard. Audit shows the same owner-only sentence. The coordinator sees every bank, can switch the working bank, and does not see “Mark inactive”.
- A tampered `bank=` on `/reports/export` returned only Meridian rows to the Meridian user. The Meridian user opening a Northwind case URL did not see that customer.
- Public notice `/notice-DEMO-LN10021` hides the customer name until the last 4 digits. `0021` unlocks it because the loan number is `LN10021`, so the challenge is the account, not the mobile. The letter is dated in `dd/mm/yyyy` and shows the bank grievance officer (Priya Nair, phone, email, RBI Ombudsman, wording approved 12 March 2026).
- Dashboard, People, ODR cases, Send notice, and the customer case page fit a 390px width (no sideways scroll).

**ODR**

- A two-row arbitration workbook mapped and confirmed. Hearing 1 showed **20 October 2026 at 11:00 am** (stored `2026-10-20T05:30:00Z`, which is 11:00 IST). With Google Meet unset, the link was `https://meet.google.com/practice-odr-link-…` and the page called it a practice link.
- The customer link hid the name until last 4 `1001`. After that it showed the name, address, claim, and account ending `1001`. It showed the Section 12(5) waiver. Join stayed closed until that choice is recorded. The page fit 390px.
- Marking No-show set status `NO_SHOW`, `noShowCount` 1, hearing attendance `NO_SHOW`, and left `exParte` false. The page said “1 no-show. Not ex parte.” Scheduling the next hearing was blocked: “The next hearing is not booked. The customer has not recorded arbitrator consent.”
- After `firstNoticeAt` was set 40 days earlier, the case page said “No choice within the allowed days” and “No valid appointment consent: consider Section 11 application or Lok Adalat referral.”
- Search `q=Ravi` found the case. The filtered Excel export returned a workbook.
- ODR templates lists approved and pending slots. Settings, with the kill switch off, shows On/Off and a link to templates, and does not show the old “not ready” warning or a wording dump.
- With the switch off, confirm recorded the hearing and did not call MSG91.
- With the switch on and the fetch stub in place, a mediation first hearing recorded SMS, email, and WhatsApp as **Skipped / template not ready** and did not call the network.
- After the three arbitration PDFs were uploaded, the customer email and WhatsApp and the arbitrator email were queued. SMS stayed “template not ready”. Outside 09:00–18:30 IST they waited with “Waiting for the send window”. After the window was opened for the test, cron marked those three **Sent** and the stub log contained exactly two `control.msg91.com/api/v5/email/send` calls and one WhatsApp outbound call. No SMS URL was called. The window was set back to 09:00–18:30 and the ODR switch was set back to off.
- `ODR_LIVE_SEND=kill` with the stored switch on showed “ODR messages are on” and “Sending is blocked by the server. Confirming records the message. Nothing is sent.” The practice owner does not see the variable name; that line is only for the owner-admin emails.
- `GET /api/odr/cron` is 404. POST with a short secret or a wrong 16-character secret is 404. POST with the local 16+ character secret returned `{"reminders":0,"rescheduled":0,"attendance":0,"schedules":0}`.

**Not fully clicked**

- A full Notice Desk Excel confirm (upload, map, review, confirm) was not completed in this pass. The notice switch on Settings was On, which matches the default in the README. With no MSG91 key, a confirm cannot reach MSG91. The ODR path above is the one that was confirmed end to end.
- A second and third no-show were not entered. The next hearing cannot be booked until consent, and auto-reschedule days is 0 (off), so cron does not create the next date. The case page and the queue copy say a case at the limit should get a final-opportunity notice and is not marked ex parte. That limit is 3 by default. Only the first no-show was exercised.
- Automated accessibility scan was not run. The sign-in, forgot-password, and last-4 fields that were used have visible labels. The follow-up browser pass recorded no console errors and no HTTP 500s.

## DPDP compliance review

**This is a technical review of the software, not legal advice.** It is not an opinion that any ground under the Digital Personal Data Protection Act, 2023 is available, and it is not a substitute for counsel. Items marked for a lawyer should be confirmed against the Act, the Digital Personal Data Protection Rules, 2025 (notified November 2025, with phased commencement), and the commencement dates that apply to this firm. Do not treat a “Met” below as a legal conclusion.

**Roles, as the code actually behaves.** The bank uploads the borrower file and the cases, notices, and reports are stored against `bankId`. For that work the bank is the Data Fiduciary and Being Vakil Associates / this platform is a Data Processor acting on the bank’s instructions. The firm is in a different position for its own staff logins, its advocate records, and the award or settlement draft it prepares as counsel. That second role is not spelled out in the product. Counsel should say whether that file is the firm’s own fiduciary processing or still the bank’s.

**Which legal ground is in the product.** The ODR “consent” step is the borrower’s choice of arbitrator and the Section 12(5) waiver under the Arbitration and Conciliation Act. It is not a consent request under section 6 of the DPDP Act. Section 7 legitimate uses are not automatic for a private bank’s recovery file. The State limbs (performance of a function under law, and disclosure to the State) are written for the State. A judgment or order is a separate limb, and it applies once an order exists. The closer limb for a loan file is the specified purpose for which the borrower voluntarily gave the data, if recovery is inside that purpose and the borrower has not indicated that they do not agree to that use. Counsel has to pick the ground. The product currently records neither a DPDP notice nor a “do not use my data for this” signal.

| Topic | Rating | Evidence | Concrete fix |
| --- | --- | --- | --- |
| Purpose limitation and data minimisation | Partly met | Uploads keep mapped columns and redact a 12-digit number that does not start with 91, and a long card number (`src/lib/data-min.ts`). Award fields whose key contains `aadhaar` keep the last 4 only (`src/lib/odr-paper.ts` `aadhaarLast4`, label “Aadhaar, last 4 digits only”). A 12-digit Aadhaar that starts with 91 is not redacted, because that pattern is left for mobiles. Staff case pages and the ODR Excel export show the full mobile, email, and address (seen on the Ravi Good case: mobile `9845012345`). The public notice shows no name before the last-4 check and the full letter after it. The ODR customer page shows no name before the check; after it, the name, address, claim, and account ending are shown. There is no purpose statement on those pages. | Mask mobile and email on staff screens that do not need the full value, and in exports that are not the send file. Reject or redact an Aadhaar-like 12-digit value even when it starts with 91 if the column is not a phone. Put a short purpose line on the public notice and the customer case page. |
| Notice and consent, including withdrawal | Gap | No privacy page or privacy notice exists (search of `src` found no privacy notice). The customer consent form records ACCEPT / panel choice / OBJECT and a typed name, and tells the user the record is not edited (`src/app/actions/odr-public.ts` `recordAppointmentConsent`). There is no control that means “stop using my personal data.” The grievance block on the notice and the customer page is the **bank’s** grievance officer and the RBI Ombudsman (`src/lib/grievance.ts`). That is a banking complaint contact, not a DPDP notice. | If counsel relies on consent, add a DPDP notice before the data is used, a way to withdraw, and a record of that withdrawal. If counsel relies on a section 7 ground, say so in the notice and still offer the grievance contact. Do not describe the arbitrator waiver as DPDP consent. |
| Security safeguards (Rules-style) | Partly met | Transit: the public site is HTTPS on Cloud Run; the session cookie is not `Secure` (bug 1). At rest: personal data and PDF bytes sit in plaintext columns. Cloud SQL disk encryption is not configured in this repo. Access: bank isolation and role checks held in this run. Audit: `AuditEvent` rows exist and non-owners see no rows. ODR customer actions write `OdrAccessLog` (IP, user agent, kind). Nothing deletes those logs on a one-year clock, and nothing proves they are kept for a year. Passwords: bcrypt, 10 rounds. Reset tokens: hashed. Session tokens: plaintext (bug 7). Rate limit: in memory (bug 2). Links: notice numbers and ODR tokens are unguessable. Operational logs skip keys whose names look like secrets (`src/lib/desk-log.ts`) and do not log the notice body. Sub-processors that can receive borrower contact data: MSG91 (SMS, email, WhatsApp), Meta via WhatsApp, Google (Meet and Calendar), India Post if tracking is turned on, Google Cloud Run (`asia-south1` is named in `MSG91_WEBHOOKS.md`). | Fix bugs 1, 2, and 7. Document that Cloud SQL and Cloud Run stay in India, with encryption at rest turned on. Keep access logs for at least one year and restrict who can read them. List the sub-processors in the bank contract. |
| Personal data breach readiness | Gap | There is no detector, no incident record, no path that notifies the Data Protection Board, no path that notifies affected people, and no path that notifies the bank as fiduciary. A failed send is a delivery status, not a breach workflow. | Write a short runbook: who decides it is a breach, how the bank is told, what is sent to the Board and to affected people, and the clocks in the Rules. Confirm those clocks with counsel. Store the incident note outside the borrower record. |
| Retention and erasure | Partly met | Raw upload sheets are cleared after `sheetRetentionDays` (default 30) by the cron, 40 sheets per run (`src/lib/odr-runner.ts` `purgeExpiredPersonalData`, `src/lib/data-min.ts`). Closed-case clearing is off until the owner sets a number of days (default 0). When it runs, it blanks the case contact fields and deletes respondents. It does not delete messages, documents, consents, access logs, status notes, public notices, campaign rows, or exports. Settings copy matches the narrow blanking (`src/components/odr-settings-form.tsx`). There is no “erase this person” action. | Agree a schedule with each bank (notices, cases, messages, PDFs, exports). Make closed-case clearing cover messages and documents, or document a legal hold that requires keeping them. Add an erasure job the firm can run when the bank instructs it, including public-notice rows. |
| Data principal rights | Gap. The bank, as fiduciary, owes the rights. The firm must be able to help. | There is no request form for access, correction, erasure, or a nominee. The bank grievance officer is printed on the notice (seen on the demo letter) and on the ODR customer page. The firm’s own grievance officer is not shown. There is no timer or queue for a request. | Publish a contact for privacy requests (firm contact if the firm is a fiduciary for its own file; bank contact when the bank is the fiduciary). Give staff a way to find one person’s rows across notices, cases, messages, and uploads, and to correct or erase them on the bank’s instruction. Counsel should set the response time. |
| Children’s data | Gap | Borrower sheets have no date of birth and no age check. Nothing in the product says borrowers are treated as adults. A minor in a sheet would be processed like any other row. | Write down the assumption (loan borrowers are adults) and what staff do if a date of birth or a guardian appears. Counsel should confirm whether any minor-data rule still applies. |
| Cross-border transfer | Partly met. Needs a lawyer. | The repo names Cloud Run in `asia-south1`. It does not pin the Cloud SQL region. MSG91 is the Indian gateway used for SMS, email, and WhatsApp. WhatsApp delivery is Meta. Meet and Calendar are Google. The Act allows a transfer unless the Central Government restricts the destination. This repo has no list of destinations and no check against a restricted list. | Record where each sub-processor stores and processes the data. Keep Cloud SQL in India if that is the decision. Confirm the current restricted-destination list with counsel before turning WhatsApp or Google Meet on for a live matter. |
| Processor terms a bank will ask for | Gap. This is the firm’s contract, not a screen. | The product has no data-processing addendum and no published sub-processor list. Processing is “whatever the upload and the ODR buttons do.” | Give each bank a short DPA: purposes, instructions, security, breach notice to the bank, retention, deletion, audit help, and the sub-processors (MSG91, Meta, Google, India Post, Google Cloud). |

### Top fixes, in order

1. Mark the session cookie `Secure` on HTTPS, and store only a hash of the session token.
2. Put the last-4 lockout in the database, per link, and stop trusting a client-supplied IP.
3. Publish a privacy notice and a grievance contact on the public notice and the ODR customer page. State the purpose. Keep the arbitrator waiver separate from DPDP consent. Counsel chooses the section 6 or section 7 ground.
4. Add a breach runbook: tell the bank, tell the Board, tell affected people. Confirm the clocks with counsel.
5. Extend retention so closed cases, messages, PDFs, public notices, and exports follow one schedule, and add an erasure path for one person.
6. Give the bank a DPA and a sub-processor list before live WhatsApp, email, or Google Meet is used for borrower data.

The product bugs on bad contact data and duplicate accounts (items 3 and 4 above) also create extra personal-data records. They belong in the same queue.

## Screens and files

Screenshots are in the run artifacts:

- `qa-bad-contact-ready.png`
- `qa-duplicate-rows.png`
- `qa-duplicate-cases.png`
- `qa-notice-letter.png`
- `qa-notice-pdf-p3-3.png`
- `qa-odr-preview-off.png`
- `qa-mediation-preview-on.png`
- `qa-odr-switch-on.png`
- `qa-odr-kill.png`
- `qa-section11-warning.png`
- `qa-customer-consent.png`
- `qa-route-preselected.png`
- `qa-bulk-preview.png`
- `qa-schedule-result.png`

Browser scripts used for this pass are under `qa/`. They talk to a local server and, in a few cases, change the local practice database (consent clock, send window, ODR switch). They are not for a live database.
