import test from "node:test";
import assert from "node:assert/strict";

import {
  CHARACTER_DIAMETER_CM,
  COMPANY_BASE_CM,
  ZONE_DEPTH_CM,
  ZONE_WIDTH_CM,
  clampDeploymentDelta,
  clampDeploymentPosition,
  createDeploymentPlan,
  deploymentDataFromPieces,
  deploymentPieceId,
  deploymentPiecesInRect,
  deploymentSpellLabels,
  deploymentSpellSummary,
} from "./deployment.js";

const unit = (overrides = {}) => ({
  id: "unit-a",
  name: "Iron Guard",
  profile: "Formed company",
  bases: 1,
  racialTrait: "",
  traits: [],
  relic: "",
  ...overrides,
});

test("deployment pieces use square company bases and circular standalone characters", () => {
  const plan = createDeploymentPlan([
    unit({ bases: 3, traits: ["Character (Captain)"] }),
    unit({
      id: "captain",
      name: "Rowan",
      profile: "Mage-lord",
      bases: 2,
      relic: "Ring of Infinite Wishes",
      spells: [{ name: "Blink", level: 2 }, { name: "Summon", level: 1 }],
    }),
    unit({ id: "summon", name: "Spirit Host", bases: 0 }),
  ]);

  assert.equal(plan.pieces.length, 5);
  assert.equal(plan.pieces.filter(({ kind }) => kind === "company").length, 3);
  assert.equal(plan.pieces.filter(({ kind }) => kind === "character").length, 2);
  assert.ok(plan.pieces.slice(0, 3).every(({ sizeCm }) => sizeCm === COMPANY_BASE_CM));
  assert.ok(plan.pieces.slice(3).every(({ sizeCm }) => sizeCm === CHARACTER_DIAMETER_CM));
  assert.equal(plan.pieces[0].characterTrait, "Character (Captain)");
  assert.ok(plan.pieces.slice(3).every(({ relic }) => relic === "Ring of Infinite Wishes"));
  assert.equal(deploymentSpellSummary({
    profile: "Mage-lord",
    spells: [{ name: "Blink", level: 2 }, { name: "Summon", level: 1 }],
  }), "Spells: Blink L2, Summon L1");
  assert.deepEqual(plan.summons.map(({ label }) => label), ["Spirit Host"]);
});

test("deployment spell labels include names and levels", () => {
  assert.deepEqual(deploymentSpellLabels({
    spells: [{ name: " Bless ", level: 2 }, { name: "Blink" }, { name: "", level: 3 }],
  }), ["Bless L2", "Blink L1"]);
  assert.deepEqual(deploymentSpellLabels({ spells: "Blink" }), []);
  assert.equal(deploymentSpellSummary({ profile: "Mage-lord", spells: [] }), "Spells: none selected");
  assert.equal(deploymentSpellSummary({ profile: "Magic-user", spells: [{ name: "Blink", level: 2 }] }), "Spells: Blink L2");
  assert.equal(deploymentSpellSummary({ profile: "Captain", spells: [] }), "");
});

test("initial deployment is deterministic, grouped, and inside the 156 by 36cm zone", () => {
  const units = [
    unit({ bases: 4 }),
    unit({ id: "unit-b", name: "Wolf Riders", profile: "Irregular company", bases: 4 }),
    unit({ id: "hero", name: "The Marshal", profile: "Warlord", bases: 1 }),
  ];
  const first = createDeploymentPlan(units);
  const second = createDeploymentPlan(units);

  assert.deepEqual(first, second);
  assert.equal(first.overflow, false);
  for (const piece of first.pieces) {
    assert.ok(piece.x >= 0 && piece.x <= ZONE_WIDTH_CM - piece.sizeCm);
    assert.ok(piece.y >= 0 && piece.y <= ZONE_DEPTH_CM - piece.sizeCm);
  }

  const ironGuard = first.pieces.filter(({ unitId }) => unitId === "unit-a");
  assert.deepEqual(ironGuard.map(({ baseIndex }) => baseIndex), [0, 1, 2, 3]);
  assert.equal(new Set(ironGuard.map(({ x }) => x)).size, 2);
  assert.equal(new Set(ironGuard.map(({ y }) => y)).size, 2);
});

test("deployment positions clamp each physical marker inside the zone", () => {
  assert.deepEqual(clampDeploymentPosition({ x: -4, y: 40 }, 6), { x: 0, y: 30 });
  assert.deepEqual(clampDeploymentPosition({ x: 999, y: 999 }, 3), { x: 153, y: 33 });
  assert.deepEqual(clampDeploymentPosition({ x: 72, y: 12 }, 6), { x: 72, y: 12 });
  assert.deepEqual(clampDeploymentPosition({ x: Number.NaN, y: Infinity }, 6), { x: 0, y: 0 });
});

test("selected groups preserve their formation while clamping to deployment edges", () => {
  const pieces = [
    { x: 12, y: 8, sizeCm: 6 },
    { x: 18, y: 8, sizeCm: 6 },
  ];
  assert.deepEqual(clampDeploymentDelta(pieces, { x: 200, y: 40 }), { x: 132, y: 22 });
  assert.deepEqual(clampDeploymentDelta(pieces, { x: -20, y: -20 }), { x: -12, y: -8 });
  assert.deepEqual(clampDeploymentDelta(pieces, { x: 5, y: 3 }), { x: 5, y: 3 });
});

test("selection rectangles find every intersecting company and character marker", () => {
  const pieces = [
    { id: "a", x: 10, y: 10, sizeCm: 6 },
    { id: "b", x: 20, y: 10, sizeCm: 3 },
    { id: "c", x: 40, y: 20, sizeCm: 6 },
  ];
  assert.deepEqual(
    deploymentPiecesInRect(pieces, { x1: 24, y1: 18, x2: 8, y2: 8 }).map(({ id }) => id),
    ["a", "b"],
  );
});

test("saved coordinates survive roster edits while new and removed bases reconcile", () => {
  const original = createDeploymentPlan([unit({ bases: 2 })]);
  original.pieces[0].x = 20;
  original.pieces[0].y = 10;
  original.pieces[1].x = 40;
  original.pieces[1].y = 20;
  const saved = deploymentDataFromPieces(original.pieces);

  const grown = createDeploymentPlan([unit({ name: "Renamed Guard", bases: 4 })], saved);
  assert.deepEqual({ x: grown.pieces[0].x, y: grown.pieces[0].y }, { x: 20, y: 10 });
  assert.deepEqual({ x: grown.pieces[1].x, y: grown.pieces[1].y }, { x: 40, y: 20 });
  assert.equal(grown.pieces[0].label, "Renamed Guard");
  assert.equal(grown.pieces.length, 4);

  const shrunk = createDeploymentPlan([unit({ bases: 1 })], deploymentDataFromPieces(grown.pieces));
  assert.deepEqual(shrunk.pieces.map(({ id }) => id), [deploymentPieceId("unit-a", 0)]);
});

test("oversized rosters report overflow without placing markers outside the zone", () => {
  const plan = createDeploymentPlan([unit({ bases: 157 })]);
  assert.equal(plan.overflow, true);
  assert.equal(plan.pieces.length, 157);
  assert.ok(plan.pieces.every((piece) => Number.isFinite(piece.x) && Number.isFinite(piece.y)));
  assert.ok(plan.pieces.every((piece) => piece.x <= 150 && piece.y <= 30));
});
