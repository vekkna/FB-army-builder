import test from "node:test";
import assert from "node:assert/strict";

import {
  buildArmyRules,
  createRulesPdf,
  rulesPdfFileName,
} from "./rules-pdf.js";

const state = {
  armyName: "The Azure Host",
  strategies: ["Ambush", "Agent"],
  units: [
    {
      racialTrait: "Doughty",
      traits: ["Shieldwall"],
      relic: "Mystical Tome of Revelation",
      spells: [{ name: "Blink", level: 2 }, { name: "Summon", level: 1 }],
    },
    {
      racialTrait: "Doughty",
      traits: [],
      spells: [{ name: "Blink", level: 1 }],
    },
  ],
};

test("army rules collect unique selected spells, traits, and strategies", () => {
  const rules = buildArmyRules(state);
  assert.equal(rules.title, "The Azure Host");
  assert.deepEqual(rules.sections.map(({ title }) => title), ["Spells", "Traits", "Strategies"]);
  assert.deepEqual(rules.sections[0].entries.map(({ name }) => name), ["Blink", "Summon"]);
  assert.match(rules.sections[0].entries[0].meta, /Levels 1, 2 · Roll needed: 5\+ \(errata\)/);
  assert.deepEqual(rules.sections[1].entries.map(({ name }) => name), ["Doughty", "Shieldwall"]);
  assert.deepEqual(rules.sections[2].entries.map(({ name }) => name), ["Ambush", "Agent"]);
  assert.equal(rules.sections.flatMap(({ entries }) => entries).some(({ name }) => name.includes("Tome")), false);
});

test("rules reference PDF contains selected names and descriptions", async () => {
  const pdf = createRulesPdf(buildArmyRules(state));
  assert.equal(pdf.type, "application/pdf");
  const text = new TextDecoder("windows-1252").decode(await pdf.arrayBuffer());
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Count 1\b/, "a representative army fits on one compact page");
  for (const selectedName of ["Blink", "Summon", "Doughty", "Shieldwall", "Ambush", "Agent"]) {
    assert.ok(text.includes(`(${selectedName})`), `${selectedName} is printed`);
  }
  assert.ok(text.includes("roll of 5+"));
  assert.ok(text.includes("Incompatible traits: artillery"));
  assert.ok(!text.includes("(Mystical Tome of Revelation)"));

  const doughtyStart = text.indexOf("(Doughty)");
  const doughtyEnd = text.indexOf("(Shieldwall)", doughtyStart);
  const doughtyCommands = [...text.slice(doughtyStart, doughtyEnd).matchAll(
    /1 0 0 1 [0-9.]+ ([0-9.]+) Tm \(([^\n]*)\) Tj ET/g,
  )].map((match) => ({ y: Number(match[1]), value: match[2] }));
  const incompatibleIndex = doughtyCommands.findIndex(({ value }) => value.startsWith("Incompatible traits:"));
  assert.ok(incompatibleIndex > 0, "Doughty's incompatible-traits line is present");
  assert.equal(
    Number((doughtyCommands[incompatibleIndex - 1].y - doughtyCommands[incompatibleIndex].y).toFixed(1)),
    9.4,
    "no empty line precedes incompatible traits",
  );
});

test("empty references are rejected and filenames follow the army name", () => {
  assert.throws(() => createRulesPdf(buildArmyRules({})), /without selected rules/i);
  assert.equal(rulesPdfFileName("The Azure Host"), "the-azure-host-rules-reference.pdf");
  assert.equal(rulesPdfFileName(""), "fantastic-battles-army-rules-reference.pdf");
});
