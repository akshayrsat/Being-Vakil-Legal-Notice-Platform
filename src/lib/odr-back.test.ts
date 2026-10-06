import assert from "node:assert/strict";
import test from "node:test";
import { backToCase, odrCaseBack, odrListBack, safeStaffReturn } from "./odr-back";

test("ODR back follows the parent page, and a bank user returns to Tracking or Reports", () => {
  const list = odrListBack(false);
  assert.equal(list.kind, "link");
  if (list.kind === "link") assert.equal(list.href, "/odr");
  assert.equal(odrListBack(true).kind, "history");
  assert.deepEqual(odrCaseBack({ bankUser: false }), { kind: "link", href: "/odr/cases", label: "Back to cases" });
  assert.deepEqual(odrCaseBack({ bankUser: true, from: "/reports?view=odr&applied=1" }), {
    kind: "link",
    href: "/reports?view=odr&applied=1",
    label: "Back to reports",
  });
  assert.deepEqual(odrCaseBack({ bankUser: true, from: "/deliveries?view=odr&q=Ravi" }), {
    kind: "link",
    href: "/deliveries?view=odr&q=Ravi",
    label: "Back to tracking",
  });
  assert.equal(odrCaseBack({ bankUser: true }).kind, "history");
  assert.equal(safeStaffReturn("https://example.com/reports"), "");
  assert.equal(safeStaffReturn("//example.com/reports"), "");
  assert.equal(safeStaffReturn("/odr/cases"), "");
  const caseLink = backToCase("case-1");
  assert.equal(caseLink.kind, "link");
  if (caseLink.kind === "link") assert.equal(caseLink.href, "/odr/cases/case-1");
});
