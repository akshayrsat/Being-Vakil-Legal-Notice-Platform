import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { EMAIL_TEMPLATE_BODY, EMAIL_TEMPLATE_SLUG, WHATSAPP_TEMPLATE_BODY, WHATSAPP_TEMPLATE_NAME } from "./msg91";
import { DLT_SMS_TEMPLATE_NAME, smsApprovedTemplateBody, smsNoticeText } from "./notice-link";
import { listTemplatesForBank, selectableApprovedTemplates, TEMPLATE_DRAFT } from "./templates";
import {
  DEMO_TEMPLATES,
  MSG91_EMAIL_TEMPLATE_ID,
  MSG91_SMS_FLOW_ID,
  MSG91_WHATSAPP_TEMPLATE_ID,
  firmTemplateMessage,
  isRetiredPracticeTemplate,
} from "./demo-templates";

test("the Approved library is the three live MSG91 templates", () => {
  assert.equal(DEMO_TEMPLATES.length, 3);
  assert.deepEqual(
    DEMO_TEMPLATES.map((template) => ({
      name: template.name,
      channels: template.channels,
      dltTemplateId: template.dltTemplateId,
      status: template.status,
    })),
    [
      {
        name: "Legal notice (SMS)",
        channels: ["SMS"],
        dltTemplateId: MSG91_SMS_FLOW_ID,
        status: "APPROVED",
      },
      {
        name: "Legal notice (email)",
        channels: ["EMAIL"],
        dltTemplateId: MSG91_EMAIL_TEMPLATE_ID,
        status: "APPROVED",
      },
      {
        name: "Legal notice (WhatsApp)",
        channels: ["WHATSAPP"],
        dltTemplateId: MSG91_WHATSAPP_TEMPLATE_ID,
        status: "APPROVED",
      },
    ],
  );
  assert.equal(MSG91_SMS_FLOW_ID, "6abf5af2e9226c340a0548e2");
  assert.equal(MSG91_EMAIL_TEMPLATE_ID, EMAIL_TEMPLATE_SLUG);
  assert.equal(MSG91_WHATSAPP_TEMPLATE_ID, WHATSAPP_TEMPLATE_NAME);
  assert.equal(DEMO_TEMPLATES[0].body, smsApprovedTemplateBody());
  assert.match(DEMO_TEMPLATES[0].body, /\{\{customer_name\}\}/);
  assert.match(DEMO_TEMPLATES[0].body, /\{\{bank_name\}\}/);
  assert.match(DEMO_TEMPLATES[0].body, /\{\{notice_number\}\}/);
  assert.doesNotMatch(DEMO_TEMPLATES[0].body, new RegExp(DLT_SMS_TEMPLATE_NAME));
  assert.doesNotMatch(DEMO_TEMPLATES[0].body, /not this free text|MSG91/);
  assert.equal(DEMO_TEMPLATES[1].body, EMAIL_TEMPLATE_BODY);
  assert.match(DEMO_TEMPLATES[1].body, /Dear \{\{contact_name\}\}/);
  assert.match(DEMO_TEMPLATES[1].body, /non-repayment of dues on your loan account \{\{loan_account\}\}/);
  assert.match(DEMO_TEMPLATES[1].body, /\{\{notice_link\}\}/);
  assert.match(DEMO_TEMPLATES[1].body, /\{\{notice_code\}\}/);
  assert.doesNotMatch(DEMO_TEMPLATES[1].body, /not this free text|MSG91/);
  assert.equal(DEMO_TEMPLATES[2].body, WHATSAPP_TEMPLATE_BODY);
  assert.match(DEMO_TEMPLATES[2].body, /Header: Legal Notice/);
  assert.match(DEMO_TEMPLATES[2].body, /Dear \{\{customer_name\}\}/);
  assert.match(
    DEMO_TEMPLATES[2].body,
    /non-repayment of dues to our client \{\{bank_name\}\}\. Please open the notice using the button below\./,
  );
  assert.match(DEMO_TEMPLATES[2].body, /- Team Being Vakil/);
  assert.match(DEMO_TEMPLATES[2].body, /Footer: Ignore in case already paid\./);
  assert.match(DEMO_TEMPLATES[2].body, /Button: View Legal Notice/);
  assert.match(DEMO_TEMPLATES[2].body, /https:\/\/www\.notice\.beingvakil\.in\/notice-\{\{notice_number\}\}/);
  assert.doesNotMatch(DEMO_TEMPLATES[2].body, /not this free text|MSG91/);
  const previousBase = process.env.NOTICE_PUBLIC_BASE_URL;
  process.env.NOTICE_PUBLIC_BASE_URL = "https://www.notice.beingvakil.in";
  try {
    const filled = smsApprovedTemplateBody()
      .replaceAll("{{customer_name}}", "Asha")
      .replaceAll("{{bank_name}}", "Northwind")
      .replaceAll("{{notice_number}}", "N1");
    assert.equal(
      filled,
      smsNoticeText({ customerName: "Asha", bankName: "Northwind", noticeNumber: "N1" }),
    );
  } finally {
    if (previousBase === undefined) delete process.env.NOTICE_PUBLIC_BASE_URL;
    else process.env.NOTICE_PUBLIC_BASE_URL = previousBase;
  }
  assert.equal(
    firmTemplateMessage({
      seedKey: "nwh-borrower-email",
      body: "Legal notice (email). Live email uses the MSG91 template legal_notice_non_payment, not this free text.",
    }),
    EMAIL_TEMPLATE_BODY,
  );
  assert.equal(
    DEMO_TEMPLATES.some((template) => isRetiredPracticeTemplate(template)),
    false,
  );
  assert.equal(
    DEMO_TEMPLATES.some((template) => /110716540000000000/.test(template.dltTemplateId)),
    false,
  );
});

test("practice Northwind templates are no longer treated as Approved", () => {
  assert.equal(
    isRetiredPracticeTemplate({
      name: "Loan recall notice (SMS)",
      dltTemplateId: "6abf5af2e9226c340a0548e2",
      status: "APPROVED",
    }),
    true,
  );
  assert.equal(
    isRetiredPracticeTemplate({
      name: "Borrower email notice",
      dltTemplateId: "legal_notice_non_payment",
      status: "APPROVED",
    }),
    true,
  );
  assert.equal(
    isRetiredPracticeTemplate({
      name: "Something else",
      dltTemplateId: "1107165400000000001",
      status: "APPROVED",
    }),
    true,
  );
  assert.equal(
    isRetiredPracticeTemplate({
      name: "Loan recall notice (SMS)",
      dltTemplateId: "1107165400000000001",
      status: "DRAFT",
    }),
    false,
  );
});

test("every bank can select the three MSG91 templates, and a draft stays local", () => {
  const rows: Array<{ id: string; bankId: string; name: string; status: string }> = DEMO_TEMPLATES.map(
    (template) => ({
      id: template.seedKey,
      bankId: "nwh",
      name: template.name,
      status: template.status,
    }),
  );
  rows.push({
    id: "mcb-draft",
    bankId: "mcb",
    name: "Meridian draft",
    status: TEMPLATE_DRAFT,
  });
  rows.push({
    id: "nwh-draft",
    bankId: "nwh",
    name: "Northwind draft",
    status: TEMPLATE_DRAFT,
  });

  const onMeridian = listTemplatesForBank(rows, "mcb");
  assert.deepEqual(
    selectableApprovedTemplates(onMeridian).map((template) => template.name),
    ["Legal notice (email)", "Legal notice (SMS)", "Legal notice (WhatsApp)"],
  );
  assert.equal(
    onMeridian.some((template) => template.name === "Northwind draft"),
    false,
  );
  assert.equal(
    onMeridian.some((template) => template.name === "Meridian draft"),
    true,
  );

  const onNorthwind = listTemplatesForBank(rows, "nwh");
  assert.equal(
    onNorthwind.some((template) => template.name === "Meridian draft"),
    false,
  );
  assert.equal(selectableApprovedTemplates(onNorthwind).length, 3);
});

test("the example env does not turn live send on and names the WhatsApp template", () => {
  const example = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
  const live = example.split("\n").find((line) => /^\s*MSG91_LIVE_SEND\s*=/.test(line));
  assert.equal(live, undefined);
  assert.match(example, /MSG91_SMS_FLOW_ID=6abf5af2e9226c340a0548e2/);
  assert.match(example, /MSG91_EMAIL_TEMPLATE_ID=legal_notice_non_payment/);
  assert.match(example, /MSG91_WHATSAPP_TEMPLATE=legal_notice_link/);
});
