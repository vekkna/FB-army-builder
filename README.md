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
- Level-budgeted spell selection for Mage-lords and Magic-users, including the Blink and Summon errata
- Warlord/Mage-lord, Captain, Magic-user, and Rogue composition checks
- Up to 25 unit entries and three strategies, matching the source sheet
- Reordering, editing, duplicating, and removing units
- Army-specific rules-reference PDFs containing the selected spells, traits, and strategies
- One-click, print-ready unit-card PDFs (68 × 47.9 mm cards, four across on landscape A4)
- Phone-friendly Battle Cards with persistent Resolve tracking, touch rule popups, and army-wide strategies
- Touch-readable trait, spell, relic, and strategy descriptions while building an army
- Pinch-zoomable, pannable deployment planning with phone landscape support
- Self-contained phone links and locally generated QR codes; no account or army-sync server required
- Offline caching and an app manifest for adding the Battle Cards page to a phone's home screen
- A draggable 156 × 36 cm deployment planner with scale-correct bases and low-ink printing
- Automatic working-copy recovery, a named browser army library, JSON backup/restore, and a print layout

Named library armies are stored in this browser and change only when **Save changes** is selected. Clearing site data, using private browsing, or resetting the browser profile can erase browser storage, so the library includes per-army export and a restorable **Export all** JSON backup.

## Use an army on a phone or tablet

The simplest permanent home for this project is GitHub Pages because every file is static and there is no build step:

1. In the GitHub repository, open **Settings → Pages**.
2. Choose **Deploy from a branch**, then select **main** and **/(root)**.
3. Open the published site on the computer and build the army.
4. Choose **Battle**, then **Send to phone**. Scan the QR code or copy/share the link.
5. Open the link once while online. The phone can then reopen the army and its rules offline; adding the page to the home screen makes it feel like a small app.

The roster snapshot is compressed into the URL fragment, which browsers do not send to the web host. Profiles, traits, spells, relics, and strategies are stored as compact catalogue references; the phone looks up their full game data from the site. Anyone who receives the complete link can still read the roster, so treat the link like an exported army file. Current Resolve is deliberately excluded from shared links and is stored only in that device's browser.

**Back to Muster** carries the shared roster into an empty working muster on that device. If the device already has a different working army, the builder asks before replacing it; armies saved in **Save/Load** are not changed.

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
