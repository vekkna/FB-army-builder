export const WORKBOOK_META = Object.freeze({
  source: "army builder.xlsx",
  authorCredit: "Army builder spreadsheet designed by Mike Wilson (2020)",
  maxUnits: 25,
  maxTraits: 4,
  maxAdditionalTraits: 3,
  maxStrategies: 3,
});

export const STAT_KEYS = Object.freeze([
  ["resolve", "Resolve", "RES"],
  ["move", "Move", "MOV"],
  ["melee", "Melee", "MEL"],
  ["shootShort", "Shoot short", "SHT-S"],
  ["shootLong", "Shoot long", "SHT-L"],
  ["defence", "Defence", "DEF"],
  ["command", "Command", "COM"],
]);

export const PROFILES = Object.freeze([
  { name: "Warlord", resolve: 2, move: 4, melee: 2, defence: 6, command: 3, points: 60 },
  { name: "Mage-lord", resolve: 2, move: 4, melee: 1, defence: 6, command: 3, points: 75 },
  { name: "Captain", resolve: 1, move: 4, melee: 1, defence: 5, command: 2, points: 25 },
  { name: "Magic-user", resolve: 1, move: 4, melee: 1, defence: 5, points: 40 },
  { name: "Rogue", resolve: 1, move: 4, melee: 1, defence: 6, points: 25 },
  { name: "Elite company", resolve: 5, move: 2, melee: 4, defence: 5, points: 36 },
  { name: "Formed company", resolve: 4, move: 2, melee: 3, defence: 5, points: 30 },
  { name: "Irregular company", resolve: 3, move: 3, melee: 3, shootShort: 1, defence: 4, points: 22 },
  { name: "Fantastic beast", resolve: 5, move: 3, melee: 4, defence: 4, points: 31 },
  { name: "Dragon", resolve: 6, move: 4, melee: 4, defence: 5, points: 42 },
  { name: "Ordnance battery", resolve: 3, move: 1, melee: 1, shootLong: 2, defence: 4, points: 21 },
  { name: "Vehicle", resolve: 5, move: 4, melee: 3, defence: 5, points: 36 },
]);

export const TRAITS = Object.freeze([
  { name: "Amphibious", points: 2 },
  { name: "Artillery", points: 15, incompatible: ["Artillery (indirect)", "Shieldwall"] },
  { name: "Artillery (indirect)", points: 20, incompatible: ["Artillery", "Shieldwall"] },
  { name: "Barrage", shootShort: 3, points: 3, incompatible: ["Barrage", "Shooting (mixed)", "Shooting (skilled)", "Thrown weapons", "Shooting"] },
  { name: "Belligerent", points: -3, incompatible: ["Character (Warlord)", "Character (Mage-lord)", "Character (Captain)", "Character (Magic-user)"] },
  { name: "Berserk", points: 3, incompatible: ["Drilled"] },
  { name: "Character (Warlord)", resolve: 2, melee: 2, command: 3, points: 65, incompatible: ["Mounted", "Passenger", "Character (Mage-lord)", "Character (Captain)", "Character (Magic-user)", "Belligerent"] },
  { name: "Character (Mage-lord)", resolve: 2, melee: 1, command: 3, points: 80, incompatible: ["Mounted", "Passenger", "Character (Warlord)", "Character (Captain)", "Character (Magic-user)", "Belligerent"] },
  { name: "Character (Captain)", resolve: 1, melee: 1, command: 2, points: 30, incompatible: ["Mounted", "Passenger", "Character (Mage-lord)", "Character (Warlord)", "Character (Magic-user)", "Belligerent"] },
  { name: "Character (Magic-user)", resolve: 1, melee: 1, points: 45, incompatible: ["Mounted", "Passenger", "Character (Mage-lord)", "Character (Captain)", "Character (Warlord)", "Belligerent"] },
  { name: "Drilled", points: 2, incompatible: ["Berserk", "Stimulants", "Impulsive"] },
  { name: "Doughty", resolve: 1, points: 4, incompatible: ["Rabble"] },
  { name: "Emerge", points: 12, incompatible: ["Character (Mage-lord)", "Character (Captain)", "Character (Magic-user)", "Character (Warlord)"] },
  { name: "Ephemeral", points: 10 },
  { name: "Expendable", points: 3, incompatible: ["Swarm"] },
  { name: "Fast", move: 1, points: 1, incompatible: ["Slow"] },
  { name: "Feast", points: 4 },
  { name: "Flying", move: 2, points: 10 },
  { name: "Foresters", points: 3 },
  { name: "Furious charge", points: 3, incompatible: ["Skirmishers"] },
  { name: "Giant", resolve: 2, melee: 2, points: 12, incompatible: ["Monstrous", "Swarm", "Long spears", "Shieldwall"] },
  { name: "Heavy melee weapons", points: 3, incompatible: ["Pikes"] },
  { name: "Heavy missile weapons", points: 1, incompatible: ["Powerful missile weapons"] },
  { name: "Highlanders", points: 3 },
  { name: "Impulsive", points: 1, incompatible: ["Drilled"] },
  { name: "Long spears", points: 2, incompatible: ["Mounted", "Giant", "Pikes"] },
  { name: "Malodorous", points: 4 },
  { name: "Militia", melee: -1, points: -2 },
  { name: "Mindless", melee: -1, incompatible: ["Reliable", "Unreliable", "Proud"] },
  { name: "Monstrous", resolve: 2, melee: 2, points: 12, incompatible: ["Giant", "Swarm"] },
  { name: "Mounted", resolve: 1, move: 2, melee: 1, points: 8, incompatible: ["Long spears", "Shieldwall", "Character (Mage-lord)", "Character (Captain)", "Character (Magic-user)", "Character (Warlord)"] },
  { name: "Mundane", points: 5, incompatible: ["Ephemeral", "Terrifying"] },
  { name: "Passenger", points: 4, incompatible: ["Character (Mage-lord)", "Character (Captain)", "Character (Magic-user)", "Character (Warlord)"] },
  { name: "Pikes", points: 3, incompatible: ["Giant", "Mounted", "Shieldwall", "Swarm", "Long spears", "Heavy melee weapons"] },
  { name: "Poison", points: 3 },
  { name: "Powerful missile weapons", points: 5, incompatible: ["Heavy missile weapons"] },
  { name: "Proud", points: 8, incompatible: ["Mindless"] },
  { name: "Rabble", resolve: -1, points: -6, incompatible: ["Doughty"] },
  { name: "Reckless", resolve: -1, move: 1, melee: 1, points: -1, incompatible: ["Doughty", "Militia"] },
  { name: "Regenerate", points: 5 },
  { name: "Reliable", points: 3, incompatible: ["Unreliable", "Mindless", "Stimulants"] },
  { name: "Shieldwall", points: 8, incompatible: ["Skirmishers", "Mounted", "Artillery", "Artillery (indirect)", "Giant"] },
  { name: "Shooting", melee: -1, shootShort: 3, shootLong: 2, points: 5, incompatible: ["Barrage", "Thrown weapons", "Shooting (mixed)", "Shooting (skilled)"] },
  { name: "Shooting (mixed)", shootShort: 2, shootLong: 1, points: 4, incompatible: ["Barrage", "Thrown weapons", "Shooting", "Shooting (skilled)"] },
  { name: "Shooting (skilled)", melee: -1, shootShort: 3, shootLong: 3, points: 7, incompatible: ["Barrage", "Thrown weapons", "Shooting", "Shooting (mixed)"] },
  { name: "Slow", move: -1, points: -1, incompatible: ["Fast"] },
  { name: "Skirmishers", points: 4, incompatible: ["Shieldwall", "Furious charge"] },
  { name: "Stimulants", points: 4, incompatible: ["Reliable", "Drilled"] },
  { name: "Swarm", resolve: -1, move: -1, melee: -1, points: -1, incompatible: ["Expendable", "Monstrous", "Giant"] },
  { name: "Terrifying", points: 25, incompatible: ["Militia", "Mundane", "Rabble"] },
  { name: "Thrown weapons", shootShort: 1, points: 1, incompatible: ["Barrage", "Shooting", "Shooting (mixed)", "Shooting (skilled)"] },
  { name: "Unreliable", points: -4, incompatible: ["Reliable", "Mindless"] },
  { name: "Warbeasts", points: 4, incompatible: ["Rabble", "Swarm"] },
]);

export const RELICS = Object.freeze([
  { name: "Billowing Banner of Encouragement", points: 8 },
  { name: "Blade of Unsurpassable Power", melee: 1, points: 5 },
  { name: "Drab Cloak of Expediency", points: 10 },
  { name: "Familiar", points: 20 },
  { name: "Haughty Helm of Reassurance", points: 12 },
  { name: "Lion's Roar Talisman", command: 1, points: 8 },
  { name: "Martyr's Ring of Retribution", points: 10 },
  { name: "Mystical Tome of Revelation", points: 12 },
  { name: "Navigator's Map of Wayfinding", points: 8 },
  { name: "Phoenix Bow of Precision", points: 15 },
  { name: "Shadowy Cloak of Stealth", points: 5 },
  { name: "Titanic Diadem of Foresight", points: 12 },
  { name: "Wicked Blade of Piercing", points: 8 },
  { name: "Winged Boots of Alacrity", move: 2, points: 5 },
]);

export const STRATEGIES = Object.freeze([
  { name: "Agent", points: 10 },
  { name: "Ambush", points: 15 },
  { name: "Cloaks and Daggers", points: 10, rogueAllowance: 1 },
  { name: "Drillmaster", points: 5 },
  { name: "Master of the Horse", points: 15 },
  { name: "Night March", points: 15 },
  { name: "Quartermaster", points: 25 },
  { name: "Scouts", points: 10 },
]);

export const HERO_PROFILES = Object.freeze(new Set(PROFILES.slice(0, 5).map(({ name }) => name)));
export const COMPANY_PROFILES = Object.freeze(new Set(PROFILES.slice(5).map(({ name }) => name)));
export const CHARACTER_TRAITS = Object.freeze(new Set(TRAITS.filter(({ name }) => name.startsWith("Character (")).map(({ name }) => name)));

export const PROFILE_BY_NAME = new Map(PROFILES.map((item) => [item.name, item]));
export const TRAIT_BY_NAME = new Map(TRAITS.map((item) => [item.name, item]));
export const RELIC_BY_NAME = new Map(RELICS.map((item) => [item.name, item]));
export const STRATEGY_BY_NAME = new Map(STRATEGIES.map((item) => [item.name, item]));
