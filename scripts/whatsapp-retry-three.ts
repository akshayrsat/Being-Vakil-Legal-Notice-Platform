/**
 * One WhatsApp-only retry for the three live-campaign contacts.
 * Does NOT send SMS or email. Requires MSG91_LIVE_SEND=true briefly.
 */
import { config } from "dotenv";
config({ path: ".env" });

import { deliverNotice, isLiveSendEnabled, dryRunReason, whatsappTemplatePayload } from "../src/lib/msg91";
import { noticePublicUrl, whatsappNoticeVars } from "../src/lib/notice-link";
import { toMsg91Mobile } from "../src/lib/phone";

const TARGETS = [
  { name: "Akshay Sathe", mobile: "9619871393", bank: "Northwind Housing Finance", notice: "UWAT73Y72777" },
  { name: "Akshay R Sathe", mobile: "8828402800", bank: "Northwind Housing Finance", notice: "Y59W387VEQZV" },
  { name: "Shweta Sudhir", mobile: "9326247985", bank: "Northwind Housing Finance", notice: "EC6QNFT9VVCB" },
] as const;

async function main() {
  console.log("LIVE?", isLiveSendEnabled());
  if (!isLiveSendEnabled()) {
    console.error(dryRunReason());
    process.exit(1);
  }

  const sample = whatsappTemplatePayload({
    integratedNumber: process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER || "",
    mobile: "919999999999",
    customerName: "Test",
    bankName: "TestBank",
    noticePath: "notice-TESTID123",
  });
  const components = sample.payload.template.to_and_components[0].components;
  console.log("Template", sample.payload.template.name);
  console.log("Component keys", Object.keys(components));
  console.log("button_1", JSON.stringify(components.button_1));

  for (const t of TARGETS) {
    const mobile = toMsg91Mobile(t.mobile);
    if (!mobile) throw new Error("bad mobile " + t.mobile);
    const vars = whatsappNoticeVars({
      customerName: t.name,
      bankName: t.bank,
      noticeNumber: t.notice,
    });
    const publicUrl = noticePublicUrl(t.notice);
    console.log("---", t.name, mobile, vars.notice_path, "->", publicUrl);
    if (!publicUrl.includes("notice.beingvakil.in") || publicUrl.includes("example.com")) {
      throw new Error("Refusing send: public URL is not notice.beingvakil.in: " + publicUrl);
    }
    const result = await deliverNotice({
      channel: "WHATSAPP",
      to: t.mobile,
      body: "",
      dltTemplateId: "",
      whatsapp: vars,
    });
    console.log(JSON.stringify({ ...result, notice_path: vars.notice_path, publicUrl }));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
