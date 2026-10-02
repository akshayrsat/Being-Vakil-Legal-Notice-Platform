// Practice notice templates. They are filed under the bank marked forViewer (Northwind).
// Starting the site again puts this wording back. Templates you add yourself are left alone.

import { TEMPLATE_APPROVED } from "./templates";

export type DemoTemplate = {
  seedKey: string;
  name: string;
  dltTemplateId: string;
  channels: string[];
  status: typeof TEMPLATE_APPROVED;
  body: string;
};

export const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    seedKey: "nwh-loan-recall-sms",
    name: "Loan recall notice (SMS)",
    dltTemplateId: "1107165400000000001",
    channels: ["SMS"],
    status: TEMPLATE_APPROVED,
    body: "Dear {{customer_name}}, {{bank_name}} asks you to pay Rs {{outstanding_amount}} on loan {{loan_number}}. This is a practice message, not a real notice.",
  },
  {
    seedKey: "nwh-borrower-email",
    name: "Borrower email notice",
    dltTemplateId: "1107165400000000002",
    channels: ["EMAIL", "WHATSAPP"],
    status: TEMPLATE_APPROVED,
    body: "To {{customer_name}} ({{email}}). This is a practice notice for {{bank_name}}. Loan {{loan_number}} has Rs {{outstanding_amount}} outstanding. Address on file: {{address}}. Mobile: {{mobile}}.",
  },
];
