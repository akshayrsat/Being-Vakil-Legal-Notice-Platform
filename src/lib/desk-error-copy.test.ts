import assert from "node:assert/strict";
import test from "node:test";
import { pageDidNotOpenCopy } from "./desk-error-copy";

test("production crash page does not mention the local practice command", () => {
  const production = pageDidNotOpenCopy("production");
  assert.match(production, /Refresh the browser/);
  assert.doesNotMatch(production, /npm run dev/);
  assert.doesNotMatch(production, /practice database/);

  const development = pageDidNotOpenCopy("development");
  assert.match(development, /npm run dev/);
  assert.match(development, /practice database/);
});
