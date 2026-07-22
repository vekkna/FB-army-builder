import { calculateUnit } from "./calculator.js";
import { SPELLS, TRAITS } from "./data.js";

const MM = 72 / 25.4;
const A4_LANDSCAPE = [297 * MM, 210 * MM];
const CARD_WIDTH_MM = 60;
const CARD_HEIGHT_MM = 20;
const RIGHT_BOX_SIZE_MM = 20;
const CARD_W = CARD_WIDTH_MM * MM;
const CARD_H = CARD_HEIGHT_MM * MM;
const LEFT_PANEL_W = (CARD_WIDTH_MM - RIGHT_BOX_SIZE_MM) * MM;
const RIGHT_BOX_SIZE = RIGHT_BOX_SIZE_MM * MM;
const ABILITY_AREA_HEIGHT = CARD_H - 3.8 * MM - 4.6 * MM;
const ABILITY_CELL_MAX_WIDTH = LEFT_PANEL_W / 2 - 1.2 * MM;
const ABILITY_CELL_MAX_HEIGHT = ABILITY_AREA_HEIGHT / 2 - 0.8 * MM;
const GRID_GAP = 0;
const GRID_COLUMNS = Math.max(1, Math.floor((A4_LANDSCAPE[0] + GRID_GAP) / (CARD_W + GRID_GAP)));
const GRID_ROWS = Math.max(1, Math.floor((A4_LANDSCAPE[1] + GRID_GAP) / (CARD_H + GRID_GAP)));

export const CARDS_PER_PAGE = GRID_COLUMNS * GRID_ROWS;
export const UNIT_CARD_SIZE = Object.freeze({ width: CARD_WIDTH_MM, height: CARD_HEIGHT_MM, unit: "mm" });

function clean(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  return String(value).trim();
}

export function buildUnitCardData(units = []) {
  if (!Array.isArray(units)) return [];
  return units.map((unit) => {
    const stats = calculateUnit(unit);
    const abilities = [];
    if (unit?.racialTrait) abilities.push({ kind: "Racial", name: unit.racialTrait });
    for (const trait of Array.isArray(unit?.traits) ? unit.traits : []) {
      if (trait) abilities.push({ kind: "Trait", name: trait });
    }
    for (const spell of Array.isArray(unit?.spells) ? unit.spells : []) {
      if (spell?.name) abilities.push({ kind: "Spell", name: `${spell.name} L${spell.level}` });
    }
    if (unit?.relic) abilities.push({ kind: "Relic", name: unit.relic });
    return {
      name: clean(unit?.name) || clean(unit?.profile) || "Unnamed unit",
      company: clean(unit?.profile),
      resolve: stats.resolve,
      move: stats.move,
      melee: stats.melee,
      short: stats.shootShort,
      long: stats.shootLong,
      defence: stats.defence,
      command: stats.command,
      abilities,
      points: stats.pointsPerBase,
      bases: stats.bases,
    };
  });
}

export function displayedCardAbilities(unit) {
  const abilities = Array.isArray(unit?.abilities) ? unit.abilities : [];
  const spells = abilities.filter((ability) => ability.kind === "Spell");
  if (spells.length) return spells.slice(0, 4);
  return abilities.filter((ability) => ability.kind !== "Relic").slice(0, 4);
}

function displayedCardTitle(unit) {
  const abilities = Array.isArray(unit?.abilities) ? unit.abilities : [];
  const relic = abilities.find((ability) => ability.kind === "Relic" && clean(ability.name));
  return relic ? `${clean(unit?.name)} - ${clean(relic.name)}` : clean(unit?.name);
}

export function unitCardPageCount(cardCount) {
  return Math.ceil(Math.max(0, Number(cardCount) || 0) / CARDS_PER_PAGE);
}

export function unitCardsFileName(armyName) {
  const slug = clean(armyName)
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "fantastic-battles-army"}-unit-cards.pdf`;
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
  for (const character of clean(value).replace(/[\n\r]+/g, " ")) {
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

function approxTextWidth(text, size, bold = false) {
  let width = 0;
  for (const character of text) {
    let factor = 0.5;
    if (" ilI.,:;'|!".includes(character)) factor = 0.28;
    else if ("MWmw@%&".includes(character)) factor = 0.82;
    else if (/[A-Z0-9]/.test(character)) factor = 0.6;
    width += factor * size;
  }
  return width * (bold ? 1.04 : 1);
}

const HELVETICA_BOLD_WIDTHS = {
  " ": 278, "!": 333, "\"": 474, "#": 556, "$": 556, "%": 889, "&": 722, "'": 238,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556,
  "8": 556, "9": 556, ":": 333, ";": 333, "<": 584, "=": 584, ">": 584, "?": 611,
  "@": 975, "A": 722, "B": 722, "C": 722, "D": 722, "E": 667, "F": 611, "G": 778,
  "H": 722, "I": 278, "J": 556, "K": 722, "L": 611, "M": 833, "N": 722, "O": 778,
  "P": 667, "Q": 778, "R": 722, "S": 667, "T": 611, "U": 722, "V": 667, "W": 944,
  "X": 667, "Y": 667, "Z": 611, "[": 333, "\\": 278, "]": 333, "^": 584, "_": 556,
  "`": 333, "a": 556, "b": 611, "c": 556, "d": 611, "e": 556, "f": 333, "g": 611,
  "h": 611, "i": 278, "j": 278, "k": 556, "l": 278, "m": 889, "n": 611, "o": 611,
  "p": 611, "q": 611, "r": 389, "s": 556, "t": 333, "u": 611, "v": 556, "w": 778,
  "x": 556, "y": 556, "z": 500, "{": 389, "|": 280, "}": 389, "~": 584,
};

function pdfTextWidth(text, size, font = "F2") {
  if (font !== "F3") return approxTextWidth(text, size, font === "F1");
  let units = 0;
  for (const character of text) units += HELVETICA_BOLD_WIDTHS[character] ?? 556;
  return units * size / 1000;
}

function fitSize(text, maximum, preferred, minimum, bold = false) {
  if (!text) return preferred;
  const estimate = approxTextWidth(text, preferred, bold);
  return Math.max(minimum, estimate <= maximum ? preferred : preferred * maximum / estimate);
}

function fitTitleSize(text, maximum) {
  const preferred = 8;
  const estimate = approxTextWidth(text, preferred, true);
  return Math.max(1.4, estimate <= maximum ? preferred : preferred * maximum / estimate);
}

function fitAbilityText(text, maximumWidth, maximumHeight, preferred) {
  const value = clean(text);
  const candidates = [];
  const addCandidate = (lines) => {
    const widest = Math.max(...lines.map((line) => pdfTextWidth(line, preferred, "F3")));
    const widthSize = widest > maximumWidth ? preferred * maximumWidth / widest : preferred;
    const heightSize = maximumHeight / (lines.length * 1.15);
    candidates.push({ lines, size: Math.min(preferred, widthSize, heightSize) });
  };

  addCandidate([value]);
  const words = value.split(/\s+/).filter(Boolean);
  for (let split = 1; split < words.length; split += 1) {
    addCandidate([words.slice(0, split).join(" "), words.slice(split).join(" ")]);
  }
  return candidates.reduce((best, candidate) => candidate.size > best.size ? candidate : best);
}

const ALL_CARD_ABILITY_NAMES = [
  ...TRAITS.map(({ name }) => name),
  ...SPELLS.map(({ name }) => `${name} L3`),
];

export const UNIT_CARD_ABILITY_FONT_SIZE = Math.min(...ALL_CARD_ABILITY_NAMES.map((name) => (
  fitAbilityText(name, ABILITY_CELL_MAX_WIDTH, ABILITY_CELL_MAX_HEIGHT, 14).size
)));

function roundedRect(x, y, width, height, radius) {
  const k = 0.55228475;
  const r = Math.min(radius, width / 2, height / 2);
  const f = (number) => number.toFixed(2);
  return `${f(x + r)} ${f(y)} m ${f(x + width - r)} ${f(y)} l ` +
    `${f(x + width - r + k * r)} ${f(y)} ${f(x + width)} ${f(y + r - k * r)} ${f(x + width)} ${f(y + r)} c ` +
    `${f(x + width)} ${f(y + height - r)} l ` +
    `${f(x + width)} ${f(y + height - r + k * r)} ${f(x + width - r + k * r)} ${f(y + height)} ${f(x + width - r)} ${f(y + height)} c ` +
    `${f(x + r)} ${f(y + height)} l ` +
    `${f(x + r - k * r)} ${f(y + height)} ${f(x)} ${f(y + height - r + k * r)} ${f(x)} ${f(y + height - r)} c ` +
    `${f(x)} ${f(y + r)} l ${f(x)} ${f(y + r - k * r)} ${f(x + r - k * r)} ${f(y)} ${f(x + r)} ${f(y)} c h`;
}

class PdfCanvas {
  constructor() {
    this.commands = [];
  }

  add(command) {
    this.commands.push(command);
  }

  text(x, y, value, size, font = "F2", gray = 0, align = "left") {
    const raw = clean(value);
    const width = pdfTextWidth(raw, size, font);
    if (align === "center") x -= width / 2;
    else if (align === "right") x -= width;
    this.add(`BT /${font} ${size.toFixed(2)} Tf ${gray.toFixed(3)} g 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfSafeText(raw)}) Tj ET`);
  }

  line(x1, y1, x2, y2, width = 0.5, gray = 0) {
    this.add(`${gray.toFixed(3)} G ${width.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  rect(x, y, width, height, stroke = 0, fill = null, lineWidth = 0.5, radius = 0) {
    const path = radius
      ? roundedRect(x, y, width, height, radius)
      : `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`;
    let prefix = `${stroke.toFixed(3)} G ${lineWidth.toFixed(2)} w `;
    let paint = "S";
    if (fill !== null) {
      prefix += `${fill.toFixed(3)} g `;
      paint = "B";
    }
    this.add(`${prefix}${path} ${paint}`);
  }
}

function drawCardContent(canvas, unit, x, y) {
  canvas.rect(x, y, CARD_W, CARD_H, 0.08, 1, 0.6);
  canvas.rect(x + LEFT_PANEL_W, y, RIGHT_BOX_SIZE, RIGHT_BOX_SIZE, 0.08, 1, 0.6);

  const top = y + CARD_H;
  const nameBandHeight = 3.8 * MM;
  const titlePadding = 0.7 * MM;
  const titleX = x + titlePadding;
  const titleMax = LEFT_PANEL_W - 2 * titlePadding;
  const title = displayedCardTitle(unit);
  const titleSize = fitTitleSize(title, titleMax);
  canvas.text(titleX, top - 2.8 * MM, title, titleSize, "F1");

  const statHeight = 4.6 * MM;
  const statY = top - nameBandHeight - statHeight;
  const statX = x;
  const statAreaWidth = LEFT_PANEL_W;
  const statWidth = statAreaWidth / 5;
  const statItems = [
    ["RES", unit.resolve], ["MOV", unit.move], ["MEL", unit.melee],
    ["SHT", `${clean(unit.short)}/${clean(unit.long)}`], ["DEF", unit.defence],
  ];
  canvas.rect(statX, statY, statAreaWidth, statHeight, 0.6, 0.975, 0.28);
  statItems.forEach(([label, value], index) => {
    const statCellX = statX + index * statWidth;
    if (index) canvas.line(statCellX, statY, statCellX, statY + statHeight, 0.22, 0.68);
    canvas.text(statCellX + statWidth / 2, statY + 3.3 * MM, label, 3.4, "F3", 0.34, "center");
    const display = clean(value) || "-";
    const valueSize = fitSize(display, statWidth - 0.8 * MM, 7.2, 4.5, true);
    canvas.text(statCellX + statWidth / 2, statY + 0.65 * MM, display, valueSize, "F1", 0, "center");
  });

  const abilities = displayedCardAbilities(unit).slice(0, 4);
  const areaX = x;
  const areaY = y;
  const areaWidth = LEFT_PANEL_W;
  const areaHeight = statY - areaY;
  const cellWidth = areaWidth / 2;
  const cellHeight = areaHeight / 2;
  canvas.line(areaX + cellWidth, areaY, areaX + cellWidth, areaY + areaHeight, 0.22, 0.72);
  canvas.line(areaX, areaY + cellHeight, areaX + areaWidth, areaY + cellHeight, 0.22, 0.72);

  if (!abilities.length) {
    canvas.text(areaX + cellWidth / 2, areaY + cellHeight * 1.5 - 1.8, "NO TRAITS", 5.2, "F3", 0.48, "center");
    return;
  }

  abilities.forEach((ability, index) => {
    const column = index % 2;
    const rowFromTop = Math.floor(index / 2);
    const cellX = areaX + column * cellWidth;
    const cellY = areaY + (1 - rowFromTop) * cellHeight;
    const fitted = fitAbilityText(ability.name, ABILITY_CELL_MAX_WIDTH, ABILITY_CELL_MAX_HEIGHT, 14);
    const lineHeight = UNIT_CARD_ABILITY_FONT_SIZE * 1.15;
    const centerY = cellY + cellHeight / 2 - UNIT_CARD_ABILITY_FONT_SIZE * 0.34;
    fitted.lines.forEach((line, lineIndex) => {
      const lineY = centerY + ((fitted.lines.length - 1) / 2 - lineIndex) * lineHeight;
      canvas.text(cellX + cellWidth / 2, lineY, line, UNIT_CARD_ABILITY_FONT_SIZE, "F3", 0, "center");
    });
  });
}

function drawCard(canvas, unit, x, y) {
  drawCardContent(canvas, unit, x, y);
}

function buildPdfPages(units) {
  const [pageWidth, pageHeight] = A4_LANDSCAPE;
  const gridWidth = GRID_COLUMNS * CARD_W + (GRID_COLUMNS - 1) * GRID_GAP;
  const gridHeight = GRID_ROWS * CARD_H + (GRID_ROWS - 1) * GRID_GAP;
  const marginX = (pageWidth - gridWidth) / 2;
  const marginY = (pageHeight - gridHeight) / 2;
  const pages = [];

  for (let pageStart = 0; pageStart < units.length; pageStart += CARDS_PER_PAGE) {
    const canvas = new PdfCanvas();
    units.slice(pageStart, pageStart + CARDS_PER_PAGE).forEach((unit, slot) => {
      const column = slot % GRID_COLUMNS;
      const rowFromTop = Math.floor(slot / GRID_COLUMNS);
      const x = marginX + column * (CARD_W + GRID_GAP);
      const y = pageHeight - marginY - CARD_H - rowFromTop * (CARD_H + GRID_GAP);
      drawCard(canvas, unit, x, y);
    });
    pages.push(latin1Bytes(`${canvas.commands.join("\n")}\n`));
  }
  return pages;
}

export function createUnitCardsPdf(units) {
  const pages = buildPdfPages(Array.isArray(units) ? units : []);
  if (!pages.length) throw new Error("Cannot create a PDF without any cards.");

  const objects = new Map();
  objects.set(1, latin1Bytes("<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>"));
  objects.set(3, latin1Bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>"));
  objects.set(4, latin1Bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  objects.set(5, latin1Bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));
  objects.set(6, latin1Bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"));

  const pageReferences = [];
  let nextObject = 7;
  for (const content of pages) {
    const pageObject = nextObject;
    const contentObject = nextObject + 1;
    nextObject += 2;
    pageReferences.push(`${pageObject} 0 R`);
    objects.set(pageObject, latin1Bytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_LANDSCAPE[0].toFixed(3)} ${A4_LANDSCAPE[1].toFixed(3)}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${contentObject} 0 R >>`,
    ));
    objects.set(contentObject, concatBytes(
      latin1Bytes(`<< /Length ${content.length} >>\nstream\n`), content, latin1Bytes("endstream"),
    ));
  }
  objects.set(2, latin1Bytes(`<< /Type /Pages /Count ${pages.length} /Kids [${pageReferences.join(" ")}] >>`));

  const chunks = [latin1Bytes("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")];
  const maxObject = Math.max(...objects.keys());
  const offsets = new Array(maxObject + 1).fill(0);
  let length = chunks[0].length;
  for (let number = 1; number <= maxObject; number += 1) {
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
