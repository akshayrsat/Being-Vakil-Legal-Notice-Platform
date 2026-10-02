# MSG91 → Notice Desk delivery / open webhooks

Cloud Run already exposes:

`POST https://www.notice.beingvakil.in/api/msg91/webhook`

Auth (pick one):

- Query: `?secret=<MSG91_WEBHOOK_SECRET>`
- Header: `x-notice-desk-secret: <MSG91_WEBHOOK_SECRET>`
- Header: `Authorization: Bearer <MSG91_WEBHOOK_SECRET>`

`MSG91_WEBHOOK_SECRET` is set on Cloud Run (`notice-desk`, asia-south1). Live send stays off (`MSG91_LIVE_SEND=false`) until you deliberately turn it on.

MSG91 has **no public API to create these webhooks** — create them in the MSG91 panel. One webhook per event type (MSG91 requirement). Endpoint must return HTTP 200 within 8 seconds.

What Notice Desk does with a matching **LIVE** `CampaignDelivery` row:

| Event | Status set | Extra |
| --- | --- | --- |
| Delivered / SMS status `1` / email eventId `4` | `DELIVERED` | — |
| Opened / Read / email eventId `5` | `READ` | sets `openedAt` (first open) |
| Failed / Rejected / email eventId `9` | `FAILED` | — |

Dry-run campaigns are never updated. Matching order: `providerId` (= MSG91 `requestId`) → email → last-10 mobile digits.

---

## Exact callback URL (same for every webhook)

```
https://www.notice.beingvakil.in/api/msg91/webhook?secret=YOUR_MSG91_WEBHOOK_SECRET
```

Prefer also adding header `x-notice-desk-secret` = the same secret in the MSG91 webhook “Headers” box (harder to leak in logs than the query string alone).

---

## Email (required for open tracking)

Prerequisites in MSG91 → **Email** → **Domain Settings** → `beingvakil.in` → Domain Configuration:

1. Enable **Open Tracking** → Apply Changes
2. (Recommended) Disable Unsubscribe for this domain — see `MSG91_EMAIL.md`

Create **two** webhooks: MSG91 → **Email** → **Webhook (New)** → Create Webhook

### A) Email delivery reports

| Field | Value |
| --- | --- |
| Name | `Notice Desk Email Report` |
| Service | Email |
| Event | **On Report Received** (Delivered / Failed) |
| Callback URL | `https://www.notice.beingvakil.in/api/msg91/webhook?secret=YOUR_MSG91_WEBHOOK_SECRET` |
| Header (optional) | `x-notice-desk-secret` = secret |

Include parameters: `requestId`, `recipient`, `eventId`, `eventName`, `statusUpdatedAt`, `reason`, `subject`, `variables`, `sendTo`

### B) Email opens

| Field | Value |
| --- | --- |
| Name | `Notice Desk Email Opened` |
| Service | Email |
| Event | **On Opened / Unsubscribed / Clicked / Complaints** |
| Callback URL | same as above |
| Header (optional) | same |

Include parameters: `requestId`, `recipient`, `eventId`, `eventName`, `statusUpdatedAt`, `subject`, `variables`

Email eventIds Notice Desk understands: `4` Delivered, `5` Opened, `9` Failed. Queued/Accepted (`1`/`2`) are ignored.

Docs: https://msg91.com/help/webhook-new/how-to-receive-email-delivery-reports-via-webhook-new

---

## SMS (delivery)

MSG91 → **SMS** → **Webhook (New)** → Create Webhook

| Field | Value |
| --- | --- |
| Name | `Notice Desk SMS Report` |
| Service | SMS |
| Event | **On Report Received** |
| Callback URL | same URL as email |

Include: `requestId`, `telNum`, `eventName`, `status`, `failureReason`, `deliveryTime`, `senderId`

`eventName` / `status` examples: delivered / `1`, failed / `2` or rejected.

Docs: https://msg91.com/help/webhook-new/how-to-receive-sms-delivery-reports-via-webhook-new

---

## WhatsApp (delivery + read)

MSG91 → **WhatsApp** → **Webhook (New)** → Create Webhook

| Field | Value |
| --- | --- |
| Name | `Notice Desk WhatsApp Report` |
| Service | WhatsApp |
| Event | **On Report Received** (outbound delivery / read / failed) |
| Callback URL | same URL as email |

Include: `requestId`, `customerNumber`, `eventName`, `ts`, `integratedNumber`, `templateName`

`eventName` values Notice Desk uses: `delivered`, `read` (→ `READ` + `openedAt`), `failed`. `sent` is ignored.

Docs: https://msg91.com/help/webhook-new/how-to-receive-whatsapp-delivery-reports-via-webhook-new

---

## Verify after creating webhooks

```bash
curl -sS -X POST \
  "https://www.notice.beingvakil.in/api/msg91/webhook?secret=YOUR_MSG91_WEBHOOK_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"eventName":"Opened","eventId":"5","recipient":"test@example.com","requestId":"verify-open"}'
```

Expect `{"ok":true,"updated":0}` (no matching live row) or `updated` ≥ 1 when a live send matches. Wrong/missing secret → HTTP 401.

If MSG91 auto-pauses a webhook (4xx/5xx), fix the URL/secret and resume it in the panel.
