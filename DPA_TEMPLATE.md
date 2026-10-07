# Data processing agreement (template)

**Draft for counsel review.** This is a technical outline for a contract between a bank and Being Vakil Associates. It is not legal advice, and it is not a signed agreement.

## Parties

The bank instructs Being Vakil Associates to process personal data so the firm can deliver legal notices and conduct online dispute resolution for that bank.

## Purposes

- Prepare and send legal notices.
- Conduct the ODR proceeding, including hearings, documents, and awards or settlements.
- Answer a person’s request for access, correction, erasure, a grievance, or a nominee.
- Keep access logs and an audit log.

The firm does not use the bank’s customer data for its own marketing.

## Instructions

The firm processes the data only on the bank’s instructions for those purposes, and as required to run the service the bank has switched on (templates, live send, ODR route, retention). A change of instruction is made by the bank’s authorised user or by a written request to the firm.

## Security

Access is limited to signed-in firm staff and the bank’s own users. Bank users see only their bank. Session tokens are stored as hashes. Public notice and ODR links ask for the last four digits of the account or mobile, and repeated failures lock that link. Staff lists and non-send exports mask mobile numbers and email addresses. Full contact details stay on the person or case page and in the file that is actually sent.

## Breach notice to the bank

If the firm becomes aware of a personal-data incident affecting the bank’s customers, the owner records it in the Incidents log (what happened, when it was detected, banks affected, people affected, and when the bank, the Board, and the people were told). The firm tells the bank without relying on an automatic email from the product. The product does not send that notice by itself.

## Retention

The owner sets, per bank, how long closed cases, messages, documents, public notices, and campaign rows are kept. Zero days means that category is not cleared. A legal hold stops the schedule and blocks erasure. Access logs and the audit log are kept for at least one year and then removed, unless that bank is on a legal hold. Downloaded reports are not stored on the platform after the download.

## Deletion

When a category expires, the schedule clears or deletes the personal fields and files for that bank. A person can also ask for erasure. Erasure is refused while a legal hold applies. The audit line for an erasure does not store the values that were removed.

## Audit help

The firm keeps an audit log of staff actions and an access log of public ODR opens. On a reasonable request, the firm will help the bank review those records for the bank’s own customers, subject to the one-year minimum and any legal hold.

## Sub-processors

The firm uses the sub-processors named in SUBPROCESSORS.md: MSG91, Meta WhatsApp, Google Meet and Google Calendar, India Post, and Google Cloud India. The firm will tell the bank before adding a sub-processor that handles customer data for these purposes.
