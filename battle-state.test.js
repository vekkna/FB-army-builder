import test from "node:test";
import assert from "node:assert/strict";

import {
  BATTLE_PROGRESS_STORAGE_PREFIX,
  BATTLE_PROGRESS_VERSION,
  armyFingerprint,
  battleProgressKey,
  clampCurrentResolve,
  createBattleProgress,
  currentResolveForUnit,
  decodeArmyPayload,
  encodeArmyPayload,
  normaliseBattleArmy,
  reconcileBattleProgress,
  unitMaxResolve,
} from "./battle-state.js";
import { QR_BYTE_CAPACITY } from "./qr-code.js";

const unit = (overrides = {}) => ({
  id: "unit-a",
  name: "Iron Guard",
  profile: "Formed company",
  bases: 3,
  racialTrait: "Fast",
  traits: ["Doughty"],
  relic: "",
  spells: [],
  ...overrides,
});

const army = (overrides = {}) => ({
  version: 99,
  armyName: "Northern Host",
  pointsLimit: 1_000,
  strategies: ["Ambush"],
  units: [unit()],
  unrelated: "discard me",
  ...overrides,
});

test("battle armies retain only valid, bounded roster data and stable unique ids", () => {
  const normalised = normaliseBattleArmy(army({
    pointsLimit: 999_999_999,
    strategies: ["Ambush", "Unknown", "Ambush", "Scouts", "Night March", "Agent"],
    units: [
      unit({
        id: "shared",
        traits: ["Doughty", "Unknown", "Doughty"],
        relic: "Blade of Unsurpassable Power",
        spells: [{ name: "Blink", level: 2 }],
        secret: true,
      }),
      unit({
        id: "shared",
        profile: "Magic-user",
        racialTrait: "Fast",
        traits: ["Doughty"],
        relic: "Mystical Tome of Revelation",
        spells: [
          { name: "Blink", level: 3 },
          { name: "Bless", level: 3 },
          { name: "Unknown", level: 1 },
        ],
      }),
      unit({ id: "", profile: "Unknown profile", bases: -20 }),
    ],
  }));

  assert.deepEqual(normalised.strategies, ["Ambush", "Scouts", "Night March"]);
  assert.equal(normalised.pointsLimit, 1_000_000);
  assert.deepEqual(normalised.units.map(({ id }) => id), ["shared", "shared-2", "unit-3"]);
  assert.deepEqual(normalised.units[0], {
    id: "shared",
    name: "Iron Guard",
    profile: "Formed company",
    bases: 3,
    racialTrait: "Fast",
    traits: ["Doughty"],
    relic: "",
    spells: [],
  });
  assert.equal(normalised.units[1].racialTrait, "");
  assert.deepEqual(normalised.units[1].traits, []);
  assert.equal(normalised.units[1].relic, "Mystical Tome of Revelation");
  assert.deepEqual(normalised.units[1].spells, [
    { name: "Blink", level: 3 },
    { name: "Bless", level: 1 },
  ]);
  assert.equal(normalised.units[2].profile, "");
  assert.equal(normalised.units[2].bases, 0);
  assert.deepEqual(Object.keys(normalised), ["armyName", "pointsLimit", "strategies", "units"]);
});

test("raw URL payloads round-trip the normalised army", async () => {
  const expected = normaliseBattleArmy(army());
  const payload = await encodeArmyPayload(army(), { compress: false });

  assert.match(payload, /^fb1\.raw\.[A-Za-z0-9_-]+$/u);
  assert.deepEqual(await decodeArmyPayload(payload), expected);
  assert.deepEqual(
    await decodeArmyPayload(`https://example.test/battle.html#army=${payload}`),
    expected,
  );
});

test("gzip URL payloads round-trip when compression streams are available", {
  skip: typeof globalThis.CompressionStream !== "function"
    || typeof globalThis.DecompressionStream !== "function",
}, async () => {
  const payload = await encodeArmyPayload(army());
  assert.match(payload, /^fb1\.gz\.[A-Za-z0-9_-]+$/u);
  assert.deepEqual(await decodeArmyPayload(`#army=${payload}`), normaliseBattleArmy(army()));
});

test("a fully populated 25-unit roster remains small enough for a local QR link", {
  skip: typeof globalThis.CompressionStream !== "function",
}, async () => {
  const noise = (seed, length) => {
    let value = seed >>> 0;
    let result = "";
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    while (result.length < length) {
      value = (value * 1664525 + 1013904223) >>> 0;
      result += alphabet[value % alphabet.length];
    }
    return result;
  };
  const maximumRoster = army({
    armyName: noise(91, 80),
    strategies: ["Ambush", "Scouts", "Night March"],
    units: Array.from({ length: 25 }, (_, index) => unit({
      id: `${noise(index + 1, 8)}-${noise(index + 31, 4)}-${noise(index + 61, 4)}-${noise(index + 91, 4)}-${noise(index + 121, 12)}`,
      name: noise(index + 501, 60),
      bases: 9,
      traits: ["Doughty", "Shieldwall", "Feast"],
    })),
  });
  const payload = await encodeArmyPayload(maximumRoster);
  const completeUrl = `https://vekkna.github.io/FB-army-builder/battle.html#army=${payload}`;

  assert.ok(
    new TextEncoder().encode(completeUrl).length <= QR_BYTE_CAPACITY.L,
    `Expected the maximum roster link to fit a Version 40-L QR (${completeUrl.length} characters)`,
  );
  assert.deepEqual(await decodeArmyPayload(payload), normaliseBattleArmy(maximumRoster));
});

test("payload decoding rejects malformed, truncated, future, and oversized data", async () => {
  const futureJson = JSON.stringify([2, "Future", 1000, [], []]);
  const futureBody = btoa(futureJson).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  const malformed = [
    "",
    "not-a-payload",
    "fb2.raw.Zm9v",
    "fb1.zip.Zm9v",
    "fb1.raw.!!!!",
    "fb1.raw.WzEs",
    `fb1.raw.${futureBody}`,
    `fb1.raw.${"a".repeat(64_001)}`,
  ];

  for (const payload of malformed) {
    assert.equal(await decodeArmyPayload(payload), null, payload.slice(0, 80));
  }
});

test("Resolve helpers calculate maxima and clamp saved current values", () => {
  const company = unit();
  assert.equal(unitMaxResolve(company), 15);
  assert.equal(clampCurrentResolve(99, 15), 15);
  assert.equal(clampCurrentResolve(-2, 15), 0);
  assert.equal(clampCurrentResolve(4.6, 15), 5);
  assert.equal(clampCurrentResolve("7", 15), 7);
  assert.equal(clampCurrentResolve("invalid", 15), 15);
  assert.equal(unitMaxResolve(unit({
    profile: "",
    bases: 999,
    racialTrait: "",
    traits: [],
  })), 0);
});

test("battle progress initialises, clamps, and reconciles by unit id", () => {
  const roster = army({
    units: [
      unit(),
      unit({ id: "unit-b", name: "Riders", bases: 2, racialTrait: "", traits: [] }),
      unit({ id: "unit-c", name: "Mage", profile: "Magic-user", bases: 1, racialTrait: "", traits: [] }),
    ],
  });
  const initial = createBattleProgress(roster);

  assert.equal(initial.version, BATTLE_PROGRESS_VERSION);
  assert.deepEqual(initial.currentResolve, {
    "unit-a": 15,
    "unit-b": 8,
    "unit-c": 1,
  });

  const reconciled = reconcileBattleProgress(roster, {
    version: BATTLE_PROGRESS_VERSION,
    currentResolve: {
      "unit-a": 999,
      "unit-b": -4,
      stale: 2,
    },
  });
  assert.deepEqual(reconciled.currentResolve, {
    "unit-a": 15,
    "unit-b": 0,
    "unit-c": 1,
  });
  assert.equal(currentResolveForUnit(roster.units[0], reconciled), 15);
  assert.equal(currentResolveForUnit(roster.units[1], reconciled), 0);

  const changedRoster = army({ units: [unit({ bases: 2 })] });
  assert.deepEqual(reconcileBattleProgress(changedRoster, {
    version: BATTLE_PROGRESS_VERSION,
    currentResolve: { "unit-a": 12 },
  }).currentResolve, { "unit-a": 10 });
});

test("army fingerprints and local progress keys are stable for normalised content", () => {
  const source = army();
  const withNoise = {
    ...structuredClone(source),
    extra: { ignored: true },
    strategies: ["Ambush", "Unknown"],
  };
  const fingerprint = armyFingerprint(source);

  assert.match(fingerprint, /^[0-9a-f]{16}$/u);
  assert.equal(armyFingerprint(withNoise), fingerprint);
  assert.notEqual(armyFingerprint(army({ units: [unit({ bases: 4 })] })), fingerprint);
  assert.equal(battleProgressKey(source), `${BATTLE_PROGRESS_STORAGE_PREFIX}${fingerprint}`);
});
