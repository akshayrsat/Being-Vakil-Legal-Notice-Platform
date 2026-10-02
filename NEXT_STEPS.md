# Next steps

Step 7 is done. Firm staff can open Security / Audit and see who signed in, changed a bank, uploaded a file, saved a template, confirmed a dry run, prepared a follow-up, or downloaded a CSV. A Bank Viewer cannot open that log, and cannot upload, edit, confirm, or follow up. MSG91 delivery updates are accepted only when `MSG91_WEBHOOK_SECRET` is set. A dry run is never marked delivered by that call. Do not rebuild the audit log, the role checks, or the webhook.

## Optional polish

These are not required for practice on this computer. Do them only when the firm is ready to go further.

### Speed Post, later

Speed Post stays a disabled tick box. A later version can add a courier booking API, store a consignment number, and show a courier status next to SMS, email, and WhatsApp. Do not invent a courier status before that API exists.

### Live send checklist

Before anyone sets `MSG91_LIVE_SEND=true`:

- Put `MSG91_AUTH_KEY` only in `.env` on the server, never in the browser and never in a public copy of the project.
- Fill the SMS, email, or WhatsApp settings for the channels you will actually use. A missing setting fails that channel and sends nothing.
- Set `MSG91_WEBHOOK_SECRET` (at least 8 characters) and point MSG91 at `/api/msg91/webhook` with the header `x-notice-desk-secret`.
- Send one notice to a mobile the firm controls, then check the audit log and the person’s status.
- Leave live send off for practice files such as `samples/notice-recipients.xlsx`.

### Putting the site on a real server

- Use HTTPS, and turn the session cookie’s secure flag on.
- Replace the practice passwords before anyone else can reach the site.
- Keep the database file off the public web. Do not commit `prisma/dev.db`.
- The audit log is for firm staff only. Do not give a Bank Viewer a way to read another bank.
