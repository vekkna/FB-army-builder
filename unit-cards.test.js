import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUnitCardData,
  CARDS_PER_PAGE,
  createUnitCardsPdf,
  displayedCardAbilities,
  UNIT_CARD_ABILITY_FONT_SIZE,
  UNIT_CARD_SIZE,
  unitCardPageCount,
  unitCardsFileName,
} from "./unit-cards.js";

const company = (overrides = {}) => ({
  id: "card-unit",
  name: "The Iron Guard",
  profile: "Formed company",
  bases: 3,
  racialTrait: "Fast",
  traits: ["Doughty"],
  relic: "",
  ...overrides,
});

test("builder units map directly to legacy card fields", () => {
  const [card] = buildUnitCardData([company()]);
  assert.deepEqual(card, {
    name: "The Iron Guard",
    company: "Formed company",
    resolve: 5,
    move: 3,
    melee: 3,
    short: 0,
    long: 0,
    defence: 5,
    command: 0,
    abilities: [
      { kind: "Racial", name: "Fast" },
      { kind: "Trait", name: "Doughty" },
    ],
    points: 35,
    bases: 3,
  });
  assert.notEqual(card.points, 105, "cards show the workbook's per-base Cost, not unit Total");
});

test("unnamed builder units use their profile as the card title", () => {
  const source = company({ name: "" });
  const [card] = buildUnitCardData([source]);
  assert.equal(card.name, "Formed company");
  assert.equal(source.name, "", "mapping does not mutate the roster unit");
});

test("relics are excluded from the trait boxes", () => {
  const abilities = [
    { kind: "Racial", name: "Fast" },
    { kind: "Trait", name: "Character (Captain)" },
    { kind: "Relic", name: "Lion's Roar Talisman" },
  ];
  assert.deepEqual(displayedCardAbilities({ abilities }), abilities.slice(0, 2));
  assert.deepEqual(displayedCardAbilities({ abilities: abilities.slice(0, 2) }), abilities.slice(0, 2));
  assert.deepEqual(displayedCardAbilities({ abilities: [abilities[2]] }), []);
});

test("spellcasters show spell names and levels on unit cards", async () => {
  const [card] = buildUnitCardData([company({
    profile: "Magic-user",
    spells: [{ name: "Blink", level: 2 }, { name: "Summon", level: 1 }],
    relic: "Mystical Tome of Revelation",
  })]);
  assert.deepEqual(displayedCardAbilities(card), [
    { kind: "Spell", name: "Blink L2" },
    { kind: "Spell", name: "Summon L1" },
  ]);
  assert.ok(displayedCardAbilities(card).every(({ name }) => !name.includes("Successfully")));
  const pdf = createUnitCardsPdf([card]);
  const pdfText = new TextDecoder("windows-1252").decode(await pdf.arrayBuffer());
  assert.ok(pdfText.includes("(The Iron Guard - Mystical Tome of Revelation)"));
  assert.ok(pdfText.includes("(Blink L2)"));
  assert.ok(pdfText.includes("(Summon L1)"));
});

test("unit-card PDF is valid, paginated, and contains roster text", async () => {
  const cards = buildUnitCardData([company({ name: "Guard (North)" })]);
  const pdf = createUnitCardsPdf(cards);
  assert.equal(pdf.type, "application/pdf");
  const text = new TextDecoder("windows-1252").decode(await pdf.arrayBuffer());
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Count 1\b/);
  assert.match(text, /\/ViewerPreferences << \/PrintScaling \/None >>/);
  assert.deepEqual(UNIT_CARD_SIZE, { width: 60, height: 20, unit: "mm" });
  assert.equal(CARDS_PER_PAGE, 40);
  assert.ok(text.includes("(Guard \\(North\\))"));
  assert.ok(!text.includes("(BAS)"), "base count is omitted from the card");
  assert.ok(text.includes("(Fast)") && text.includes("(Doughty)"), "traits are included in the left panel");
  assert.match(text, /\/F3 6\.16 Tf [^\n]*\(Fast\) Tj/, "short traits use the shared ability size");
  assert.match(text, /\/F3 6\.16 Tf [^\n]*\(Doughty\) Tj/, "all trait text uses the shared ability size");
  assert.match(text, /\/F1 7\.20 Tf [^\n]*\(5\) Tj/, "stat values use the enlarged size");
  assert.match(text, /56\.69 56\.69 re/, "the right-hand box is exactly 20 mm square");
  const crossReferenceOffset = Number(text.match(/startxref\n(\d+)/)?.[1]);
  assert.equal(text.slice(crossReferenceOffset, crossReferenceOffset + 4), "xref");
  const offsets = text.match(/\d{10} 00000 n/g)?.map((entry) => Number(entry.slice(0, 10))) ?? [];
  offsets.forEach((offset, index) => assert.ok(text.startsWith(`${index + 1} 0 obj`, offset)));

  const manyCards = Array.from({ length: CARDS_PER_PAGE + 1 }, () => cards[0]);
  const secondPdf = createUnitCardsPdf(manyCards);
  const secondText = new TextDecoder("windows-1252").decode(await secondPdf.arrayBuffer());
  assert.match(secondText, /\/Count 2\b/);
  assert.equal(unitCardPageCount(manyCards.length), 2);

  const adjacentPdf = createUnitCardsPdf([cards[0], cards[0]]);
  const adjacentText = new TextDecoder("windows-1252").decode(await adjacentPdf.arrayBuffer());
  const cardRects = [...adjacentText.matchAll(/1\.000 g ([0-9.]+) ([0-9.]+) 170\.08 56\.69 re B/g)];
  assert.ok(cardRects.length >= 2, "both card outlines are present");
  assert.equal(Number((Number(cardRects[1][1]) - Number(cardRects[0][1])).toFixed(2)), 170.08, "cards share a cut edge");
  assert.equal(cardRects[1][2], cardRects[0][2], "adjacent cards are aligned");
});

test("card abilities share the size required by the longest trait labels", async () => {
  assert.equal(UNIT_CARD_ABILITY_FONT_SIZE.toFixed(2), "6.16");
  const pdf = createUnitCardsPdf(buildUnitCardData([company({
    traits: ["Powerful missile weapons"],
  })]));
  const text = new TextDecoder("windows-1252").decode(await pdf.arrayBuffer());
  assert.match(text, /\/F3 6\.16 Tf [^\n]*\(Fast\) Tj/);
  assert.match(text, /\/F3 6\.16 Tf [^\n]*\(Powerful\) Tj/);
  assert.match(text, /\/F3 6\.16 Tf [^\n]*\(missile weapons\) Tj/);
});

test("maximum-length unit names stay within the title area", async () => {
  const longName = "W".repeat(60);
  const pdf = createUnitCardsPdf(buildUnitCardData([company({ name: longName })]));
  const text = new TextDecoder("windows-1252").decode(await pdf.arrayBuffer());
  const titleCommand = text.match(new RegExp(`/F1 ([0-9.]+) Tf [^\\n]*\\(${longName}\\) Tj`));
  assert.ok(titleCommand, "long card title is present in the PDF");
  assert.ok(Number(titleCommand[1]) < 5.3, "title shrinks below the legacy floor instead of overflowing");
});

test("empty PDFs are rejected and filenames follow the army name", () => {
  assert.throws(() => createUnitCardsPdf([]), /without any cards/i);
  assert.equal(unitCardsFileName("The Emerald Host"), "the-emerald-host-unit-cards.pdf");
  assert.equal(unitCardsFileName(""), "fantastic-battles-army-unit-cards.pdf");
});
