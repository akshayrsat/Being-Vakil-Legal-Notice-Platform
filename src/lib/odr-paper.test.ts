import assert from "node:assert/strict";
import test from "node:test";
import { amountInWords, formatIndianAmount } from "./odr-money";
import {
  aadhaarLast4,
  agreedSettlementAmount,
  canReadOdrDocument,
  composeModel,
  exParteAwardError,
  exParteSwitch,
  missingAwardRates,
  parsePaper,
  seatFromBatch,
  seatFromSheet,
  type PaperCase,
} from "./odr-paper";

function sampleCase(overrides: Partial<PaperCase> = {}): PaperCase {
  return {
    matterType: "ARBITRATION",
    refNo: "ARB-2026-ML2KM2",
    customerName: "Ravi Shah",
    coParties: "Anita Shah",
    accountNumber: "1234567781",
    branch: "Pune",
    mobile: "9876543210",
    email: "ravi@example.com",
    address: "12 Sample Road, Pune",
    loanAmount: "100000",
    claimAmount: "25000",
    asOnDate: "1 Oct 2026",
    neutralName: "Justice A. Mehta",
    neutralQualification: "Former District Judge",
    neutralEnrolment: "MH/1234/1998",
    exParte: false,
    flaggedExParte: false,
    bankCounsel: "",
    paymentInfo: "",
    bankName: "Northwind Housing Finance",
    advocateName: "",
    opens: 0,
    hearings: [{ number: 1, scheduledAt: new Date("2026-12-15T05:30:00.000Z"), attendance: "NO_SHOW", attendanceNote: "" }],
    messages: [],
    documents: [],
    speedPosts: [],
    ...overrides,
  };
}

test("a panel award lists every arbitrator and a signature line for each", () => {
  const model = composeModel(sampleCase({
    panel: [
      { name: "Justice A. Mehta", qualification: "Former District Judge", enrolment: "MH/1234/1998" },
      { name: "B. Shah", qualification: "Advocate", enrolment: "MH/99/2010" },
    ],
  }), parsePaper("{}"), "award");
  assert.equal(model.values.tribunal_heading, "Arbitral Tribunal");
  assert.equal(model.values.arbitrator_name, "Justice A. Mehta and B. Shah");
  assert.equal(model.repeats.tribunal?.length, 2);
  assert.equal(model.repeats.tribunal?.[0]?.tribunal_role, "Arbitrator");
  assert.equal(model.repeats.tribunal?.[1]?.arbitrator_name, "B. Shah");
  const sole = composeModel(sampleCase(), parsePaper("{}"), "award");
  assert.equal(sole.values.tribunal_heading, "Sole Arbitrator");
  assert.equal(sole.repeats.tribunal?.[0]?.tribunal_role, "Sole Arbitrator");
});

test("amounts use the Indian lakh and crore system", () => {
  assert.equal(amountInWords("123456"), "One Lakh Twenty-Three Thousand Four Hundred Fifty-Six");
  assert.equal(amountInWords("1,00,00,000"), "One Crore");
  assert.equal(amountInWords("0"), "Zero");
  assert.equal(amountInWords("101"), "One Hundred One");
  assert.equal(amountInWords("21"), "Twenty-One");
  assert.equal(amountInWords("1000.50"), "One Thousand and Fifty Paise");
  assert.equal(amountInWords(""), "");
  assert.equal(formatIndianAmount("123456"), "1,23,456.00");
  assert.equal(formatIndianAmount("10000000"), "1,00,00,000.00");
});

test("ex parte stays off until the arbitrator’s order, and a full Aadhaar is not kept", () => {
  assert.equal(exParteSwitch({ exParte: false, flaggedExParte: true, hearings: [] }), false);
  assert.equal(
    exParteSwitch({
      exParte: false,
      flaggedExParte: false,
      hearings: [{ attendance: "NO_SHOW" }, { attendance: "NO_SHOW" }],
    }),
    false,
  );
  assert.equal(exParteSwitch({ exParte: true, hearings: [] }), true);
  assert.equal(exParteAwardError({ exParte: true, documents: [] }), "An ex parte award needs the final-opportunity notice and the arbitrator’s ex parte order on the case.");
  assert.equal(exParteAwardError({ exParte: true, documents: ["FINAL_OPPORTUNITY", "EX_PARTE_ORDER"] }), "");
  assert.equal(exParteAwardError({ exParte: false, documents: [] }), "");
  assert.equal(
    exParteSwitch({
      exParte: false,
      flaggedExParte: false,
      hearings: [{ attendance: "NO_SHOW" }, { attendance: "JOINED" }],
    }),
    false,
  );
  assert.equal(exParteSwitch({ exParte: false, flaggedExParte: false, hearings: [{ attendance: "PENDING" }] }), false);
  assert.equal(aadhaarLast4("123412341234"), "1234");
  assert.equal(aadhaarLast4("XXXX-XXXX-7781"), "7781");
  assert.equal(aadhaarLast4("1234"), "1234");
  const model = composeModel(sampleCase(), parsePaper("{}"), "award");
  assert.equal(model.flags.ex_parte, false);
  assert.equal(model.values.seat_city, "");
  assert.equal(model.values.pendente_lite_rate, "");
  assert.equal(model.values.post_award_rate, "");
  assert.equal(model.flags.mediation_act_applicable, false);
  assert.equal(model.values.claim_amount_words, "Twenty-Five Thousand");
  assert.equal(model.rows.co_respondents[0]?.co_respondent_name, "Anita Shah");
});

test("a generated document stays on its own bank, and a bank user cannot read a draft", () => {
  assert.equal(
    canReadOdrDocument({ documentBankId: "bank-a", viewerBankId: "bank-b", kind: "AWARD_SIGNED", canGenerate: false }),
    false,
  );
  assert.equal(
    canReadOdrDocument({ documentBankId: "bank-a", viewerBankId: "bank-a", kind: "AWARD_DRAFT", canGenerate: false }),
    false,
  );
  assert.equal(
    canReadOdrDocument({ documentBankId: "bank-a", viewerBankId: "bank-a", kind: "AWARD_DRAFT", canGenerate: true }),
    true,
  );
  assert.equal(
    canReadOdrDocument({ documentBankId: "bank-a", viewerBankId: "bank-a", kind: "SETTLEMENT_SIGNED", canGenerate: false }),
    true,
  );
  assert.equal(agreedSettlementAmount(JSON.stringify({ saved: true, fields: { settlement_amount: "15000" } })), "15000");
  const settlement = composeModel(sampleCase({ matterType: "MEDIATION" }), parsePaper("{}"), "settlement");
  assert.equal(settlement.flags.mediation_act_applicable, false);
  assert.equal(settlement.flags.arbitration_pending, false);
  assert.equal(settlement.values.seat_city, "");
});

test("the seat comes from the agreement sheet when a column is present, and interest has no default", () => {
  assert.equal(seatFromSheet(["Customer name", "Seat of arbitration"], ["Ravi Shah", "Pune"]), "Pune");
  assert.equal(seatFromSheet(["Customer name", "Branch"], ["Ravi Shah", "Pune"]), "");
  assert.equal(
    seatFromBatch(JSON.stringify(["Customer name", "Seat"]), JSON.stringify([["Ravi Shah", "Delhi"]]), 2),
    "Delhi",
  );
  const seated = composeModel(sampleCase({ agreementSeat: "Pune" }), parsePaper("{}"), "award");
  assert.equal(seated.values.seat_city, "Pune");
  assert.equal(seated.values.pendente_lite_rate, "");
  assert.equal(seated.values.post_award_rate, "");
  assert.match(missingAwardRates({ pendente_lite_rate: "", post_award_rate: "" }), /no default/i);
  assert.equal(missingAwardRates({ pendente_lite_rate: "8", post_award_rate: "9" }), "");
});
