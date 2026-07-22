import {
  SPELL_BY_NAME,
  STRATEGY_BY_NAME,
  TRAIT_BY_NAME,
} from "./data.js";

const PT_PER_MM = 72 / 25.4;
const A4 = [210 * PT_PER_MM, 297 * PT_PER_MM];
const MARGIN = 32;
const CONTENT_WIDTH = A4[0] - MARGIN * 2;
const COLUMN_GAP = 16;
const COLUMN_WIDTH = (CONTENT_WIDTH - COLUMN_GAP) / 2;
const BODY_SIZE = 7.6;
const BODY_LEADING = 9.4;

function clean(value) {
  return String(value ?? "").trim();
}

function pdfSafeText(value) {
  const cp1252 = new Map([
    [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
    [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
    [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
    [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
    [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
    [0x017e, 0x9e], [0x0178, 0x9f],
  ]);
  let output = "";
  for (const character of String(value ?? "")) {
    const codePoint = character.codePointAt(0);
    const byte = codePoint <= 0xff ? codePoint : cp1252.get(codePoint);
    output += String.fromCharCode(byte ?? 0x3f);
  }
  return output.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function latin1Bytes(value) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return bytes;
}

function concatBytes(...parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function textWidth(text, size, bold = false) {
  let width = 0;
  for (const character of String(text)) {
    let factor = 0.5;
    if (" ilI.,:;'|!".includes(character)) factor = 0.28;
    else if ("MWmw@%&".includes(character)) factor = 0.82;
    else if (/[A-Z0-9]/.test(character)) factor = 0.6;
    width += factor * size;
  }
  return width * (bold ? 1.04 : 1);
}

function wrapParagraph(paragraph, maximum, size = BODY_SIZE, bold = false) {
  const words = clean(paragraph).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && textWidth(candidate, size, bold) > maximum) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function wrapText(value, maximum, size = BODY_SIZE, bold = false) {
  return String(value ?? "").split(/\r?\n/).flatMap((paragraph, index) => {
    const lines = wrapParagraph(paragraph, maximum, size, bold);
    return index ? ["", ...lines] : lines;
  });
}

function compactIncompatibleTraitSpacing(lines) {
  const compacted = [];
  for (const line of lines) {
    if (line.startsWith("Incompatible traits:")) {
      while (compacted.at(-1) === "") compacted.pop();
    }
    compacted.push(line);
  }
  return compacted;
}

class PdfCanvas {
  constructor() {
    this.commands = [];
  }

  text(x, y, value, size, font = "F2", gray = 0, align = "left") {
    const raw = String(value ?? "");
    const width = textWidth(raw, size, font === "F1" || font === "F3");
    if (align === "center") x -= width / 2;
    else if (align === "right") x -= width;
    this.commands.push(`BT /${font} ${size.toFixed(2)} Tf ${gray.toFixed(3)} g 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfSafeText(raw)}) Tj ET`);
  }

  line(x1, y1, x2, y2, width = 0.5, gray = 0) {
    this.commands.push(`${gray.toFixed(3)} G ${width.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  rect(x, y, width, height, gray = 0.95) {
    this.commands.push(`${gray.toFixed(3)} g ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  }
}

function uniqueTraitNames(units) {
  const names = new Set();
  for (const unit of units) {
    for (const name of [unit?.racialTrait, ...(Array.isArray(unit?.traits) ? unit.traits : [])]) {
      if (TRAIT_BY_NAME.has(name)) names.add(name);
    }
  }
  return [...names];
}

function selectedSpells(units) {
  const selections = new Map();
  for (const unit of units) {
    for (const selection of Array.isArray(unit?.spells) ? unit.spells : []) {
      if (!SPELL_BY_NAME.has(selection?.name)) continue;
      if (!selections.has(selection.name)) selections.set(selection.name, new Set());
      selections.get(selection.name).add(Number(selection.level) || 1);
    }
  }
  return [...selections].map(([name, levels]) => ({ name, levels: [...levels].sort((a, b) => a - b) }));
}

export function buildArmyRules(state = {}) {
  const units = Array.isArray(state?.units) ? state.units : [];
  const spells = selectedSpells(units).map(({ name, levels }) => {
    const spell = SPELL_BY_NAME.get(name);
    const levelLabel = levels.length === 1 ? `Level ${levels[0]}` : `Levels ${levels.join(", ")}`;
    return {
      name,
      meta: `${levelLabel} · Roll needed: ${spell.difficulty}${spell.errata ? " (errata)" : ""}`,
      description: spell.description,
    };
  });
  const traits = uniqueTraitNames(units).map((name) => {
    const trait = TRAIT_BY_NAME.get(name);
    return { name, description: trait.description };
  });
  const strategies = [...new Set(Array.isArray(state?.strategies) ? state.strategies : [])]
    .filter((name) => STRATEGY_BY_NAME.has(name))
    .map((name) => {
      const strategy = STRATEGY_BY_NAME.get(name);
      return { name, description: strategy.description };
    });

  return {
    title: clean(state?.armyName) || "Fantastic Battles Army",
    sections: [
      { title: "Spells", entries: spells },
      { title: "Traits", entries: traits },
      { title: "Strategies", entries: strategies },
    ].filter(({ entries }) => entries.length),
  };
}

function entryLayout(entry) {
  const textWidth = COLUMN_WIDTH - 14;
  const nameLines = wrapText(entry.name, textWidth, 10.2, true);
  const metaLines = entry.meta ? wrapText(entry.meta, textWidth, 7.3, true) : [];
  const bodyLines = compactIncompatibleTraitSpacing(wrapText(entry.description, textWidth));
  const height = 6 + nameLines.length * 11.8 + metaLines.length * 8.7 + bodyLines.length * BODY_LEADING + 6;
  return { nameLines, metaLines, bodyLines, height };
}

function drawDocumentHeader(canvas, title, continuation = false) {
  canvas.text(MARGIN, A4[1] - MARGIN, title, continuation ? 14 : 18, "F1", 0.08);
  canvas.text(A4[0] - MARGIN, A4[1] - MARGIN + 1, continuation ? "RULES REFERENCE · CONTINUED" : "RULES REFERENCE", 7.8, "F3", 0.38, "right");
  canvas.line(MARGIN, A4[1] - MARGIN - 7, A4[0] - MARGIN, A4[1] - MARGIN - 7, 1, 0.18);
  return A4[1] - MARGIN - 23;
}

function drawSectionHeading(canvas, x, y, title) {
  canvas.rect(x, y - 3, COLUMN_WIDTH, 17, 0.91);
  canvas.text(x + 7, y + 1, title.toUpperCase(), 8.4, "F3", 0.18);
  return y - 12;
}

function drawEntry(canvas, x, y, entry, layout) {
  const top = y;
  canvas.line(x, top + 2, x + COLUMN_WIDTH, top + 2, 0.3, 0.82);
  let cursor = top - 9;
  for (const line of layout.nameLines) {
    canvas.text(x + 7, cursor, line, 10.2, "F1", 0.08);
    cursor -= 11.8;
  }
  for (const line of layout.metaLines) {
    canvas.text(x + 7, cursor + 1, line, 7.3, "F3", 0.34);
    cursor -= 8.7;
  }
  for (const line of layout.bodyLines) {
    if (line) canvas.text(x + 7, cursor, line, BODY_SIZE, "F2", 0.16);
    cursor -= BODY_LEADING;
  }
  return top - layout.height;
}

function buildPages(document) {
  const pages = [];
  let canvas = new PdfCanvas();
  let column = 0;
  const columnX = () => MARGIN + column * (COLUMN_WIDTH + COLUMN_GAP);
  let pageTop = drawDocumentHeader(canvas, document.title);
  let y = pageTop;

  const newPage = () => {
    pages.push(canvas);
    canvas = new PdfCanvas();
    column = 0;
    pageTop = drawDocumentHeader(canvas, document.title, true);
    y = pageTop;
  };

  const nextColumn = () => {
    if (column === 0) {
      column = 1;
      y = pageTop;
    } else {
      newPage();
    }
  };

  for (const section of document.sections) {
    const layouts = section.entries.map((entry) => entryLayout(entry));
    if (y - 16 - layouts[0].height < MARGIN + 14) nextColumn();
    y = drawSectionHeading(canvas, columnX(), y, section.title);
    section.entries.forEach((entry, index) => {
      const layout = layouts[index];
      if (y - layout.height < MARGIN + 20) {
        nextColumn();
        y = drawSectionHeading(canvas, columnX(), y, section.title);
      }
      y = drawEntry(canvas, columnX(), y, entry, layout);
    });
    y -= 6;
  }
  pages.push(canvas);

  pages.forEach((page, index) => {
    page.line(A4[0] / 2, 34, A4[0] / 2, A4[1] - MARGIN - 17, 0.3, 0.86);
    page.line(MARGIN, 28, A4[0] - MARGIN, 28, 0.4, 0.72);
    page.text(MARGIN, 16, "Fantastic Battles · Army rules reference", 7.5, "F2", 0.48);
    page.text(A4[0] - MARGIN, 16, `${index + 1} / ${pages.length}`, 7.5, "F3", 0.48, "right");
  });
  return pages;
}

function assemblePdf(pages) {
  const objects = new Map();
  objects.set(1, latin1Bytes("<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>"));
  objects.set(3, latin1Bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>"));
  objects.set(4, latin1Bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  objects.set(5, latin1Bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));

  const references = [];
  let nextObject = 6;
  for (const page of pages) {
    const content = latin1Bytes(`${page.commands.join("\n")}\n`);
    const pageObject = nextObject;
    const contentObject = nextObject + 1;
    nextObject += 2;
    references.push(`${pageObject} 0 R`);
    objects.set(pageObject, latin1Bytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4[0].toFixed(3)} ${A4[1].toFixed(3)}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObject} 0 R >>`,
    ));
    objects.set(contentObject, concatBytes(
      latin1Bytes(`<< /Length ${content.length} >>\nstream\n`), content, latin1Bytes("endstream"),
    ));
  }
  objects.set(2, latin1Bytes(`<< /Type /Pages /Count ${pages.length} /Kids [${references.join(" ")}] >>`));

  const chunks = [latin1Bytes("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")];
  const maximumObject = Math.max(...objects.keys());
  const offsets = new Array(maximumObject + 1).fill(0);
  let length = chunks[0].length;
  for (let number = 1; number <= maximumObject; number += 1) {
    offsets[number] = length;
    const object = concatBytes(latin1Bytes(`${number} 0 obj\n`), objects.get(number), latin1Bytes("\nendobj\n"));
    chunks.push(object);
    length += object.length;
  }
  const crossReferenceOffset = length;
  let trailer = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) trailer += `${String(offset).padStart(10, "0")} 00000 n \n`;
  trailer += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF\n`;
  chunks.push(latin1Bytes(trailer));
  return new Blob(chunks, { type: "application/pdf" });
}

export function createRulesPdf(document) {
  if (!document?.sections?.some(({ entries }) => entries?.length)) {
    throw new Error("Cannot create a rules PDF without selected rules.");
  }
  return assemblePdf(buildPages(document));
}

export function rulesPdfFileName(armyName) {
  const slug = clean(armyName).toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "fantastic-battles-army"}-rules-reference.pdf`;
}
