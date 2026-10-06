import assert from "node:assert/strict";
import test from "node:test";
import { maskAccountLast4 } from "./account-mask";
import { emailNoticeVars } from "./notice-link";

test("an email shows only the last 4 digits of the account", () => {
  assert.equal(maskAccountLast4("1234567781"), "XXXX7781");
  assert.equal(maskAccountLast4("ACCT 7781"), "XXXX7781");
  assert.equal(maskAccountLast4("12"), "");
  const vars = emailNoticeVars({
    customerName: "Ravi Shah",
    loanAccount: "1234567781",
    noticeNumber: "N1",
  });
  assert.equal(vars.loan_account, "XXXX7781");
  assert.equal(vars.loan_account.includes("123456"), false);
});
