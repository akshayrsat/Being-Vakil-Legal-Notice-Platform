# Being Vakil Legal Notice Platform (Notice Desk)

Local web app for preparing and reviewing legal notices for client banks. A confirmed send is a dry run until MSG91 is configured. Live MSG91 send stays off until you add keys and set `MSG91_LIVE_SEND=true`.

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

- Admin (firm staff): `admin@noticedesk.local` / `admin123`
- Bank viewer: `viewer@noticedesk.local` / `viewer123`

## MSG91

Leave the `MSG91_*` lines in `.env` unset. No live SMS, email, or WhatsApp goes out until `MSG91_AUTH_KEY` is set and `MSG91_LIVE_SEND=true`. A key on its own does not send.

A longer walkthrough of the screens is in `NOTICE_DESK_GUIDE.md`.

## Public notice links

An SMS uses the DLT template `Legal_Notice_12092026`. The variables are `customer_name`, `bank_name`, and `notice_number`. The link written into SMS and email is:

`https://www.notice.beingvakil.in/notice-<notice_number>`

That path is this app. `/notice-<notice_number>` shows that one recipient’s demand notice on the Being Vakil Associates letterhead, with the advocate’s signature and stamp. The same page also opens at `/?notice=<notice_number>`, `/notice?notice=<notice_number>`, and `/n/<notice_number>`. Use Print letter to print or save a PDF. The printable sheet is A4 (210mm × 297mm). No sign-in is required. A missing or unknown number shows a not-found page and no other customer.

The public page is the SPEED POST demand notice. Name, address, overdue amount, loan type, loan number, reference number, collection manager, and bank website come from the spreadsheet. The bank name is the bank on the send. Email uses the short demand email, with the same letterhead and stamp, and the same `/notice-<id>` link.

Set `NOTICE_PUBLIC_BASE_URL` to the public host (`https://www.notice.beingvakil.in`). If it is unset, a local run uses `http://localhost:4317` and a production run uses `https://www.notice.beingvakil.in`. Preparing a send stores a notice for each person and puts that notice number in the SMS text and in the MSG91 variables. `MSG91_LIVE_SEND` stays off unless you set it to `true`.

Practice pages after `npm run dev`:

- Akshay Sathe: [http://localhost:4317/notice-DEMO-LN10021](http://localhost:4317/notice-DEMO-LN10021)
- Akshay R Sathe: [http://localhost:4317/notice-DEMO-LN10022](http://localhost:4317/notice-DEMO-LN10022)
- Shweta Sudhir: [http://localhost:4317/notice-DEMO-LN10023](http://localhost:4317/notice-DEMO-LN10023)
