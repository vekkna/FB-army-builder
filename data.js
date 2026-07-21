export const WORKBOOK_META = Object.freeze({
  source: "army builder.xlsx",
  authorCredit: "Army builder spreadsheet designed by Mike Wilson (2020)",
  maxUnits: 25,
  maxTraits: 4,
  maxAdditionalTraits: 3,
  maxSpellLevels: 3,
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

const CHARACTER_TRAIT_DESCRIPTION = "The company becomes a character-company and is modified as described above (p.8). In addition to the +5 points cost for the trait, character-companies add the usual points cost of the character to the cost of the company and increase the company's Resolve and Melee factors as though the character was attached.\n\nIncompatible traits: characters, emerge, mounted, passenger";

const TRAIT_DESCRIPTIONS = Object.freeze({
  "Amphibious": "Amphibious units are at home in the water. They treat all water features and watery rough terrain as open terrain for movement, melee and shooting purposes. If at least 50% of an amphibious unit's base/s are within a water feature, enemy units suffer a -1 modifier to their shooting factor.\n\nIncompatible traits: none",
  "Artillery": "Units with the artillery trait extend the long range of their shooting capacity to 10bw. It could be used for heavier weapons like bombards, ballistae or torsion catapults with a low trajectory, whether fixed in a static frame or mounted on a more mobile platform. Artillery may choose to target any eligible target rather than always shooting the nearest unit. If a unit of artillery becomes impetuous, they will remain stationary – defaulting to the ‘Let's not be too hasty...’ result rather than rolling for impetuous actions.\n\nIncompatible traits: artillery (indirect), shieldwall",
  "Artillery (indirect)": "Indirect artillery represents catapults, trebuchets, and mortars with the capacity to lob high trajectory missiles. Units with the artillery (indirect) trait extend the long-range of their shooting capacity to 10bw. When determining eligible targets, indirect artillery may fire over the heads of intervening units which are not treated as blocking their line of sight. Indirect artillery may choose to target any eligible target rather than always shooting the nearest unit. If a unit of indirect artillery becomes impetuous, they will remain stationary – defaulting to the ‘Let's not be too hasty...’ result rather than rolling for impetuous actions.\n\nIncompatible traits: artillery, shieldwall",
  "Barrage": "Representing all devastating short-range attacks such as dragon breath or grenades, companies with the barrage trait adjust their short-range shooting capacity to 3. Barrage does not change a unit's long-range shooting capacity.\n\nIncompatible traits: shooting, shooting (mixed), shooting (skilled), thrown weapons",
  "Belligerent": "Belligerent units need little excuse to pick a fight, even with allies. The unit gains a +1 modifier to their Melee value when they charge – in addition to the regular +1 charge modifier. However, any result of ‘Let's not be too hasty...’ or ‘Over there’ on the Impetuous Actions table will cause them to wheel or turn (whichever is most appropriate) to face the nearest friendly unit and move to attack them if they can. Once engaged in melee they will remain so, fighting each melee phase until either they or their opponent have scattered or disengaged. A belligerent unit may only attempt to disengage from melee if it has an attached character. Belligerent units always suffer a -1 modifier to rolls to disengage.\n\nIncompatible traits: character",
  "Berserk": "Berserk units get into a frenzy during melee. Each Melee attack roll of 6 ‘explodes’, allowing the company to roll an additional attack dice. If the exploding dice roll 6s, they do not generate further dice rolls.\n\nIncompatible traits: drilled",
  "Character (Warlord)": CHARACTER_TRAIT_DESCRIPTION,
  "Character (Mage-lord)": CHARACTER_TRAIT_DESCRIPTION,
  "Character (Captain)": CHARACTER_TRAIT_DESCRIPTION,
  "Character (Magic-user)": CHARACTER_TRAIT_DESCRIPTION,
  "Drilled": "Groups composed of drilled companies may make formation changes during the Action Phase at the start or end of an advance move at the cost of half their regular movement (rounding down).\n\nIncompatible traits: berserk, impulsive, stimulants",
  "Doughty": "Doughty units are particularly brave or resolute, represented by conferring a +1 Resolve bonus.\n\nIncompatible traits: rabble, reckless",
  "Emerge": "Burrowing underground, hovering amid the clouds, or hidden in plain sight, a unit with the emerge trait is not placed on the table during deployment. Characters may not be attached to emerging units until they are placed on the table. When any character is activated, they may call forth the unit onto the table. Place the unit anywhere within 2bw of the activated character and roll 1d6:\n1-2) the unit emerges in the wrong location. The unit maintains the intended facing but the opposing player may move the unit up to 1d3bw in any direction;\n3-4) the unit emerges in the wrong location. The unit maintains the intended facing but the owning player must move the unit 1d3bw in any direction;\n5+) the unit emerges exactly where it was intended and remains in place.\nThe emerging unit counts as having activated on the turn it arrives on the table, however, units that emerge into combat count as charging. Once on the table, the unit remains on the table until it scatters.\n\nIncompatible traits: character",
  "Ephemeral": "Ephemeral units are able to pass through terrain like ghosts, ignoring all terrain movement and melee modifiers. They may pass through impassable terrain, but only if they have the movement to pass all of the way through and there is space to do so. Ephemeral units may not stop their movement within impassable terrain. Ephemeral units may pass through – or be passed through by any friendly unit if there is space to do so. Their shadowy nature also makes them difficult to target, increasing their Defence to 6+ against all shooting – even from heavy or powerful missile weapons, but not magic-missiles.\n\nIncompatible traits: mundane",
  "Expendable": "Expendable units are either looked down on by the rest of the army, like thralls or subject auxiliaries, or designed to be destroyed in combat like scythed chariots. When expendable units scatter, they are ignored by others and do not cause a ripple of Resolve loss. Expendable units are not included in the starting company count used to determine if more than half the starting companies on the table have scattered triggering the army's defeat.\n\nIncompatible traits: swarm",
  "Fast": "Units with the fast trait move gain a +1 to their Movement value.\n\nIncompatible traits: slow",
  "Feast": "The feast trait can be used to represent any unit which is invigorated after destroying (and eating) its enemies, such as werewolves, vampires, ghouls, or giants. If a foe engaged in melee scatters, a unit with the feast trait immediately restores 1 lost Resolve per company in the scattering unit.\n\nIncompatible traits: none",
  "Flying": "Flying units such as manticores, giant eagles and ornithopters gain +2 to their Movement value and ignore all movement modifiers caused by terrain. They are treated as slightly elevated during the Shooting Phase, so can shoot (and be targeted) over the heads of intervening troops and terrain. Flying units may choose to evade as a charge reaction.\n\nIncompatible traits: none",
  "Foresters": "Representing units adept at moving and fighting in woodland or forests such as wood elves, giant spiders and pygmies, foresters ignore the movement and melee modifiers of rough terrain and woods.\n\nIncompatible traits: none",
  "Furious charge": "The furious charge trait could be used to represent the impact of chariots or knights with lances, or the howling charge of wildmen, beastmen or goblins. The unit gains a +2 modifier to their Melee value when they charge – in addition to the regular +1 charge modifier.\n\nIncompatible traits: skirmishers",
  "Giant": "Giants are large, lumbering and powerful; they gain +2 to their Resolve and +2 to their Melee values. ‘Companies’ of giants cannot form groups. As giants tower over other units, they can shoot (and be targeted) over the heads of intervening troops and terrain during the Shooting Phase. When a giant's Resolve is reduced to 0 it causes a ripple of Resolve loss as normal, but the giant also falls in a random direction causing two additional attacks against any unit within 1bw. Roll 1d6 to determine which direction they fall:\n1) the giant falls to their left;\n2) the giant falls to their rear;\n3) the giant falls to their right;\n4+) the giant falls to their front.\n\nIncompatible traits: long spears, monstrous, pikes, shieldwall, swarm",
  "Heavy melee weapons": "Units with heavy melee weapons could be armed with two-handed weapons such as great-swords or polearms, or powerful crushing weapons which reduce the effectiveness of enemy armour or wreak havoc among closely packed ranks of soldiers. The Defence value of all melee opponents is treated as 4+, even those with shieldwall.\n\nIncompatible traits: pikes",
  "Heavy missile weapons": "Heavy missile weapons can be used to represent weapons like crossbows or light artillery pieces which have an improved capacity to puncture enemy shields and armour but are slower to reload than bows and slings. The Defence value of all shooting targets is treated as 4+ but, after shooting, the unit with heavy missile weapons must reload their weapons during an Action Phase before they can shoot again.\n\nIncompatible traits: powerful missile weapons",
  "Highlanders": "Highlanders can move and fight freely through the high country, moors and bogs of their homeland. They suffer no movement or melee modifiers in rough terrain and each company gains +1 Melee if at least 50% of their base is within a hill terrain feature.\n\nIncompatible traits: none",
  "Impulsive": "The unit is prone to dashing forward when others hold back. When rolling for Mishaps, treat all results of Late as Enthusiastic. If the unit is not engaged in melee, after they complete their activation each turn, they must move 1d3-1bw directly forward (ignoring any terrain Movement modifiers but stopping if they contact a friendly unit – they cannot interpenetrate or impassible terrain). If the additional movement brings them into contact with an enemy to which they can conform following the standard rules, the impulsive unit counts as charging. If the impulsive unit cannot conform to an enemy, they will stop moving ½bw before contact. Impulsive units always reroll results of ‘Let's not be too hasty...’ on the Impetuous Actions table.\n\nIncompatible traits: drilled",
  "Long spears": "Units with long spears gain +2 to their Melee value when charged by an enemy to their front, or if fighting to their front against units with the flying, giant, mounted, or monstrous traits.\n\nIncompatible traits: giant, mounted, pikes",
  "Malodorous": "Malodorous units exude a foul stench or fell aura that impedes all units in their vicinity. All companies, friend and foe alike, within 1bw of a malodorous unit suffer -1 Melee; mounted units suffer -2 Melee. Other malodorous units with identical unit profiles and mindless units ignore the impact of the trait.\n\nIncompatible traits: none",
  "Militia": "Militia can be used to represent hastily raised, part-time or poorly equipped fighting units. Units with the militia trait suffer -1 to their Melee value.\n\nIncompatible traits: reckless, terrifying",
  "Mindless": "Undead hordes of skeletons or zombies, golems, elementals and automatons can all be represented by the mindless trait. Mindless units suffer -1 to their Melee value. However, as mindless units are not sentient, they do not suffer Resolve loss when friendly units scatter. If a mindless unit becomes impetuous, they default to the ‘Let's not be too hasty...’ result rather than rolling for impetuous actions. Only a Mage-lord may rally mindless units, although their Resolve may also be restored by a bless spell. The magic which animates mindless units binds them to their Warlord/Mage-lord; if the Warlord/Mage-lord is killed or scatters, all mindless units suffer an immediate -5 Resolve (rather than the usual -1) as the bond is broken.\n\nIncompatible traits: proud, reliable, unreliable",
  "Monstrous": "The monstrous trait can be used to represent units of creatures that are larger and more powerful than usual such as ogres, trolls, minotaurs or treefolk. Monstrous units gain +2 to their Resolve, and +2 to their Melee value.\n\nIncompatible traits: giant, swarm",
  "Mounted": "Units mounted on creatures which increase their speed and overall battlefield capacity – such as warhorses, wolves or boars – gain +1 to their Resolve, +2 to their Movement, and +1 to their Melee values.\n\nIncompatible traits: character, long spears, pikes, shieldwall",
  "Mundane": "There is nothing magical, or even imaginative about mundane units. All magic rolls for spells affecting the mundane unit, or any units they are in base contact with, suffer a -1 modifier. Mundane targets have a Defence of 5+ against magic-missiles; prophecy dice may not be used to affect a mundane unit's dice.\n\nIncompatible traits: ephemeral, terrifying",
  "Passenger": "Units with the passenger trait can carry a character but operate independently from them. Characters attached to the unit can rally or cast in the same Action Phase that the unengaged unit carries out an action of their own (except charging or reacting to being charged).\n\nIncompatible traits: character",
  "Pikes": "Units with two-handed pikes gain +3 to their Melee value when charged by an enemy to their front, or if fighting to their front against units with the flying, giant, mounted, or monstrous traits. Enemies engaged in melee against the flanks or rear of a unit with pikes receive an additional +1 Melee modifier.\n\nIncompatible traits: giant, heavy melee weapons, long spears, mounted, shieldwall, swarm",
  "Poison": "Whether equipped with a venomous bite or sting, coating blades and arrows with poison, or breathing out noxious fumes, units with the poison trait may reroll all 1s rolled on attack dice in both the Shooting and Melee Phases.\n\nIncompatible traits: none",
  "Powerful missile weapons": "Powerful missile weapons can be used to represent huge artillery pieces, black powder weapons and the like which combine the ability to pass through armour with a negative psychological impact on their targets. The Defence value of all shooting targets is treated as 3+ but, after shooting, the unit with powerful missile weapons must reload their weapons during an Action Phase before they can shoot again.\n\nIncompatible traits: heavy missile weapons",
  "Proud": "Holding themselves aloof from other, lesser beings, a proud unit does not suffer Resolve loss when friendly units scatter.\n\nIncompatible traits: mindless",
  "Rabble": "Gibbering and disorderly, units with the rabble trait suffer a -1 modifier to their Resolve.\n\nIncompatible traits: doughty, terrifying, warbeasts",
  "Reckless": "Reckless units prioritise speed and aggression over staying power. They gain +1 Move and Melee, but suffer -1 Resolve.\n\nIncompatible traits: doughty, militia",
  "Regenerate": "Whether possessing an innate ability to regenerate like trolls and some lizardmen, or bearing some other device like a halfling portable kitchen, units with the regenerate trait may regenerate during the Action Phase (even when engaged in combat). Roll 1d6 for each point of lost Resolve; any scores of 6 immediately restore 1 point of Resolve.\n\nIncompatible traits: none",
  "Reliable": "Reliable units can be trusted to hold the line of battle, even when they are outside the immediate control of one of their commanders. Reliable units gain +1 when rolling for Mishaps at the start of the battle, and whenever they need to roll for impetuous actions.\n\nIncompatible traits: mindless, stimulants, unreliable",
  "Shieldwall": "Trained to present their shields as a wall of metal and wood, the unit gains a +1 modifier to their Defence value against shooting and melee attacks to the unit's front edge. The Defence bonus of shieldwall does not count against magic-missiles or units with the heavy missile weapons or powerful missile weapons traits in the Shooting phase, nor against heavy melee weapons, in the Melee Phase.\n\nIncompatible traits: artillery, artillery (indirect), giant, mounted, pikes, skirmishers",
  "Shooting": "The shooting trait can be used to represent units where the majority of warriors are armed with bows, slings, crossbows, handguns or the like. The unit's Melee factor suffers a -1 modifier and the unit's Shooting capacity is fixed at 3/2.\n\nIncompatible traits: barrage, shooting (mixed), shooting (skilled), thrown weapons",
  "Shooting (mixed)": "Some, but not all, warriors in units with the shooting (mixed) trait are equipped with missile weapons. The unit's limited Shooting capacity is adjusted to 2/1, but its Melee factor is not impacted.\n\nIncompatible traits: barrage, shooting, shooting (skilled), thrown weapons",
  "Shooting (skilled)": "The shooting (skilled) trait represents units of missile-armed warriors who are proverbially skilled at shooting such as rangers, elven archers or halfling wardens. The unit's Melee factor suffers a -1 modifier and the unit's Shooting capacity is fixed at 3/3.\n\nIncompatible traits: barrage, shooting, shooting (mixed), thrown weapons",
  "Slow": "Slow units suffer a -1 modifier to their Movement value.\n\nIncompatible traits: fast",
  "Skirmishers": "Units with the skirmishers trait represent warriors who favour a dispersed formation to better pass through and around obstructions. All skirmishers may pass through – or be passed through by any friendly unit if there is space to do so. Skirmishers ignore movement and melee penalties imposed when in rough terrain and woods unless they also have the mounted trait. Enemies suffer a -1 modifier to their Shooting value when shooting at skirmishers. When unengaged skirmishers are charged from the front, they may evade as a charge reaction. When engaged in open terrain, skirmishers suffer -1 and their opponents gain +1 to their respective Melee values.\n\nIncompatible traits: furious charge, shieldwall",
  "Stimulants": "The warriors in this unit have partaken in stimulants such as alcohol, magic mushrooms, or perhaps painted themselves in hallucinogenic warpaint. After deployment but before rolling for Mishaps, roll 1d6 and apply the result throughout the battle.\n1) The unit ignores all orders and becomes impetuous throughout the battle.\n2-4) +1 Move, +1 Melee.\n5-6) The unit gains the berserk and proud traits.\n\nIncompatible traits: drilled, reliable",
  "Swarm": "Swarms represent masses of small creatures such as rats, wasps and bats which are only threatening in great numbers. Swarms suffer penalties of -1 Resolve, -1 Movement, and -1 to their Melee value. Swarms never block line of sight – they can be shot over or through by other units. Enemies suffer a -1 modifier to their Shooting value when shooting at swarms. When swarm units scatter, they are ignored by others and do not cause a ripple of Resolve loss. Swarms are not included in the starting company count used to determine if more than half the starting companies on the table have scattered triggering the army's defeat.\n\nIncompatible traits: expendable, giant, monstrous, pikes, warbeasts",
  "Terrifying": "Enemies wishing to charge a terrifying unit must roll below their own profile's starting Resolve on a 1d6 in order to engage them (i.e. a unit of irregular companies would need to roll a 1 or 2, but a doughty elite unit would need to roll 5 or less). Modify the target number by +1 for every character attached to the charging unit. If the dice roll fails, the charge must stop ½bw away from the terrifying unit. All enemies attacking the front of a terrifying unit suffer -2 to their Melee factor. Mindless and terrifying units ignore the terrifying trait of others.\n\nIncompatible traits: militia, mundane, rabble",
  "Thrown weapons": "Bearing throwing weapons such as javelins, franciscas, or shurikens, units with thrown weapons gain +1/+0 to their Shooting value.\n\nIncompatible traits: barrage, shooting, shooting (mixed), shooting (skilled)",
  "Unreliable": "Unreliable units cannot be trusted to hold their position in battle without direct supervision. They suffer a -1 modifier when rolling for Mishaps at the start of the battle, and for all impetuous actions.\n\nIncompatible traits: mindless, reliable",
  "Warbeasts": "The unit deploys with a compliment of savage warbeasts, crazed fanatics, or explosively powerful, single-use weapons which are used to break enemy lines on first impact. The unit can reroll all unsuccessful attack dice in it's first round of melee each game.\n\nIncompatible traits: rabble, swarm",
});

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
].map((trait) => Object.freeze({ ...trait, description: TRAIT_DESCRIPTIONS[trait.name] })));

export const RELICS = Object.freeze([
  {
    name: "Billowing Banner of Encouragement",
    description: "The character may reroll one failed rally die per turn.",
    points: 8,
  },
  {
    name: "Blade of Unsurpassable Power",
    description: "The character (and any unit they are attached to) receives +1 attack die in melee. If carried by a Rogue, the character still rolls three dice when duelling, but chooses any two of the results as its attack.",
    melee: 1,
    points: 5,
  },
  {
    name: "Drab Cloak of Expediency",
    description: "If the character is killed or scatters, the owning player rolls 1d6. On a 4+ they managed to disguise themselves and escape. The character must be moved 2bw away from the site of their 'death' immediately.",
    points: 10,
  },
  {
    name: "Familiar",
    description: "A Mage-lord or Magic-user with a familiar may cast a spell and carry out any other eligible action during the activation phase. The spell and action may be made in any order, however, the spell will suffer a -1 modifier against the difficulty roll/s.",
    points: 20,
  },
  {
    name: "Haughty Helm of Reassurance",
    description: "Any unit the character attaches to gains the proud trait.",
    points: 12,
  },
  {
    name: "Lion's Roar Talisman",
    description: "The character gains +1bw command radius.",
    command: 1,
    points: 8,
  },
  {
    name: "Martyr's Ring of Retribution",
    description: "If the character is killed or scatters in melee, one randomly determined enemy character within 1bw is automatically killed on a 1d6 roll of 6.",
    points: 10,
  },
  {
    name: "Mystical Tome of Revelation",
    description: "A Mage-lord or Magic-user gains one additional spell level.",
    points: 12,
  },
  {
    name: "Navigator's Map of Wayfinding",
    description: "Any unit the character is attached to may ignore all Movement penalties conferred by terrain.",
    points: 8,
  },
  {
    name: "Phoenix Bow of Precision",
    description: "The character receives a shooting attack with a 5bw range which can only be used against other characters. There must be line of sight between the character and their target, or between the character, target, and/or any point of their relative host companies if the character and/or target are attached to a unit. Normal targeting priority rules do not apply. If there are two or more characters attached to the same unit within range, they may shoot at the unit, calling out which enemy character is being targeted. Any unmodified roll of 6 causes the target character to lose 1 Resolve.",
    points: 15,
  },
  {
    name: "Shadowy Cloak of Stealth",
    description: "When unattached, the character may never be targeted during Shooting.",
    points: 5,
  },
  {
    name: "Titanic Diadem of Foresight",
    description: "If the character, or unit they are attached to, is charged, they may interrupt the opponent's turn and take an action first if they have not already activated this turn. The same character may still be activated normally later in the Action Phase to give orders but may not themselves take a second action.",
    points: 12,
  },
  {
    name: "Wicked Blade of Piercing",
    description: "If the character fights a duel, their opponent's Defence is fixed at 5+.",
    points: 8,
  },
  {
    name: "Winged Boots of Alacrity",
    description: "The character's Move value is increased to 6bw.",
    move: 2,
    points: 5,
  },
]);

export const SPELLS = Object.freeze([
  {
    name: "Bless",
    difficulty: "3+",
    description: "Successfully casting bless restores lost Resolve to a single unit within 5bw. At level 1 the Magic-user rolls 1d6, at level 2 the Magic-user rolls 2d6, and at level 3 the Magic-user rolls 3d6. For every roll of 3+, the chosen unit restores 1 Resolve. Bless may be used to restore lost Resolve to mindless units.",
  },
  {
    name: "Blink",
    difficulty: "5+",
    description: "The blink spell can be used to teleport a single friendly or enemy unit. Indicate the direction of movement for a target unit within 5bw. If the spell is cast successfully the unit is teleported 1d3+1bw in the indicated direction, maintaining its current facing. If the new location places the blinked unit partially or fully off the table edge, in impassable terrain or on top of another unit, deploy it on the table as close to the location as possible. Units blinked into combat count as charging. At level 1 the Magic-user rolls 1d6, at level 2 the Magic-user rolls 2d6, and at level 3 the Magic-user rolls 3d6. Only a single roll of 5+ is required to successfully cast the spell.",
    errata: true,
  },
  {
    name: "Confusion",
    difficulty: "3+",
    description: "Successfully casting confusion on a target unit within 5bw forces it to roll for impetuous actions (with a -1 modifier) immediately – interrupting the turn if the caster is still able to give orders to one or more of their own units. A confused unit may not activate again in the same turn unless they are the target of a successful haste spell. At level 1 the Magic-user rolls 1d6, at level 2 the Magic-user rolls 2d6, and at level 3 the Magic-user rolls 3d6. Only a single roll of 3+ is required to successfully cast the spell.",
  },
  {
    name: "Curse",
    difficulty: "4+",
    description: "Successfully casting curse reduces the fighting capacity of a single unit within 5bw. At level 1 the Magic-user rolls 1d6, at level 2 the Magic-user rolls 2d6, and at level 3 the Magic-user rolls 3d6. For every roll of 4+, each company in the target unit suffers a -1 Melee modifier this turn.",
  },
  {
    name: "Empower",
    difficulty: "3+",
    description: "The empower spell is used to increase the fighting capacity of a chosen unit within 5bw. At level 1 the Magic-user rolls 1d6, at level 2 the Magic-user rolls 2d6, and at level 3 the Magic-user rolls 3d6. The chosen unit gains +1 Melee per company for the current turn for each roll of 3+.",
  },
  {
    name: "Entangle",
    difficulty: "4+",
    description: "The entangle spell restrains one target unit within 5bw, ensuring that it cannot move in the current Action Phase. At level 1 the Magic-user rolls 1d6, at level 2 the Magic-user rolls 2d6, and at level 3 the Magic-user rolls 3d6. Only a single roll of 4+ is required to successfully cast the spell.",
  },
  {
    name: "Haste",
    difficulty: "4+",
    description: "Successfully casting haste allows one unit within 5bw (even impetuous units) to conduct an additional optional action this turn. At level 1 the Magic-user rolls 1d6, at level 2 the Magic-user rolls 2d6, and at level 3 the Magic-user rolls 3d6. Only a single roll of 4+ is required to successfully cast the spell.",
  },
  {
    name: "Magic missiles",
    difficulty: "n/a",
    description: "The magic missiles spell gives the Magic-user the capacity to shoot during the Shooting Phase. At level 1 the character gains a Shooting value of 1/1, at level 2 the Shooting value becomes 2/2, and at level 3 the Shooting value becomes 3/3. Magic missiles always treat their target's Defence as 4+, ignoring the Defence modifier of targets with the ephemeral or shieldwall traits. Mundane targets have a Defence of 5+ against magic-missiles. Magic-users who use magic missiles in the Shooting Phase may not cast a different spell in the Action Phase of the same turn.",
  },
  {
    name: "Prophesy",
    difficulty: "n/a",
    description: "Magic-users with the prophesy spell roll a number of d6 prophecy dice after rolling for Mishaps at the beginning of the game. The prophecy dice should be kept to one side. At any point later in the game the player may replace any die roll (by either player) with one of their prophecy dice. Each prophecy die may only be used once and may not be further altered. At level 1 the Magic-user rolls 1 prophecy die, at level 2 the Magic-user rolls 2 prophecy dice, and at level 3 the Magic-user rolls 3 prophecy dice. Prophecy dice may not be used if the Magic-user responsible is on a flank march, has fled the table, or has been killed.",
  },
  {
    name: "Summon",
    difficulty: "4+",
    description: "Successfully casting the summon spell adds 1 summoning point to the Magic-user's personal summoning pool. The summoning pool may accrue over multiple turns. Once enough summoning points have been generated to pay the cost of an entire unit (1-4 companies), the unit is immediately placed on the table within 2bw of the Magic-user – any unspent summoning points are lost. A summoned unit may not conduct an action in the same turn it is summoned. However, if the freshly summoned unit is placed with its front base edge in contact with an enemy, the summoned unit counts as charging. At level 1, each point in the summoning pool is worth 10 points towards the cost of the summoned unit; at level 2, each summoning point is worth 20 points; and at level 3, each summoning point is worth 30 points.",
    errata: true,
  },
]);

export const STRATEGIES = Object.freeze([
  {
    name: "Agent",
    description: "Sowing discord in the enemy ranks, an agent causes one enemy unit to start the game with -1 Resolve – apply before rolling for Mishaps.",
    points: 10,
  },
  {
    name: "Ambush",
    description: "One unit and one attached character may be deployed within any terrain feature outside of the opponent's deployment zone (must be on the reverse slope of a hill from the enemy). Ambushes are placed after all non-ambushing units, but before rolling for Mishaps. If both sides are employing ambushers, the defender places theirs first. The attacker's ambushers cannot be deployed in the same terrain feature as the defender's.",
    points: 15,
  },
  {
    name: "Cloaks and Daggers",
    description: "The army may include a second rogue.",
    points: 10,
    rogueAllowance: 1,
  },
  {
    name: "Drillmaster",
    description: "One Captain is a fanatical drillmaster. Any unit they attach to automatically receives the drilled trait.",
    points: 5,
  },
  {
    name: "Master of the Horse",
    description: "The army includes a master of the horse (vel sim.) responsible for the upkeep and training of its mounts. All mounted units receive an additional +1 attack dice when charging.",
    points: 15,
  },
  {
    name: "Night March",
    description: "The Warlord issues instructions for the entire army to advance under the shadow of darkness. The army's deployment zone depth is increased by 3bw.",
    points: 15,
  },
  {
    name: "Quartermaster",
    description: "The army includes a quartermaster responsible for maintaining supplies and regulating the baggage train. Add +1 for all units when rolling for pre-game Mishaps.",
    points: 25,
  },
  {
    name: "Scouts",
    description: "The army has wide-ranging scouts who report back on the enemy's movements. Add +2 when rolling to determine attacker/defender.",
    points: 10,
  },
]);

export const HERO_PROFILES = Object.freeze(new Set(PROFILES.slice(0, 5).map(({ name }) => name)));
export const COMPANY_PROFILES = Object.freeze(new Set(PROFILES.slice(5).map(({ name }) => name)));
export const CHARACTER_TRAITS = Object.freeze(new Set(TRAITS.filter(({ name }) => name.startsWith("Character (")).map(({ name }) => name)));

export const PROFILE_BY_NAME = new Map(PROFILES.map((item) => [item.name, item]));
export const TRAIT_BY_NAME = new Map(TRAITS.map((item) => [item.name, item]));
export const RELIC_BY_NAME = new Map(RELICS.map((item) => [item.name, item]));
export const SPELL_BY_NAME = new Map(SPELLS.map((item) => [item.name, item]));
export const STRATEGY_BY_NAME = new Map(STRATEGIES.map((item) => [item.name, item]));
