# MSG91 email setup for legal notices

Notice Desk sends the approved template `legal_notice_non_payment` through the MSG91 Email API. Live send stays off unless `MSG91_LIVE_SEND=true`.

## What the app sends

Template variables on each email:

| Variable | Value |
| --- | --- |
| `contact_name` | Recipient name |
| `loan_account` | Loan / account number |
| `notice_id` | Full HTTPS notice URL (so the **current** template text that prints `{{notice_id}}` becomes a clickable link) |
| `notice_link` | Same full HTTPS URL (`https://www.notice.beingvakil.in/notice-<NOTICE_NUMBER>`) |
| `notice_code` | Bare notice number (for a nicer template later) |

There is **no** send-API flag to turn off Unsubscribe or to force open tracking. Those are **domain** settings in MSG91.

## Dashboard steps Akshay must do

### 1) Make the notice a clear clickable link (recommended template edit)

MSG91 → **Email** → Templates → `legal_notice_non_payment` → **Copy as Version** (approved templates cannot be edited in place) → edit the body → approve the new version.

Paste this body (HTML), or the same wording in the visual editor with a link on the notice URL:

```html
<p>Dear {{contact_name}},</p>
<p>We have issued a legal notice due to non-repayment of dues on your loan account {{loan_account}}.</p>
<p>Please find the attached notice: <a href="{{notice_link}}">{{notice_code}}</a></p>
<p>Or open: {{notice_link}}</p>
<p>Please contact us at your earliest convenience to avoid further action.</p>
<p>Regards,<br>Team Being Vakil</p>
```

Subject can stay:

`Legal Notice Regarding Overdue Payment - Account {{loan_account}}`

Until that version is approved, the app already puts the **full URL** into `{{notice_id}}`, so Gmail should auto-linkify it without a panel edit.

### 2) Remove Unsubscribe from legal-notice emails

MSG91 injects Unsubscribe for most non-OTP emails by default. Turn it off for this domain:

1. MSG91 → **Email** → **Domain Settings**
2. Select `beingvakil.in`
3. **Domain Configuration**
4. Disable the **Unsubscribed** / Unsubscribe link toggle
5. **Apply Changes**

Reference: [Unsubscribe link in the Emails](https://msg91.com/help/unsubscribe-link-in-the-email)

### 3) Enable open tracking + webhook into Notice Desk

**Domain**

1. Same **Domain Configuration** screen
2. Enable **Open Tracking**
3. Apply Changes

**Webhooks (panel only — not creatable via MSG91 API)**

Full copy-paste steps for Email **On Report Received** + **Opened**, plus SMS and WhatsApp delivery/read webhooks: see **`MSG91_WEBHOOKS.md`**.

Shared callback URL:

`https://www.notice.beingvakil.in/api/msg91/webhook?secret=YOUR_MSG91_WEBHOOK_SECRET`

(or header `x-notice-desk-secret`). `MSG91_WEBHOOK_SECRET` is already set on Cloud Run. Notice Desk stores the first open on `CampaignDelivery.openedAt` and marks status **Read**. Dry runs are never updated.

## Optional notice PDF

Default off. On Banks, **Attach notice PDF to email** turns it on for that bank only.

A live email then adds an MSG91 attachment:

`attachments: [{ fileName: "notice-<id>.pdf", file: "data:application/pdf;base64,..." }]`

`notice_link` and `notice_id` are still the clickable notice URL. If the PDF cannot be built, that email is marked failed and is not sent. Turn the bank setting off to send without a file.

## One-person test resend

Keep `MSG91_LIVE_SEND=false` except for a brief verify. Prefer a single email to `akshayrsat@gmail.com` only. Do not expand recipients.
