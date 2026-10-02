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
