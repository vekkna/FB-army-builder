import {
  PROFILE_BY_NAME,
  RELIC_BY_NAME,
  SPELL_BY_NAME,
  STRATEGY_BY_NAME,
  TRAIT_BY_NAME,
  WORKBOOK_META,
} from "./data.js";
import {
  calculateUnit,
  canChooseSpells,
  canTakeRelic,
  isHeroProfile,
  spellLevelAllowance,
  traitsConflict,
} from "./calculator.js";

export const BATTLE_PAYLOAD_VERSION = 1;
export const BATTLE_PROGRESS_VERSION = 1;
export const BATTLE_PROGRESS_STORAGE_PREFIX = "fantastic-battles-battle-progress:v1:";

const PAYLOAD_PREFIX = `fb${BATTLE_PAYLOAD_VERSION}`;
const MAX_ENCODED_PAYLOAD_CHARS = 64_000;
const MAX_DECODED_PAYLOAD_BYTES = 128_000;
const MAX_ID_LENGTH = 120;
const MAX_OPTION_NAME_LENGTH = 120;

function boundedInteger(raw, fallback, minimum, maximum) {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}

function boundedString(raw, maximum) {
  return typeof raw === "string" ? raw.slice(0, maximum) : "";
}

function uniqueUnitId(rawId, index, usedIds) {
  const requested = boundedString(rawId, MAX_ID_LENGTH).trim();
  const base = requested || `unit-${index + 1}`;
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    const ending = `-${suffix}`;
    id = `${base.slice(0, Math.max(1, MAX_ID_LENGTH - ending.length))}${ending}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function normaliseSpells(rawSpells, unit) {
  if (!canChooseSpells(unit)) return [];
  const allowance = spellLevelAllowance(unit);
  const spells = [];
  let levelsUsed = 0;
  for (const rawSpell of Array.isArray(rawSpells) ? rawSpells : []) {
    const name = boundedString(rawSpell?.name, MAX_OPTION_NAME_LENGTH);
    if (!SPELL_BY_NAME.has(name)) continue;
    const requestedLevel = boundedInteger(rawSpell?.level, 1, 1, 3);
    const level = Math.min(requestedLevel, allowance - levelsUsed);
    if (level < 1) break;
    spells.push({ name, level });
    levelsUsed += level;
  }
  return spells;
}

function normaliseUnit(raw, index, usedIds) {
  const source = raw && typeof raw === "object" ? raw : {};
  const profile = PROFILE_BY_NAME.has(source.profile) ? source.profile : "";
  const rawRacialTrait = TRAIT_BY_NAME.has(source.racialTrait) ? source.racialTrait : "";
  const rawAdditionalTraits = (Array.isArray(source.traits) ? source.traits : [])
    .filter((name) => TRAIT_BY_NAME.has(name))
    .slice(0, WORKBOOK_META.maxAdditionalTraits);
  const acceptedTraits = [];

  for (const name of [rawRacialTrait, ...rawAdditionalTraits].filter(Boolean)) {
    if (acceptedTraits.length >= WORKBOOK_META.maxTraits) break;
    if (!acceptedTraits.includes(name)
      && !acceptedTraits.some((selected) => traitsConflict(name, selected))) {
      acceptedTraits.push(name);
    }
  }

  const hero = isHeroProfile(profile);
  const racialTrait = !hero && acceptedTraits.includes(rawRacialTrait) ? rawRacialTrait : "";
  const traits = hero
    ? []
    : acceptedTraits
      .filter((name) => name !== racialTrait)
      .slice(0, WORKBOOK_META.maxAdditionalTraits);
  const unit = {
    id: uniqueUnitId(source.id, index, usedIds),
    name: boundedString(source.name, 60),
    profile,
    bases: boundedInteger(source.bases, 1, 0, 999),
    racialTrait,
    traits,
    relic: RELIC_BY_NAME.has(source.relic) ? source.relic : "",
    spells: [],
  };

  if (!canTakeRelic(unit)) unit.relic = "";
  unit.spells = normaliseSpells(source.spells, unit);
  return unit;
}

/**
 * Return the battle-view subset of an army. This is deliberately deterministic:
 * it strips unrelated properties and replaces missing or duplicate unit ids with
 * stable ids based on roster order.
 */
export function normaliseBattleArmy(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const usedIds = new Set();
  const strategies = [];

  for (const rawName of Array.isArray(source.strategies) ? source.strategies : []) {
    const name = boundedString(rawName, MAX_OPTION_NAME_LENGTH);
    if (STRATEGY_BY_NAME.has(name)
      && !strategies.includes(name)
      && strategies.length < WORKBOOK_META.maxStrategies) {
      strategies.push(name);
    }
  }

  return {
    armyName: boundedString(source.armyName, 80),
    pointsLimit: boundedInteger(source.pointsLimit, 1000, 1, 1_000_000),
    strategies,
    units: (Array.isArray(source.units) ? source.units : [])
      .slice(0, WORKBOOK_META.maxUnits)
      .map((unit, index) => normaliseUnit(unit, index, usedIds)),
  };
}

function compactArmy(raw) {
  const army = normaliseBattleArmy(raw);
  return [
    BATTLE_PAYLOAD_VERSION,
    army.armyName,
    army.pointsLimit,
    army.strategies,
    army.units.map((unit) => [
      unit.id,
      unit.name,
      unit.profile,
      unit.bases,
      unit.racialTrait,
      unit.traits,
      unit.relic,
      unit.spells.map(({ name, level }) => [name, level]),
    ]),
  ];
}

function expandCompactArmy(compact) {
  if (!Array.isArray(compact)
    || compact.length !== 5
    || compact[0] !== BATTLE_PAYLOAD_VERSION
    || !Array.isArray(compact[3])
    || !Array.isArray(compact[4])
    || !compact[4].every(Array.isArray)) {
    return null;
  }

  return normaliseBattleArmy({
    armyName: compact[1],
    pointsLimit: compact[2],
    strategies: compact[3],
    units: compact[4].map((unit) => ({
      id: unit[0],
      name: unit[1],
      profile: unit[2],
      bases: unit[3],
      racialTrait: unit[4],
      traits: unit[5],
      relic: unit[6],
      spells: Array.isArray(unit[7])
        ? unit[7].filter(Array.isArray).map((spell) => ({ name: spell[0], level: spell[1] }))
        : [],
    })),
  });
}

function bytesToBase64Url(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(encoded) {
  if (!encoded || !/^[A-Za-z0-9_-]+$/u.test(encoded)) throw new TypeError("Invalid base64url");
  const standard = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const paddingLength = (4 - (standard.length % 4)) % 4;
  const binary = atob(`${standard}${"=".repeat(paddingLength)}`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function collectStream(stream, maximumBytes) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("Battle payload is too large");
        throw new RangeError("Battle payload is too large");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function transformBytes(bytes, StreamConstructor, format, maximumBytes) {
  const input = new Blob([bytes]).stream();
  return collectStream(input.pipeThrough(new StreamConstructor(format)), maximumBytes);
}

/**
 * Encode an army as a URL-safe token. CompressionStream is used when available;
 * passing { compress: false } is useful as a compatibility or testing fallback.
 */
export async function encodeArmyPayload(raw, { compress = true } = {}) {
  const json = JSON.stringify(compactArmy(raw));
  const bytes = new TextEncoder().encode(json);
  let method = "raw";
  let encodedBytes = bytes;

  if (compress && typeof globalThis.CompressionStream === "function") {
    try {
      encodedBytes = await transformBytes(
        bytes,
        globalThis.CompressionStream,
        "gzip",
        MAX_DECODED_PAYLOAD_BYTES,
      );
      method = "gz";
    } catch {
      encodedBytes = bytes;
    }
  }

  const payload = `${PAYLOAD_PREFIX}.${method}.${bytesToBase64Url(encodedBytes)}`;
  if (payload.length > MAX_ENCODED_PAYLOAD_CHARS) {
    throw new RangeError("Battle payload is too large");
  }
  return payload;
}

function extractPayloadToken(raw) {
  let token = typeof raw === "string" ? raw.trim() : "";
  if (!token || token.length > MAX_ENCODED_PAYLOAD_CHARS * 2) return "";
  const hashIndex = token.indexOf("#");
  if (hashIndex >= 0) token = token.slice(hashIndex + 1);
  else if (token.startsWith("#")) token = token.slice(1);

  if (token.includes("=")) {
    const parameters = new URLSearchParams(token);
    token = parameters.get("army") || "";
  }
  return token.length <= MAX_ENCODED_PAYLOAD_CHARS ? token : "";
}

/**
 * Decode a token, hash, or complete URL containing `#army=...`.
 * Invalid, truncated, oversized, or unsupported payloads return null.
 */
export async function decodeArmyPayload(raw) {
  try {
    const token = extractPayloadToken(raw);
    const [prefix, method, encoded, ...extra] = token.split(".");
    if (prefix !== PAYLOAD_PREFIX
      || !["raw", "gz"].includes(method)
      || !encoded
      || extra.length) {
      return null;
    }

    let bytes = base64UrlToBytes(encoded);
    if (bytes.byteLength > MAX_DECODED_PAYLOAD_BYTES) return null;
    if (method === "gz") {
      if (typeof globalThis.DecompressionStream !== "function") return null;
      bytes = await transformBytes(
        bytes,
        globalThis.DecompressionStream,
        "gzip",
        MAX_DECODED_PAYLOAD_BYTES,
      );
    }

    const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return expandCompactArmy(JSON.parse(json));
  } catch {
    return null;
  }
}

export function unitMaxResolve(unit) {
  const result = calculateUnit(unit && typeof unit === "object" ? unit : {});
  const maximum = Number(result.resolve) * Number(result.bases);
  return Number.isFinite(maximum) ? Math.max(0, Math.round(maximum)) : 0;
}

/**
 * Resolve is an integer from zero through the unit's current maximum.
 * Invalid saved values reset to the maximum.
 */
export function clampCurrentResolve(rawCurrent, rawMaximum) {
  const maximum = boundedInteger(rawMaximum, 0, 0, Number.MAX_SAFE_INTEGER);
  const current = Number(rawCurrent);
  if (!Number.isFinite(current)) return maximum;
  return Math.min(maximum, Math.max(0, Math.round(current)));
}

function progressValue(rawProgress, unitId) {
  if (!rawProgress
    || typeof rawProgress !== "object"
    || rawProgress.version !== BATTLE_PROGRESS_VERSION
    || !rawProgress.currentResolve
    || typeof rawProgress.currentResolve !== "object"
    || !Object.hasOwn(rawProgress.currentResolve, unitId)) {
    return undefined;
  }
  return rawProgress.currentResolve[unitId];
}

function setRecordValue(record, key, value) {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

/**
 * Keep progress for surviving unit ids, clamp it to recalculated maxima, discard
 * stale ids, and initialise newly-added units at full Resolve.
 */
export function reconcileBattleProgress(rawArmy, rawProgress) {
  const army = normaliseBattleArmy(rawArmy);
  const currentResolve = {};
  for (const unit of army.units) {
    const maximum = unitMaxResolve(unit);
    const saved = progressValue(rawProgress, unit.id);
    setRecordValue(
      currentResolve,
      unit.id,
      saved === undefined ? maximum : clampCurrentResolve(saved, maximum),
    );
  }
  return {
    version: BATTLE_PROGRESS_VERSION,
    currentResolve,
  };
}

export function createBattleProgress(rawArmy) {
  return reconcileBattleProgress(rawArmy, null);
}

export function currentResolveForUnit(unit, rawProgress) {
  const maximum = unitMaxResolve(unit);
  const id = typeof unit?.id === "string" ? unit.id : "";
  const saved = progressValue(rawProgress, id);
  return saved === undefined ? maximum : clampCurrentResolve(saved, maximum);
}

function canonicalArmyJson(rawArmy) {
  return JSON.stringify(normaliseBattleArmy(rawArmy));
}

/**
 * A deterministic 64-bit FNV-1a fingerprint is sufficient for namespacing local
 * progress without requiring asynchronous Web Crypto APIs.
 */
export function armyFingerprint(rawArmy) {
  const bytes = new TextEncoder().encode(canonicalArmyJson(rawArmy));
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

export function battleProgressKey(rawArmy) {
  return `${BATTLE_PROGRESS_STORAGE_PREFIX}${armyFingerprint(rawArmy)}`;
}
