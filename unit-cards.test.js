import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUnitCardData,
  CARDS_PER_PAGE,
  createUnitCardsPdf,
  displayedCardAbilities,
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

test("card ability selection preserves the legacy relic-first layout", () => {
  const abilities = [
    { kind: "Racial", name: "Fast" },
    { kind: "Trait", name: "Character (Captain)" },
    { kind: "Relic", name: "Lion's Roar Talisman" },
  ];
  assert.deepEqual(displayedCardAbilities({ abilities }), [abilities[2]]);
  assert.deepEqual(displayedCardAbilities({ abilities: abilities.slice(0, 2) }), abilities.slice(0, 2));
});

test("spellcasters show spell names and levels on unit cards", async () => {
  const [card] = buildUnitCardData([company({
    profile: "Magic-user",
    spells: [{ name: "Blink", level: 2 }, { name: "Summon", level: 1 }],
    relic: "Mystical Tome of Revelation",
  })]);
  assert.deepEqual(displayedCardAbilities(card), [
    { kind: "Relic", name: "Mystical Tome of Revelation" },
    { kind: "Spell", name: "Blink L2" },
    { kind: "Spell", name: "Summon L1" },
  ]);
  assert.ok(displayedCardAbilities(card).every(({ name }) => !name.includes("Successfully")));
  const pdf = createUnitCardsPdf([card]);
  const pdfText = new TextDecoder("windows-1252").decode(await pdf.arrayBuffer());
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
  assert.deepEqual(UNIT_CARD_SIZE, { width: 68, height: 47.91, unit: "mm" });
  assert.equal(CARDS_PER_PAGE, 16);
  assert.ok(text.includes("(Guard \\(North\\))"));
  const crossReferenceOffset = Number(text.match(/startxref\n(\d+)/)?.[1]);
  assert.equal(text.slice(crossReferenceOffset, crossReferenceOffset + 4), "xref");
  const offsets = text.match(/\d{10} 00000 n/g)?.map((entry) => Number(entry.slice(0, 10))) ?? [];
  offsets.forEach((offset, index) => assert.ok(text.startsWith(`${index + 1} 0 obj`, offset)));

  const manyCards = Array.from({ length: CARDS_PER_PAGE + 1 }, () => cards[0]);
  const secondPdf = createUnitCardsPdf(manyCards);
  const secondText = new TextDecoder("windows-1252").decode(await secondPdf.arrayBuffer());
  assert.match(secondText, /\/Count 2\b/);
  assert.equal(unitCardPageCount(manyCards.length), 2);
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
