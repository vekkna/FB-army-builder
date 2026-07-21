import test from "node:test";
import assert from "node:assert/strict";

import { RELICS, STRATEGIES, TRAITS } from "./data.js";

test("every relic includes tooltip rules text", () => {
  assert.equal(RELICS.length, 14);
  assert.ok(RELICS.every(({ description }) => typeof description === "string" && description.length > 0));
  assert.match(
    RELICS.find(({ name }) => name === "Phoenix Bow of Precision").description,
    /Any unmodified roll of 6 causes the target character to lose 1 Resolve\.$/,
  );
});

test("every strategy includes tooltip rules text", () => {
  assert.equal(STRATEGIES.length, 8);
  assert.ok(STRATEGIES.every(({ description }) => typeof description === "string" && description.length > 0));
  assert.match(
    STRATEGIES.find(({ name }) => name === "Ambush").description,
    /cannot be deployed in the same terrain feature as the defender's\.$/,
  );
});

test("every trait includes tooltip rules text", () => {
  assert.equal(TRAITS.length, 53);
  assert.ok(TRAITS.every(({ description }) => typeof description === "string" && description.length > 0));
  assert.match(
    TRAITS.find(({ name }) => name === "Terrifying").description,
    /Incompatible traits: militia, mundane, rabble$/,
  );
});
