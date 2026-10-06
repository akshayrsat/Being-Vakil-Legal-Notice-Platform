import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_OMBUDSMAN_MENTION, grievanceFooter, withGrievanceFooter } from "./grievance";

test("the grievance footer names the officer and the Ombudsman", () => {
  const text = grievanceFooter({
    officerName: "Meera Kulkarni",
    officerPhone: "02240001111",
    officerEmail: "grievance@northwind.example",
    ombudsman: "",
    wordingApprovedOn: "2026-10-06",
  });
  assert.match(text, /Meera Kulkarni/);
  assert.match(text, /02240001111/);
  assert.match(text, /grievance@northwind.example/);
  assert.match(text, /RBI Integrated Ombudsman/);
  assert.match(text, /cms\.rbi\.org\.in/);
  assert.match(text, /Wording approved by the bank on 6 October 2026/);
  assert.equal(text.includes(DEFAULT_OMBUDSMAN_MENTION), true);
});

test("a message keeps one grievance footer", () => {
  const info = {
    officerName: "",
    officerPhone: "",
    officerEmail: "",
    ombudsman: "Write to the RBI Integrated Ombudsman.",
    wordingApprovedOn: "",
  };
  const once = withGrievanceFooter("Your hearing is on Tuesday.", info);
  assert.match(once, /not yet recorded its grievance officer/);
  assert.match(once, /Write to the RBI Integrated Ombudsman/);
  assert.equal(withGrievanceFooter(once, info), once);
});
