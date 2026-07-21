# Fantastic Battles Muster

A dependency-free browser army builder derived from `army builder.xlsx`. It reads the workbook's profile, trait, relic, strategy, incompatibility, cost, stat, break-point, and composition-limit data, then presents it as a responsive roster builder.

## Run it

From this folder:

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000>. No install or build step is required.

## What it supports

- 12 company profiles, 53 searchable traits, 14 relics, and 8 strategies from the workbook
- Live stats, per-base cost, unit total, army total, base count, and break point
- Trait incompatibility filtering and character-only relics
- Warlord/Mage-lord, Captain, Magic-user, and Rogue composition checks
- Up to 25 unit entries and three strategies, matching the source sheet
- Reordering, editing, duplicating, and removing units
- One-click, print-ready unit-card PDFs (68 × 47.9 mm cards, four across on landscape A4)
- A draggable 156 × 36 cm deployment planner with scale-correct bases and low-ink printing
- Automatic local saving plus JSON save/load and a print layout

## Deliberate repairs to legacy spreadsheet edge cases

The underlying data and intended formulas are preserved, but a few clear spreadsheet implementation defects are corrected:

- all 25 rows count toward the army total and print roster (the workbook omits row 29 from its total and prints only 17 units);
- trait incompatibilities are enforced in both selection orders;
- role limits count every trait slot and the actual number of bases;
- `Character (Magic-user)` is not counted as a Rogue;
- duplicate strategies are prevented instead of being charged repeatedly;
- the stated requirement for one Warlord or Mage-lord is surfaced as an advisory;
- an empty roster shows no break point instead of the workbook's misleading `BP 1`.

The original workbook is not modified. In particular, it should not be saved through `openpyxl`, because its extended strategy validation would be stripped.

## Verify

```powershell
npm test
npm run check
```

Army builder spreadsheet designed by Mike Wilson (2020).
