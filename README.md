# Being Vakil Legal Notice Platform (Notice Desk)

Local web app for preparing and reviewing legal notices for client banks. Sending a notice is one screen: the bank’s spreadsheet, the approved wording, a review of who will get it, then send. The owner turns MSG91 live send on or off in Settings. That switch starts on and overrides `MSG91_LIVE_SEND`. Confirming sends for real only when the switch is on and MSG91 is set up. When the switch is off, confirming records a dry run and nothing is sent.

ODR (arbitration and mediation) is a separate tab. It does not use the notice live-send switch. ODR messages go out when the owner turns ODR messages on in Settings, and only on channels with an approved template. Set `ODR_LIVE_SEND=kill` to block that sending even if the switch is on. Any other value, including `false` or leaving it unset, leaves the decision to the switch. Without Google Meet settings, each hearing gets a practice link.

## Run locally

Install Node.js 20 or newer, then from this folder:

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` creates the local SQLite database (`prisma db push`), seeds practice users, banks, and templates (`prisma db seed`), and starts Next.js. Open [http://localhost:4317](http://localhost:4317).

That address is a public page for people who received a notice. It does not show staff sign-in. Set `NOTICE_DESK_ENTRY_CODE` in `.env` (see `.env.example`), restart, then use **Staff access** on that page. The correct code opens `/login` for about two hours. A wrong code stays on the public page. Opening `/login` without that step returns to `/`. On Cloud Run, set `NOTICE_DESK_ENTRY_CODE` in the service environment. The example placeholder is refused in production.

Copy `.env.example` only if `.env` is missing. The example has placeholder `MSG91_*` keys and does not turn live send on.

## Demo logins

These practice passwords are for your own computer. Do not put this site on the public internet with them.

- Owner: `admin@noticedesk.local` / `admin123`
- Bank user (Northwind only): `viewer@noticedesk.local` / `viewer123`

The owner can add a legal coordinator or a bank user on People. A legal coordinator is law-firm staff, not a bank user: they switch banks the same way the owner does and are not tied to one bank. They can add a bank user for one bank. Nothing is emailed when a login is added. There is no public signup.

The owner or a legal coordinator can set a temporary password on People. That password is shown once, stored only as a hash, and must be changed at the next sign-in. A legal coordinator can do this for bank users and other legal coordinators, not for the owner. Every signed-in person can change their own password. Forgot password on the sign-in page emails a one-time link (30 minutes, single use) when MSG91 email is set up for that message. That mail does not use the ODR switch or notice live send. If the mail cannot be sent, the page still gives the same reply and says to ask an admin for a temporary password.

## Bank isolation

Spreadsheets, the people in them, sends, delivery rows, public notices, Speed Post consignments, loan history, and reports belong to one bank. They are never listed for another bank.

Approved notice wording is the firm library. Any bank can select the approved MSG91 templates. Staff do not write templates in this app. Selecting a template does not open another bank’s spreadsheet or people.

The seeded library is the live MSG91 set: **Legal notice (SMS)** (`6abf5af2e9226c340a0548e2`), **Legal notice (email)** (`legal_notice_non_payment`), and **Legal notice (WhatsApp)** (`legal_notice_link`). Every bank sees those three, without a practice-bank name. To refresh the same rows on Cloud SQL without resetting passwords, run `npx tsx scripts/align-msg91-library.ts`. That script does not turn live send on.

- A bank user can read only the bank on their login. A `?bank=` parameter does not change that.
- The owner and a legal coordinator use the bank chosen with **Use this bank** (`selectedBankId`). A legal coordinator is not stored against one bank. Spreadsheets, people, sends, tracking, bank-owned templates, Speed Post, loan history, and reports stay on the bank they are working on. A `?bank=` address cannot open a different bank. Switch on the Banks page first. Only the owner can add a bank, mark one active, or open firm settings and the audit log.
- Opening a campaign, consignment, or CSV by id loads that row only when its `bankId` is the bank in use. Guessing another bank’s id returns “not found”.
- The templates page lists the three approved notice templates for every bank. Opening one shows the name, the channel, and the message. The owner admin also sees the reference id. It does not show a practice-bank name and it does not share spreadsheets or recipient rows. Sending still uses the stored ids. The owner turns live send on or off in Settings. The switch starts on and overrides `MSG91_LIVE_SEND`.
- The public letter at `/notice-<id>` stays open without sign-in. It shows that one notice and no one else’s.

## MSG91

Leave the `MSG91_*` lines in `.env` unset for a practice copy that must not send. The Settings switch starts on, but a confirm still does not call MSG91 until `MSG91_AUTH_KEY` is set. Turning the switch off records a dry run even if the key is present. The switch is stored in the database and survives a restart.

A longer walkthrough of the screens is in `NOTICE_DESK_GUIDE.md`. Speed Post, loan history, reports, and optional notice PDFs are in `SPEED_POST.md`.

## Public notice links

An SMS uses the DLT template `Legal_Notice_12092026`. The variables are `customer_name`, `bank_name`, and `notice_number`. The link written into SMS and email is:

`https://www.notice.beingvakil.in/notice-<notice_number>`

That path is this app. `/notice-<notice_number>` shows that one recipient’s demand notice on the Being Vakil Associates letterhead, with the advocate’s signature and stamp. The same page also opens at `/?notice=<notice_number>`, `/notice?notice=<notice_number>`, and `/n/<notice_number>`. Use Print letter to print or save a PDF. The printable sheet is A4 (210mm × 297mm). No sign-in is required. A missing or unknown number shows a not-found page and no other customer.

The public page is the SPEED POST demand notice. Name, address, overdue amount, loan type, loan number, reference number, collection manager, and bank website come from the spreadsheet. The bank name is the bank on the send. Email uses the short demand email, with the same letterhead and stamp, and the same `/notice-<id>` link.

Set `NOTICE_PUBLIC_BASE_URL` to the public host (`https://www.notice.beingvakil.in`). If it is unset, a local run uses `http://localhost:4317` and a production run uses `https://www.notice.beingvakil.in`. Preparing a send stores a notice for each person and puts that notice number in the SMS text and in the MSG91 variables. The owner’s Settings switch decides whether confirming that send goes out.

Practice pages after `npm run dev`:

- Akshay Sathe: [http://localhost:4317/notice-DEMO-LN10021](http://localhost:4317/notice-DEMO-LN10021)
- Akshay R Sathe: [http://localhost:4317/notice-DEMO-LN10022](http://localhost:4317/notice-DEMO-LN10022)
- Shweta Sudhir: [http://localhost:4317/notice-DEMO-LN10023](http://localhost:4317/notice-DEMO-LN10023)
