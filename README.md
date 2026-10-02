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

Copy `.env.example` only if `.env` is missing. The example has placeholder `MSG91_*` keys and does not turn live send on.

## Demo logins

These practice passwords are for your own computer. Do not put this site on the public internet with them.

- Admin (firm staff): `admin@noticedesk.local` / `admin123`
- Bank viewer: `viewer@noticedesk.local` / `viewer123`

## MSG91

Leave the `MSG91_*` lines in `.env` unset. No live SMS, email, or WhatsApp goes out until `MSG91_AUTH_KEY` is set and `MSG91_LIVE_SEND=true`. A key on its own does not send.

A longer walkthrough of the screens is in `NOTICE_DESK_GUIDE.md`.

## Public notice links

An SMS uses the DLT template `Legal_Notice_12092026`. The variables are `customer_name`, `bank_name`, and `notice_number`. The registered link is:

`www.notice.beingvakil.com/?notice=##notice_number##`

That address is this app. `/?notice=<notice_number>` shows that one recipient’s notice on the Being Vakil Associates letterhead, with the advocate’s signature and stamp. The same page is also at `/notice?notice=<notice_number>` and `/n/<notice_number>`. Use Print letter to print or save a PDF. No sign-in is required. A missing or unknown number shows a not-found page and no other customer.

Set `NOTICE_PUBLIC_BASE_URL` to the public host. If it is unset, a local run uses `http://localhost:4317` and a production run uses `https://www.notice.beingvakil.com`. Preparing a send stores a notice for each person and puts that notice number in the SMS text and in the MSG91 variables. `MSG91_LIVE_SEND` stays off unless you set it to `true`.

Practice pages after `npm run dev`:

- Akshay Sathe: [http://localhost:4317/?notice=DEMO-LN10021](http://localhost:4317/?notice=DEMO-LN10021)
- Akshay R Sathe: [http://localhost:4317/?notice=DEMO-LN10022](http://localhost:4317/?notice=DEMO-LN10022)
- Shweta Sudhir: [http://localhost:4317/?notice=DEMO-LN10023](http://localhost:4317/?notice=DEMO-LN10023)
