import assert from "node:assert/strict";
import test from "node:test";
import { arbitrationNoticeError, arbitrationNoticeGaps, showSection12Line } from "./odr-notice-gate";

test("arbitration notices wait for disclosure, acceptance, and the Section 21 notice", () => {
  const missing = arbitrationNoticeGaps("ARBITRATION", ["LOAN_AGREEMENT"]);
  assert.deepEqual(missing, ["Section 12 disclosure", "Arbitrator acceptance", "Section 21 notice"]);
  assert.match(arbitrationNoticeError(missing), /Section 12 disclosure/);
  assert.deepEqual(
    arbitrationNoticeGaps("ARBITRATION", ["SECTION_12_DISCLOSURE", "ARBITRATOR_ACCEPTANCE", "SECTION_21"]),
    [],
  );
  assert.deepEqual(arbitrationNoticeGaps("MEDIATION", []), []);
});

test("the Section 12 line is shown only when the signed disclosure is on the case", () => {
  assert.equal(showSection12Line("ARBITRATION", []), false);
  assert.equal(showSection12Line("ARBITRATION", ["SECTION_21"]), false);
  assert.equal(showSection12Line("ARBITRATION", ["SECTION_12_DISCLOSURE"]), true);
  assert.equal(showSection12Line("MEDIATION", ["SECTION_12_DISCLOSURE"]), false);
});
