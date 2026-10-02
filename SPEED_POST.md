# Speed Post, loan history, reports, and notice PDFs

## Database

Local practice uses SQLite. `npm run dev` runs `prisma db push`, which adds the new tables and the `Bank.attachNoticePdf` column.

Cloud SQL (Postgres) should run this file once:

`prisma/migrations/20261002150000_speed_post_loan_reports/migration.sql`

That adds:

- `Bank.attachNoticePdf` (default false)
- `SpeedPostConsignment` and `SpeedPostEvent`
- indexes on `PublicNotice.loanNumber` and `PublicNotice.customerId`

Existing notice, delivery, and webhook columns are left as they are.

## Speed Post

Staff open **Speed Post**, or the Speed Post card on a send.

- Mark one person, or everyone on a send. That creates a consignment in status **Booked**.
- Enter an article number (8 to 20 letters or numbers, for example `EK123456789IN`).
- Add a later status: booked, in transit, out for delivery, delivered, or returned. Each change keeps the time and a short note.
- Import `samples/speed-post-import.csv`. Headers can be `article_number`, `notice_number`, `loan_number`, `customer_id`, `customer_name`, `status`, `note`, and `occurred_at`.

No India Post key is stored in the repo. Refresh calls a tracking API only when both of these are set:

- `INDIA_POST_API_BASE_URL`
- `INDIA_POST_API_KEY`

The call is `GET {base}/track/{article}` with `Authorization: Bearer {key}`. The JSON has to look like:

```json
{
  "status": "IN_TRANSIT",
  "events": [
    { "status": "BOOKED", "note": "Booked at Mumbai", "occurredAt": "2026-10-01T10:00:00.000Z" }
  ]
}
```

If that shape is missing, the saved consignment is left unchanged. The provider lives in `src/lib/postal.ts` (`PostalTrackingProvider`) so a real India Post adapter can replace the HTTP client later.

## Loan history

**Loans** searches by loan number or account number (`customerId` on the spreadsheet). The timeline lists, in time order:

- notice created
- SMS, email, and WhatsApp status
- message opened or read
- public notice link opened
- Speed Post events

The same timeline is linked from a send, from Find a person, and from a consignment.

## Reports

**Reports** shows, for one bank and a date range:

- failure rate by SMS, email, and WhatsApp (failed or bounced, over live attempts)
- opened and not opened (email and WhatsApp)
- notice links opened and not opened
- Speed Post counts, including returned

Dry runs are listed separately and are not treated as failures. Download summary CSV from Reports, or the row CSV from Find a person. Row CSVs now include Speed Post article and status.

## Notice PDF on email

Default is off for every bank.

On **Banks**, press **Attach notice PDF to email**. A live email then attaches a PDF rendered on the server from the same demand notice (`src/lib/notice-pdf.ts`, using PDFKit and the letterhead images when they are on disk). The MSG91 template variables, including the clickable notice URL, are unchanged. If the PDF cannot be built, that email row is marked failed and is not sent.

Turn it off again with **Stop email PDFs**.

`MSG91_LIVE_SEND` must still be the exact value `true` before any live email goes out.

## Staff entry code

The public page keeps the staff door from the main site. Set `NOTICE_DESK_ENTRY_CODE` (at least 8 characters) and use **Staff access** on that page. The code is not stored in the repo. Public notice links and `/api/msg91/webhook` stay open. In production the example placeholder is refused, so the door stays locked until a real code is set on the server.
