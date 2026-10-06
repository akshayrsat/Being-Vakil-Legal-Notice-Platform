import assert from "node:assert/strict";
import test from "node:test";
import { defaultCoRespondents, defaultObligors, type PaperCase } from "./odr-paper";
import { noticeRecipients, partiesFromColumns, partyAttendanceMap, withPartyAttendance } from "./odr-parties";

test("upload columns become respondents, and free text still works", () => {
  const fromColumns = partiesFromColumns({
    coParties: "Old Name",
    slots: [
      { name: "Anita Shah", role: "guarantor", mobile: "9876543210", email: "anita@example.com", address: "Pune" },
      { name: "", role: "Co-borrower", mobile: "", email: "", address: "" },
    ],
  });
  assert.equal(fromColumns.length, 1);
  assert.equal(fromColumns[0]?.role, "Guarantor");
  assert.equal(fromColumns[0]?.email, "anita@example.com");
  const fromText = partiesFromColumns({
    coParties: "Meera Iyer, Kiran Desai",
    slots: [{ name: "", role: "", mobile: "", email: "", address: "" }],
  });
  assert.deepEqual(fromText.map((party) => party.name), ["Meera Iyer", "Kiran Desai"]);
  assert.equal(fromText[0]?.mobile, "");
});

test("each respondent has their own attendance, and the award lists them", () => {
  const saved = withPartyAttendance("{}", "party-1", "NO_SHOW");
  assert.equal(partyAttendanceMap(saved)["party-1"], "NO_SHOW");
  assert.equal(withPartyAttendance(saved, "primary", "JOINED").includes("JOINED"), true);
  const item = {
    coParties: "Old Name",
    respondents: [{ name: "Anita Shah", role: "Guarantor", mobile: "9876543210", email: "anita@example.com", address: "Pune" }],
  } as PaperCase;
  const rows = defaultCoRespondents(item);
  assert.equal(rows[0]?.co_respondent_name, "Anita Shah");
  assert.equal(rows[0]?.co_respondent_capacity, "Guarantor");
  assert.equal(defaultObligors(item)[0]?.obligor_mobile, "9876543210");
  const fallback = defaultCoRespondents({ coParties: "Old Name" } as PaperCase);
  assert.equal(fallback[0]?.co_respondent_name, "Old Name");
  const recipients = noticeRecipients({
    mobile: "9000000001",
    email: "ravi@example.com",
    parties: [{ id: "party-1", mobile: "9876543210", email: "anita@example.com" }],
  });
  assert.deepEqual(recipients, [
    { respondentId: "", mobile: "9000000001", email: "ravi@example.com" },
    { respondentId: "party-1", mobile: "9876543210", email: "anita@example.com" },
  ]);
});
