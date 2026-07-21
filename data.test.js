import test from "node:test";
import assert from "node:assert/strict";

import { RELICS, SPELLS, STRATEGIES, TRAITS } from "./data.js";

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

test("spells include effects, difficulties, and casting errata", () => {
  assert.equal(SPELLS.length, 10);
  assert.ok(SPELLS.every(({ description, difficulty }) => description.length > 0 && difficulty.length > 0));
  assert.deepEqual(
    SPELLS.filter(({ errata }) => errata).map(({ name, difficulty }) => [name, difficulty]),
    [["Blink", "5+"], ["Summon", "4+"]],
  );
  assert.match(SPELLS.find(({ name }) => name === "Blink").description, /single roll of 5\+/);
});
