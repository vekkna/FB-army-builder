import {
  CHARACTER_TRAITS,
  COMPANY_PROFILES,
  HERO_PROFILES,
  PROFILE_BY_NAME,
  RELIC_BY_NAME,
  SPELL_BY_NAME,
  STAT_KEYS,
  STRATEGY_BY_NAME,
  TRAIT_BY_NAME,
  WORKBOOK_META,
} from "./data.js";

const value = (item, key) => Number(item?.[key] ?? 0);

export function getTraitNames(unit) {
  return [unit?.racialTrait, ...(Array.isArray(unit?.traits) ? unit.traits : [])].filter(Boolean);
}

export function isHeroProfile(profileName) {
  return HERO_PROFILES.has(profileName);
}

export function armyRosterStats(stats, profileName) {
  const items = [
    { label: "RES", value: value(stats, "resolve") },
    { label: "MOV", value: value(stats, "move") },
    { label: "MEL", value: value(stats, "melee") },
    { label: "SHT", value: `${value(stats, "shootShort")}/${value(stats, "shootLong")}` },
    { label: "DEF", value: value(stats, "defence") },
  ];
  if (isHeroProfile(profileName)) items.push({ label: "COM", value: value(stats, "command") });
  return items;
}

export function printableRosterUnitKey(unit) {
  const traits = Array.isArray(unit?.traits) ? unit.traits.filter(Boolean).map(String).sort() : [];
  const spells = Array.isArray(unit?.spells)
    ? unit.spells
      .filter((spell) => spell?.name)
      .map((spell) => [String(spell.name), Number(spell.level) || 1])
      .sort(([left], [right]) => left.localeCompare(right))
    : [];
  return JSON.stringify({
    name: String(unit?.name || "").trim(),
    profile: String(unit?.profile || ""),
    bases: Number(unit?.bases) || 0,
    racialTrait: String(unit?.racialTrait || ""),
    traits,
    relic: String(unit?.relic || ""),
    spells,
  });
}

export function hasCharacter(unit) {
  return isHeroProfile(unit?.profile) || getTraitNames(unit).some((name) => CHARACTER_TRAITS.has(name));
}

export function canTakeRelic(unit) {
  return Boolean(unit?.profile && hasCharacter(unit));
}

export function canChooseSpells(unit) {
  if (!unit?.profile) return false;
  if (["Mage-lord", "Magic-user"].includes(unit.profile)) return true;
  return getTraitNames(unit).some((name) => ["Character (Mage-lord)", "Character (Magic-user)"].includes(name));
}

export function spellLevelAllowance(unit) {
  if (!canChooseSpells(unit)) return 0;
  return WORKBOOK_META.maxSpellLevels + (unit?.relic === "Mystical Tome of Revelation" ? 1 : 0);
}

export function selectedSpellLevels(unit) {
  return (Array.isArray(unit?.spells) ? unit.spells : [])
    .reduce((sum, spell) => sum + (Number.isInteger(Number(spell?.level)) ? Number(spell.level) : 0), 0);
}

export function traitsConflict(firstName, secondName) {
  if (!firstName || !secondName) return false;
  if (firstName === secondName) return true;
  const first = TRAIT_BY_NAME.get(firstName);
  const second = TRAIT_BY_NAME.get(secondName);
  return Boolean(first?.incompatible?.includes(secondName) || second?.incompatible?.includes(firstName));
}

export function getTraitAvailability(candidateName, unit, ignoredName = "") {
  const candidate = TRAIT_BY_NAME.get(candidateName);
  if (!candidate) return { available: false, reason: "Unknown trait" };
  if (!PROFILE_BY_NAME.has(unit?.profile)) return { available: false, reason: "Choose a profile first" };
  if (isHeroProfile(unit?.profile)) return { available: false, reason: "Character profiles cannot take traits" };

  const selected = getTraitNames(unit).filter((name) => name !== ignoredName);
  if (selected.includes(candidateName)) return { available: false, reason: "Already selected" };
  const conflict = selected.find((name) => traitsConflict(candidateName, name));
  if (conflict) return { available: false, reason: `Conflicts with ${conflict}` };
  return { available: true, reason: "" };
}

function combinedShooting(items, key) {
  const values = items.map((item) => value(item, key));
  const maximum = Math.max(0, ...values);
  return maximum > 1 ? maximum : values.reduce((sum, current) => sum + current, 0);
}

export function calculateUnit(unit) {
  const profile = PROFILE_BY_NAME.get(unit?.profile);
  const traitNames = getTraitNames(unit);
  const traits = traitNames.map((name) => TRAIT_BY_NAME.get(name)).filter(Boolean);
  const relic = RELIC_BY_NAME.get(unit?.relic);
  const components = [profile, ...traits, relic].filter(Boolean);
  const bases = Number.isFinite(Number(unit?.bases)) ? Math.max(0, Number(unit.bases)) : 0;

  const result = {
    resolve: components.reduce((sum, item) => sum + value(item, "resolve"), 0),
    move: components.reduce((sum, item) => sum + value(item, "move"), 0),
    melee: components.reduce((sum, item) => sum + value(item, "melee"), 0),
    shootShort: combinedShooting(components, "shootShort"),
    shootLong: combinedShooting(components, "shootLong"),
    defence: components.reduce((sum, item) => sum + value(item, "defence"), 0),
    command: components.reduce((sum, item) => sum + value(item, "command"), 0),
    pointsPerBase: components.reduce((sum, item) => sum + value(item, "points"), 0),
    bases,
  };

  // This exception is present in the workbook's long-range shooting formula.
  if (unit?.profile === "Ordnance battery" && traitNames.includes("Shooting (mixed)")) {
    result.shootLong = 1;
  }

  result.total = result.pointsPerBase * bases;
  return result;
}

export function validateUnit(unit) {
  const issues = [];
  const traitNames = getTraitNames(unit);
  const bases = Number(unit?.bases);

  if (!PROFILE_BY_NAME.has(unit?.profile)) {
    issues.push({ code: "profile", message: "Choose a company profile." });
  }
  if (!Number.isInteger(bases) || bases < 0) {
    issues.push({ code: "bases", message: "Bases must be a whole number of at least 0." });
  }
  if (unit?.racialTrait && !TRAIT_BY_NAME.has(unit.racialTrait)) {
    issues.push({ code: "racial-unknown", message: `Unknown trait: ${unit.racialTrait}` });
  }
  for (const name of unit?.traits ?? []) {
    if (!TRAIT_BY_NAME.has(name)) issues.push({ code: "trait-unknown", message: `Unknown trait: ${name}` });
  }
  if (unit?.relic && !RELIC_BY_NAME.has(unit.relic)) {
    issues.push({ code: "relic-unknown", message: `Unknown relic: ${unit.relic}` });
  }
  const spells = Array.isArray(unit?.spells) ? unit.spells : [];
  for (const spell of spells) {
    if (!SPELL_BY_NAME.has(spell?.name)) {
      issues.push({ code: "spell-unknown", message: `Unknown spell: ${spell?.name || "unnamed"}` });
    }
    if (!Number.isInteger(Number(spell?.level)) || Number(spell.level) < 1 || Number(spell.level) > 3) {
      issues.push({ code: "spell-level", message: `${spell?.name || "A spell"} must be level 1, 2, or 3.` });
    }
  }
  const spellNames = spells.map(({ name }) => name);
  if (new Set(spellNames).size !== spellNames.length) {
    issues.push({ code: "spell-duplicate", message: "The same spell cannot be selected twice." });
  }
  if (spells.length && !canChooseSpells(unit)) {
    issues.push({ code: "spell-character", message: "Only Mage-lords and Magic-users may choose spells." });
  }
  if (selectedSpellLevels(unit) > spellLevelAllowance(unit)) {
    issues.push({ code: "spell-levels-max", message: `Choose no more than ${spellLevelAllowance(unit)} total spell levels.` });
  }
  if (traitNames.length > WORKBOOK_META.maxTraits || (unit?.traits?.length ?? 0) > WORKBOOK_META.maxAdditionalTraits) {
    issues.push({ code: "traits-max", message: "A unit can take one racial trait and up to three additional traits." });
  }
  if (isHeroProfile(unit?.profile) && traitNames.length) {
    issues.push({ code: "hero-traits", message: "Warlord, Mage-lord, Captain, Magic-user, and Rogue profiles cannot take traits." });
  }
  if (new Set(traitNames).size !== traitNames.length) {
    issues.push({ code: "trait-duplicate", message: "The same trait cannot be selected twice." });
  }
  for (let first = 0; first < traitNames.length; first += 1) {
    for (let second = first + 1; second < traitNames.length; second += 1) {
      if (traitsConflict(traitNames[first], traitNames[second])) {
        issues.push({
          code: "trait-conflict",
          message: `${traitNames[first]} is incompatible with ${traitNames[second]}.`,
        });
      }
    }
  }
  if (unit?.relic && !canTakeRelic(unit)) {
    issues.push({ code: "relic-character", message: "Relics can only be carried by a character." });
  }

  return issues;
}

function unitRoleCount(unit, profileNames, traitNames) {
  const bases = Math.max(0, Number(unit?.bases) || 0);
  const profileMatches = profileNames.has(unit?.profile) ? 1 : 0;
  const traitMatches = getTraitNames(unit).filter((name) => traitNames.has(name)).length;
  return bases * (profileMatches + traitMatches);
}

export function calculateArmy(state) {
  const units = Array.isArray(state?.units) ? state.units : [];
  const strategies = Array.isArray(state?.strategies) ? state.strategies : [];
  const unitResults = units.map((unit) => ({ unit, stats: calculateUnit(unit), issues: validateUnit(unit) }));
  const unitPoints = unitResults.reduce((sum, result) => sum + result.stats.total, 0);
  const strategyPoints = strategies.reduce((sum, name) => sum + value(STRATEGY_BY_NAME.get(name), "points"), 0);
  const total = unitPoints + strategyPoints;
  const pointsPerBand = Math.max(0, Math.ceil(total / 500));

  const roles = {
    generals: units.reduce((sum, unit) => sum + unitRoleCount(
      unit,
      new Set(["Warlord", "Mage-lord"]),
      new Set(["Character (Warlord)", "Character (Mage-lord)"]),
    ), 0),
    captains: units.reduce((sum, unit) => sum + unitRoleCount(
      unit,
      new Set(["Captain"]),
      new Set(["Character (Captain)"]),
    ), 0),
    magicUsers: units.reduce((sum, unit) => sum + unitRoleCount(
      unit,
      new Set(["Magic-user"]),
      new Set(["Character (Magic-user)"]),
    ), 0),
    rogues: units.reduce((sum, unit) => sum + unitRoleCount(
      unit,
      new Set(["Rogue"]),
      new Set(),
    ), 0),
  };

  const allowances = {
    generals: 1,
    captains: pointsPerBand * 3,
    magicUsers: pointsPerBand,
    rogues: 1 + (strategies.includes("Cloaks and Daggers") ? 1 : 0),
  };

  const eligibleBreakBases = units.reduce((sum, unit) => {
    const names = getTraitNames(unit);
    if (!COMPANY_PROFILES.has(unit?.profile) || names.includes("Expendable") || names.includes("Swarm")) return sum;
    return sum + Math.max(0, Number(unit?.bases) || 0);
  }, 0);

  const issues = [];
  const limit = Math.max(0, Number(state?.pointsLimit) || 0);
  if (limit && total > limit) {
    issues.push({ code: "points", severity: "error", message: `${total - limit} points over the army limit.` });
  }
  if (units.length > WORKBOOK_META.maxUnits) {
    issues.push({ code: "units-max", severity: "error", message: `The spreadsheet supports at most ${WORKBOOK_META.maxUnits} unit entries.` });
  }
  if (strategies.length > WORKBOOK_META.maxStrategies) {
    issues.push({ code: "strategies-max", severity: "error", message: "Choose no more than three strategies." });
  }
  if (new Set(strategies).size !== strategies.length) {
    issues.push({ code: "strategy-duplicate", severity: "error", message: "A strategy can only be selected once." });
  }
  const unknownStrategies = strategies.filter((name) => !STRATEGY_BY_NAME.has(name));
  if (unknownStrategies.length) {
    issues.push({ code: "strategy-unknown", severity: "error", message: `Unknown strategy: ${unknownStrategies.join(", ")}.` });
  }
  for (const result of unitResults) {
    for (const issue of result.issues) {
      const label = result.unit.name?.trim() || result.unit.profile || "Unnamed unit";
      issues.push({ code: `unit-${issue.code}`, severity: "error", unitId: result.unit.id, message: `${label}: ${issue.message}` });
    }
  }
  if (units.length && roles.generals === 0) {
    issues.push({ code: "general-missing", severity: "warning", message: "Add one Warlord or Mage-lord (profile or Character trait)." });
  }
  for (const [role, label] of [
    ["generals", "Warlords / Mage-lords"],
    ["captains", "Captains"],
    ["magicUsers", "Magic-users"],
    ["rogues", "Rogues"],
  ]) {
    if (roles[role] > allowances[role]) {
      issues.push({
        code: `limit-${role}`,
        severity: "error",
        message: `${label}: ${roles[role]} selected, ${allowances[role]} allowed.`,
      });
    }
  }

  return {
    units: unitResults,
    unitPoints,
    strategyPoints,
    total,
    pointsPerBand,
    roles,
    allowances,
    eligibleBreakBases,
    breakPoint: eligibleBreakBases ? Math.floor(eligibleBreakBases / 2) + 1 : 0,
    issues,
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
}

export function formatSigned(number) {
  const numeric = Number(number) || 0;
  if (numeric === 0) return "0";
  return numeric > 0 ? `+${numeric}` : `−${Math.abs(numeric)}`;
}

export function describeOption(item, { includePoints = true } = {}) {
  if (!item) return "";
  const parts = STAT_KEYS
    .filter(([key]) => value(item, key) !== 0)
    .map(([key, , short]) => `${short} ${formatSigned(value(item, key))}`);
  if (includePoints) parts.push(`${formatSigned(value(item, "points"))} pts`);
  return parts.join(" · ");
}

