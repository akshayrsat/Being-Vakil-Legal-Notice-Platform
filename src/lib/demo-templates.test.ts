import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { EMAIL_TEMPLATE_SLUG, WHATSAPP_TEMPLATE_NAME } from "./msg91";
import { DLT_SMS_TEMPLATE_NAME } from "./notice-link";
import { listTemplatesForBank, selectableApprovedTemplates, TEMPLATE_DRAFT } from "./templates";
import {
  DEMO_TEMPLATES,
  MSG91_EMAIL_TEMPLATE_ID,
  MSG91_SMS_FLOW_ID,
  MSG91_WHATSAPP_TEMPLATE_ID,
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
  assert.match(DEMO_TEMPLATES[0].body, /customer_name/);
  assert.match(DEMO_TEMPLATES[0].body, /bank_name/);
  assert.match(DEMO_TEMPLATES[0].body, /notice_number/);
  assert.match(DEMO_TEMPLATES[0].body, new RegExp(DLT_SMS_TEMPLATE_NAME));
  assert.match(DEMO_TEMPLATES[0].body, /not this free text/);
  assert.match(DEMO_TEMPLATES[1].body, /contact_name/);
  assert.match(DEMO_TEMPLATES[1].body, /loan_account/);
  assert.match(DEMO_TEMPLATES[1].body, /notice_link/);
  assert.match(DEMO_TEMPLATES[2].body, /notice\.beingvakil\.in/);
  assert.match(DEMO_TEMPLATES[2].body, /customer name/);
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
