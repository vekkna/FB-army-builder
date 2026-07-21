import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateArmy,
  calculateUnit,
  canChooseSpells,
  canTakeRelic,
  getTraitAvailability,
  traitsConflict,
  validateUnit,
  spellLevelAllowance,
} from "./calculator.js";

const unit = (overrides = {}) => ({
  id: "test-unit",
  name: "",
  profile: "Formed company",
  bases: 1,
  racialTrait: "",
  traits: [],
  relic: "",
  ...overrides,
});

test("base profile values match the workbook", () => {
  assert.deepEqual(calculateUnit(unit()), {
    resolve: 4,
    move: 2,
    melee: 3,
    shootShort: 0,
    shootLong: 0,
    defence: 5,
    command: 0,
    pointsPerBase: 30,
    bases: 1,
    total: 30,
  });
});

test("trait and relic modifiers are added before multiplying by bases", () => {
  const result = calculateUnit(unit({
    profile: "Elite company",
    bases: 3,
    racialTrait: "Doughty",
    traits: ["Character (Captain)"],
    relic: "Blade of Unsurpassable Power",
  }));
  assert.equal(result.resolve, 7);
  assert.equal(result.melee, 6);
  assert.equal(result.command, 2);
  assert.equal(result.pointsPerBase, 75);
  assert.equal(result.total, 225);
});

test("shooting uses the workbook maximum-or-sum rule", () => {
  assert.equal(calculateUnit(unit({ profile: "Irregular company", racialTrait: "Thrown weapons" })).shootShort, 2);
  assert.equal(calculateUnit(unit({ profile: "Irregular company", racialTrait: "Shooting" })).shootShort, 3);
});

test("ordnance battery with Shooting (mixed) has the workbook special long value", () => {
  const result = calculateUnit(unit({ profile: "Ordnance battery", racialTrait: "Shooting (mixed)" }));
  assert.equal(result.shootShort, 2);
  assert.equal(result.shootLong, 1);
});

test("incompatibilities are made symmetric for safer selection", () => {
  assert.equal(traitsConflict("Militia", "Terrifying"), true);
  const availability = getTraitAvailability("Terrifying", unit({ racialTrait: "Militia" }));
  assert.equal(availability.available, false);
  assert.match(availability.reason, /Militia/);
});

test("heroes cannot take traits and relics require a character", () => {
  assert.equal(validateUnit(unit({ profile: "Warlord", racialTrait: "Fast" }))[0].code, "hero-traits");
  assert.equal(canTakeRelic(unit()), false);
  assert.equal(canTakeRelic(unit({ traits: ["Character (Captain)"] })), true);
  assert.equal(canTakeRelic(unit({ profile: "Rogue" })), true);
});

test("army totals include strategies and every unit", () => {
  const state = {
    pointsLimit: 500,
    strategies: ["Agent"],
    units: Array.from({ length: 25 }, (_, index) => unit({ id: String(index), bases: 1 })),
  };
  const army = calculateArmy(state);
  assert.equal(army.unitPoints, 750);
  assert.equal(army.strategyPoints, 10);
  assert.equal(army.total, 760);
});

test("break point excludes heroes, Expendable, and Swarm", () => {
  const state = {
    pointsLimit: 1000,
    strategies: [],
    units: [
      unit({ id: "a", bases: 4 }),
      unit({ id: "b", profile: "Elite company", bases: 2, racialTrait: "Expendable" }),
      unit({ id: "c", profile: "Warlord", bases: 1 }),
    ],
  };
  const army = calculateArmy(state);
  assert.equal(army.eligibleBreakBases, 4);
  assert.equal(army.breakPoint, 3);
});

test("composition limits count character upgrades by bases", () => {
  const state = {
    pointsLimit: 1000,
    strategies: [],
    units: [unit({ bases: 2, traits: ["Character (Captain)"] })],
  };
  const army = calculateArmy(state);
  assert.equal(army.roles.captains, 2);
  assert.equal(army.allowances.captains, 3);
  assert.equal(army.roles.rogues, 0);
  assert.ok(army.warnings.some(({ code }) => code === "general-missing"));
});

test("Cloaks and Daggers raises the Rogue allowance", () => {
  const state = {
    pointsLimit: 500,
    strategies: ["Cloaks and Daggers"],
    units: [unit({ id: "r1", profile: "Rogue" }), unit({ id: "r2", profile: "Rogue" })],
  };
  const army = calculateArmy(state);
  assert.equal(army.roles.rogues, 2);
  assert.equal(army.allowances.rogues, 2);
  assert.equal(army.errors.some(({ code }) => code === "limit-rogues"), false);
});

test("zero-base summoned units retain their stats and cost no points", () => {
  const summoned = unit({ bases: 0, racialTrait: "Doughty" });
  const result = calculateUnit(summoned);

  assert.equal(result.resolve, 5);
  assert.equal(result.defence, 5);
  assert.equal(result.pointsPerBase, 34);
  assert.equal(result.bases, 0);
  assert.equal(result.total, 0);
  assert.deepEqual(validateUnit(summoned), []);

  const army = calculateArmy({ pointsLimit: 500, strategies: [], units: [summoned] });
  assert.equal(army.unitPoints, 0);
  assert.equal(army.total, 0);
});

test("Mage-lords and Magic-users receive three spell levels", () => {
  const mage = unit({
    profile: "Mage-lord",
    spells: [{ name: "Bless", level: 2 }, { name: "Blink", level: 1 }],
  });
  assert.equal(canChooseSpells(mage), true);
  assert.equal(spellLevelAllowance(mage), 3);
  assert.equal(validateUnit(mage).some(({ code }) => code.startsWith("spell-")), false);

  mage.spells.push({ name: "Summon", level: 1 });
  assert.equal(validateUnit(mage).some(({ code }) => code === "spell-levels-max"), true);
  mage.relic = "Mystical Tome of Revelation";
  assert.equal(spellLevelAllowance(mage), 4);
  assert.equal(validateUnit(mage).some(({ code }) => code === "spell-levels-max"), false);
});

test("non-spellcasters cannot retain spell selections", () => {
  const captain = unit({ profile: "Captain", spells: [{ name: "Bless", level: 1 }] });
  assert.equal(canChooseSpells(captain), false);
  assert.equal(validateUnit(captain).some(({ code }) => code === "spell-character"), true);
});

