import { HERO_PROFILES } from "./data.js";
import { spellLevelAllowance } from "./calculator.js";

export const DEPLOYMENT_STORAGE_KEY = "fantastic-battles-deployment:v1";
export const ZONE_WIDTH_CM = 156;
export const ZONE_DEPTH_CM = 36;
export const COMPANY_BASE_CM = 6;
export const CHARACTER_DIAMETER_CM = 3;

const GROUP_GAP_CM = 1.5;

function wholeBaseCount(raw) {
  const count = Number(raw);
  return Number.isFinite(count) ? Math.max(0, Math.min(999, Math.round(count))) : 0;
}

function finiteCoordinate(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function rounded(value) {
  return Math.round(value * 1000) / 1000;
}

export function deploymentPieceId(unitId, baseIndex) {
  return JSON.stringify([String(unitId), baseIndex]);
}

export function isDeploymentCharacter(unit) {
  return HERO_PROFILES.has(unit?.profile);
}

export function deploymentSpellLabels(unit) {
  if (!Array.isArray(unit?.spells)) return [];
  return unit.spells.flatMap((selection) => {
    const name = String(selection?.name || "").trim();
    if (!name) return [];
    const level = Math.max(1, Math.round(Number(selection?.level) || 1));
    return [`${name} L${level}`];
  });
}

export function deploymentSpellSummary(unit) {
  if (!spellLevelAllowance(unit)) return "";
  const spells = deploymentSpellLabels(unit);
  return spells.length ? `Spells: ${spells.join(", ")}` : "Spells: none selected";
}

export function clampDeploymentPosition(position, sizeCm) {
  const size = Math.max(0, finiteCoordinate(sizeCm));
  const maximumX = Math.max(0, ZONE_WIDTH_CM - size);
  const maximumY = Math.max(0, ZONE_DEPTH_CM - size);
  return {
    x: rounded(Math.min(maximumX, Math.max(0, finiteCoordinate(position?.x)))),
    y: rounded(Math.min(maximumY, Math.max(0, finiteCoordinate(position?.y)))),
  };
}

export function clampDeploymentDelta(pieces = [], delta = {}) {
  const source = pieces.filter((piece) => piece && Number.isFinite(Number(piece.x)) && Number.isFinite(Number(piece.y)));
  if (!source.length) return { x: 0, y: 0 };
  const minimumX = Math.min(...source.map((piece) => Number(piece.x)));
  const minimumY = Math.min(...source.map((piece) => Number(piece.y)));
  const maximumX = Math.max(...source.map((piece) => Number(piece.x) + Math.max(0, Number(piece.sizeCm) || 0)));
  const maximumY = Math.max(...source.map((piece) => Number(piece.y) + Math.max(0, Number(piece.sizeCm) || 0)));
  return {
    x: rounded(Math.min(ZONE_WIDTH_CM - maximumX, Math.max(-minimumX, finiteCoordinate(delta?.x)))),
    y: rounded(Math.min(ZONE_DEPTH_CM - maximumY, Math.max(-minimumY, finiteCoordinate(delta?.y)))),
  };
}

export function deploymentPiecesInRect(pieces = [], rectangle = {}) {
  const firstX = finiteCoordinate(rectangle?.x1);
  const secondX = finiteCoordinate(rectangle?.x2);
  const firstY = finiteCoordinate(rectangle?.y1);
  const secondY = finiteCoordinate(rectangle?.y2);
  const left = Math.min(firstX, secondX);
  const right = Math.max(firstX, secondX);
  const top = Math.min(firstY, secondY);
  const bottom = Math.max(firstY, secondY);
  return pieces.filter((piece) => {
    const size = Math.max(0, Number(piece?.sizeCm) || 0);
    return Number(piece?.x) <= right
      && Number(piece?.x) + size >= left
      && Number(piece?.y) <= bottom
      && Number(piece?.y) + size >= top;
  });
}

function characterTrait(unit) {
  return [unit?.racialTrait, ...(Array.isArray(unit?.traits) ? unit.traits : [])]
    .find((name) => typeof name === "string" && name.startsWith("Character (")) || "";
}

function makeGroup(unit, unitIndex) {
  const count = wholeBaseCount(unit?.bases);
  if (!count) return null;

  const kind = isDeploymentCharacter(unit) ? "character" : "company";
  const sizeCm = kind === "character" ? CHARACTER_DIAMETER_CM : COMPANY_BASE_CM;
  const maximumColumns = Math.max(1, Math.floor(ZONE_WIDTH_CM / sizeCm));
  const maximumRows = Math.max(1, Math.floor(ZONE_DEPTH_CM / sizeCm));
  let columns = Math.min(count, maximumColumns, Math.max(1, Math.ceil(Math.sqrt(count))));

  if (Math.ceil(count / columns) > maximumRows) {
    columns = Math.min(maximumColumns, Math.ceil(count / maximumRows));
  }

  const rows = Math.ceil(count / columns);
  const label = String(unit?.name || "").trim() || String(unit?.profile || "Unit");
  const attachedCharacter = kind === "company" ? characterTrait(unit) : "";
  const pieces = Array.from({ length: count }, (_, baseIndex) => ({
    id: deploymentPieceId(unit?.id || `unit-${unitIndex}`, baseIndex),
    unitId: String(unit?.id || `unit-${unitIndex}`),
    unitNumber: unitIndex + 1,
    baseIndex,
    baseCount: count,
    label,
    profile: String(unit?.profile || "Unit"),
    kind,
    sizeCm,
    relic: typeof unit?.relic === "string" ? unit.relic : "",
    characterTrait: attachedCharacter,
    x: (baseIndex % columns) * sizeCm,
    y: Math.floor(baseIndex / columns) * sizeCm,
  }));

  return {
    width: columns * sizeCm,
    height: rows * sizeCm,
    overflow: rows > maximumRows,
    pieces,
  };
}

function initialPieces(units) {
  const groups = units.map(makeGroup).filter(Boolean);
  const shelves = [];
  let shelf = { width: 0, height: 0, groups: [] };

  for (const group of groups) {
    const nextWidth = shelf.groups.length ? shelf.width + GROUP_GAP_CM + group.width : group.width;
    if (shelf.groups.length && nextWidth > ZONE_WIDTH_CM) {
      shelves.push(shelf);
      shelf = { width: 0, height: 0, groups: [] };
    }
    if (shelf.groups.length) shelf.width += GROUP_GAP_CM;
    shelf.groups.push(group);
    shelf.width += group.width;
    shelf.height = Math.max(shelf.height, group.height);
  }
  if (shelf.groups.length) shelves.push(shelf);

  const totalHeight = shelves.reduce((sum, item) => sum + item.height, 0)
    + Math.max(0, shelves.length - 1) * GROUP_GAP_CM;
  const overflow = totalHeight > ZONE_DEPTH_CM || groups.some((group) => group.overflow);
  let shelfY = Math.max(0, ZONE_DEPTH_CM - totalHeight);
  const pieces = [];

  for (const currentShelf of shelves) {
    let groupX = Math.max(0, (ZONE_WIDTH_CM - currentShelf.width) / 2);
    for (const group of currentShelf.groups) {
      const groupY = shelfY + currentShelf.height - group.height;
      for (const piece of group.pieces) {
        const position = clampDeploymentPosition({ x: groupX + piece.x, y: groupY + piece.y }, piece.sizeCm);
        pieces.push({ ...piece, ...position });
      }
      groupX += group.width + GROUP_GAP_CM;
    }
    shelfY += currentShelf.height + GROUP_GAP_CM;
  }

  return { pieces, overflow };
}

export function sanitiseDeploymentData(raw = {}) {
  const source = raw?.positions && typeof raw.positions === "object" ? raw.positions : {};
  const positions = {};
  for (const [id, position] of Object.entries(source)) {
    if (!position || !Number.isFinite(Number(position.x)) || !Number.isFinite(Number(position.y))) continue;
    positions[id] = { x: rounded(Number(position.x)), y: rounded(Number(position.y)) };
  }
  return { version: 1, positions };
}

export function createDeploymentPlan(units = [], savedDeployment = {}) {
  const sourceUnits = Array.isArray(units) ? units : [];
  const initial = initialPieces(sourceUnits);
  const saved = sanitiseDeploymentData(savedDeployment).positions;
  const pieces = initial.pieces.map((piece) => {
    const position = saved[piece.id]
      ? clampDeploymentPosition(saved[piece.id], piece.sizeCm)
      : { x: piece.x, y: piece.y };
    return { ...piece, ...position };
  });

  return {
    pieces,
    overflow: initial.overflow,
    summons: sourceUnits
      .map((unit, unitIndex) => ({ unit, unitIndex }))
      .filter(({ unit }) => wholeBaseCount(unit?.bases) === 0)
      .map(({ unit, unitIndex }) => ({
        unitId: String(unit?.id || `unit-${unitIndex}`),
        unitNumber: unitIndex + 1,
        label: String(unit?.name || "").trim() || String(unit?.profile || "Unit"),
        profile: String(unit?.profile || "Unit"),
      })),
  };
}

export function deploymentDataFromPieces(pieces = []) {
  const positions = {};
  for (const piece of pieces) {
    if (!piece?.id) continue;
    positions[piece.id] = clampDeploymentPosition(piece, piece.sizeCm);
  }
  return { version: 1, positions };
}
