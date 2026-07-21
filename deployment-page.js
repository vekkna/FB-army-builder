import {
  DEPLOYMENT_STORAGE_KEY,
  ZONE_DEPTH_CM,
  ZONE_WIDTH_CM,
  clampDeploymentDelta,
  clampDeploymentPosition,
  createDeploymentPlan,
  deploymentDataFromPieces,
  deploymentPiecesInRect,
  sanitiseDeploymentData,
} from "./deployment.js";
import { calculateUnit } from "./calculator.js";

const MUSTER_STORAGE_KEY = "fantastic-battles-muster:v1";
const byId = (id) => document.getElementById(id);

const elements = {
  title: byId("deployment-title"),
  zone: byId("deployment-zone"),
  scroll: byId("deployment-scroll"),
  empty: byId("deployment-empty"),
  overflow: byId("deployment-overflow"),
  companyCount: byId("company-piece-count"),
  characterCount: byId("character-piece-count"),
  legend: byId("deployment-legend"),
  summonsPanel: byId("summons-panel"),
  summonsList: byId("summons-list"),
  status: byId("deployment-status"),
  marquee: byId("selection-marquee"),
  selectionCount: byId("selection-count"),
  clearSelection: byId("clear-selection"),
  reset: byId("reset-deployment"),
  print: byId("print-deployment"),
};

let army = { armyName: "", units: [] };
let plan = { pieces: [], summons: [], overflow: false };
let piecesById = new Map();
let markerElementsById = new Map();
let selectedPieceIds = new Set();
let drag = null;

function readJSON(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function readArmy() {
  const stored = readJSON(MUSTER_STORAGE_KEY, {});
  return {
    armyName: typeof stored?.armyName === "string" ? stored.armyName.slice(0, 80) : "",
    units: Array.isArray(stored?.units) ? stored.units : [],
  };
}

function readDeployment() {
  return sanitiseDeploymentData(readJSON(DEPLOYMENT_STORAGE_KEY, {}));
}

function persistDeployment() {
  try {
    localStorage.setItem(DEPLOYMENT_STORAGE_KEY, JSON.stringify(deploymentDataFromPieces(plan.pieces)));
  } catch {
    // Planning still works for the current visit when storage is unavailable.
  }
}

function hueFor(unitId) {
  let hash = 0;
  for (const character of String(unitId)) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

function applyPiecePosition(element, piece) {
  element.style.left = `${piece.x / ZONE_WIDTH_CM * 100}%`;
  element.style.top = `${piece.y / ZONE_DEPTH_CM * 100}%`;
  element.style.width = `${piece.sizeCm / ZONE_WIDTH_CM * 100}%`;
}

function pieceDescription(piece) {
  const part = piece.baseCount > 1 ? `, marker ${piece.baseIndex + 1} of ${piece.baseCount}` : "";
  const relic = piece.relic ? `, relic: ${piece.relic}` : "";
  return `${piece.label}, ${piece.kind === "character" ? "character" : "company base"}${part}${relic}`;
}

function makePieceElement(piece) {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = `deployment-piece is-${piece.kind}${piece.characterTrait ? " is-character-company" : ""}`;
  marker.dataset.pieceId = piece.id;
  marker.style.setProperty("--unit-hue", hueFor(piece.unitId));
  marker.setAttribute("aria-label", `${pieceDescription(piece)}. Drag to reposition.`);
  marker.setAttribute("aria-pressed", "false");
  marker.title = pieceDescription(piece);
  applyPiecePosition(marker, piece);

  const code = document.createElement("span");
  code.className = "piece-code";
  code.textContent = String(piece.unitNumber);
  if (piece.baseCount > 1) {
    const ordinal = document.createElement("small");
    ordinal.textContent = `.${piece.baseIndex + 1}`;
    code.append(ordinal);
  }
  marker.append(code);

  const name = document.createElement("span");
  name.className = "piece-name";
  name.textContent = piece.label;
  name.setAttribute("aria-hidden", "true");
  marker.append(name);

  if (piece.characterTrait) {
    const badge = document.createElement("span");
    badge.className = "character-company-badge";
    badge.textContent = "◆";
    badge.title = piece.characterTrait;
    badge.setAttribute("aria-hidden", "true");
    marker.append(badge);
  }

  return marker;
}

function renderSelection() {
  selectedPieceIds = new Set([...selectedPieceIds].filter((id) => piecesById.has(id)));
  for (const [id, marker] of markerElementsById) {
    const selected = selectedPieceIds.has(id);
    marker.classList.toggle("is-selected", selected);
    marker.setAttribute("aria-pressed", String(selected));
  }
  const count = selectedPieceIds.size;
  elements.selectionCount.textContent = `${count} selected`;
  elements.clearSelection.disabled = count === 0;
}

function clearSelection() {
  selectedPieceIds.clear();
  renderSelection();
}

function groupedPieces() {
  const groups = new Map();
  for (const piece of plan.pieces) {
    if (!groups.has(piece.unitId)) groups.set(piece.unitId, []);
    groups.get(piece.unitId).push(piece);
  }
  return [...groups.values()];
}

function renderLegend() {
  elements.legend.replaceChildren();
  for (const pieces of groupedPieces()) {
    const first = pieces[0];
    const item = document.createElement("li");
    item.style.setProperty("--unit-hue", hueFor(first.unitId));

    const key = document.createElement("span");
    key.className = `legend-marker is-${first.kind}`;
    key.textContent = String(first.unitNumber);

    const copy = document.createElement("span");
    copy.className = "legend-copy";
    const name = document.createElement("strong");
    name.textContent = first.label;
    const detail = document.createElement("small");
    const markerLabel = first.kind === "character"
      ? `${pieces.length} ${pieces.length === 1 ? "character" : "characters"}`
      : `${pieces.length} × 6 cm ${pieces.length === 1 ? "base" : "bases"}`;
    detail.textContent = `${first.profile} · ${markerLabel}${first.characterTrait ? ` · ${first.characterTrait}` : ""}`;
    copy.append(name, detail);
    if (first.relic) {
      const relic = document.createElement("span");
      relic.className = "legend-relic";
      relic.textContent = `Relic: ${first.relic}`;
      copy.append(relic);
    }
    item.append(key, copy);
    elements.legend.append(item);
  }
}

function renderSummons() {
  elements.summonsPanel.hidden = plan.summons.length === 0;
  elements.summonsList.replaceChildren();
  for (const summon of plan.summons) {
    const item = document.createElement("li");
    const code = document.createElement("strong");
    code.textContent = String(summon.unitNumber);
    const label = document.createElement("span");
    label.textContent = summon.label;
    const profile = document.createElement("small");
    const sourceUnit = army.units.find((unit) => String(unit?.id) === summon.unitId);
    const summonCost = sourceUnit ? calculateUnit(sourceUnit).pointsPerBase : 0;
    profile.textContent = `${summon.profile} · ${summonCost} pts summon cost`;
    item.append(code, label, profile);
    elements.summonsList.append(item);
  }
}

function centreViewportOnPieces() {
  window.requestAnimationFrame(() => {
    if (!plan.pieces.length || elements.scroll.scrollWidth <= elements.scroll.clientWidth) return;
    const centres = plan.pieces
      .map((piece) => piece.x + piece.sizeCm / 2)
      .sort((left, right) => left - right);
    const middle = Math.floor(centres.length / 2);
    const median = centres.length % 2 ? centres[middle] : (centres[middle - 1] + centres[middle]) / 2;
    const centre = median / ZONE_WIDTH_CM * elements.scroll.scrollWidth;
    elements.scroll.scrollLeft = Math.max(0, centre - elements.scroll.clientWidth / 2);
  });
}

function render() {
  piecesById = new Map(plan.pieces.map((piece) => [piece.id, piece]));
  elements.title.textContent = army.armyName.trim() || "Untitled army";
  document.title = `${army.armyName.trim() || "Untitled army"} · Deployment Plan`;
  const companies = plan.pieces.filter(({ kind }) => kind === "company").length;
  const characters = plan.pieces.length - companies;
  elements.companyCount.textContent = String(companies);
  elements.characterCount.textContent = String(characters);
  elements.empty.hidden = plan.pieces.length > 0;
  elements.overflow.hidden = !plan.overflow;
  elements.reset.disabled = plan.pieces.length === 0;

  elements.zone.querySelectorAll(".deployment-piece").forEach((element) => element.remove());
  markerElementsById = new Map();
  const fragment = document.createDocumentFragment();
  for (const piece of plan.pieces) {
    const marker = makePieceElement(piece);
    markerElementsById.set(piece.id, marker);
    fragment.append(marker);
  }
  elements.zone.append(fragment);
  renderSelection();
  renderLegend();
  renderSummons();
  centreViewportOnPieces();
}

function loadCurrentPlan(useSavedPositions = true) {
  army = readArmy();
  plan = createDeploymentPlan(army.units, useSavedPositions ? readDeployment() : {});
  render();
  persistDeployment();
}

function boardCoordinates(event) {
  const bounds = elements.zone.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) / bounds.width * ZONE_WIDTH_CM,
    y: (event.clientY - bounds.top) / bounds.height * ZONE_DEPTH_CM,
  };
}

function boundedBoardCoordinates(event) {
  return clampDeploymentPosition(boardCoordinates(event), 0);
}

function renderMarquee(start, end) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  elements.marquee.hidden = false;
  elements.marquee.style.left = `${left / ZONE_WIDTH_CM * 100}%`;
  elements.marquee.style.top = `${top / ZONE_DEPTH_CM * 100}%`;
  elements.marquee.style.width = `${Math.abs(end.x - start.x) / ZONE_WIDTH_CM * 100}%`;
  elements.marquee.style.height = `${Math.abs(end.y - start.y) / ZONE_DEPTH_CM * 100}%`;
}

function announce(piece) {
  elements.status.textContent = `${piece.label} moved to ${Math.round(piece.x)} cm across, ${Math.round(piece.y)} cm deep.`;
}

elements.zone.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const marker = event.target.closest(".deployment-piece");
  const piece = marker && piecesById.get(marker.dataset.pieceId);
  const additive = event.shiftKey || event.ctrlKey || event.metaKey;

  if (!piece) {
    if (event.pointerType === "touch") return;
    event.preventDefault();
    const start = boundedBoardCoordinates(event);
    const initialSelection = additive ? new Set(selectedPieceIds) : new Set();
    if (!additive) clearSelection();
    drag = {
      type: "marquee",
      pointerId: event.pointerId,
      capture: elements.zone,
      start,
      current: start,
      initialSelection,
    };
    renderMarquee(start, start);
    try {
      elements.zone.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events do not always own native pointer capture.
    }
    return;
  }

  event.preventDefault();
  if (additive) {
    if (selectedPieceIds.has(piece.id)) selectedPieceIds.delete(piece.id);
    else selectedPieceIds.add(piece.id);
    renderSelection();
    elements.status.textContent = `${selectedPieceIds.size} markers selected.`;
    return;
  }

  if (!selectedPieceIds.has(piece.id)) {
    selectedPieceIds = new Set([piece.id]);
    renderSelection();
  }
  const selectedPieces = plan.pieces.filter((candidate) => selectedPieceIds.has(candidate.id));
  const pointer = boardCoordinates(event);
  drag = {
    type: "pieces",
    pointerId: event.pointerId,
    capture: marker,
    start: pointer,
    pieces: selectedPieces,
    origins: new Map(selectedPieces.map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }])),
    startPieces: selectedPieces.map((candidate) => ({ ...candidate })),
    moved: false,
  };
  for (const selected of selectedPieces) markerElementsById.get(selected.id)?.classList.add("is-dragging");
  try {
    marker.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic pointer events do not always own native pointer capture.
  }
});

elements.zone.addEventListener("pointermove", (event) => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  if (drag.type === "marquee") {
    drag.current = boundedBoardCoordinates(event);
    renderMarquee(drag.start, drag.current);
    return;
  }

  const pointer = boardCoordinates(event);
  const delta = clampDeploymentDelta(drag.startPieces, {
    x: pointer.x - drag.start.x,
    y: pointer.y - drag.start.y,
  });
  drag.moved ||= Math.abs(delta.x) > .01 || Math.abs(delta.y) > .01;
  for (const piece of drag.pieces) {
    const origin = drag.origins.get(piece.id);
    piece.x = origin.x + delta.x;
    piece.y = origin.y + delta.y;
    applyPiecePosition(markerElementsById.get(piece.id), piece);
  }
});

function endDrag(event, cancelled = false) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (drag.capture.hasPointerCapture?.(event.pointerId)) drag.capture.releasePointerCapture(event.pointerId);

  if (drag.type === "marquee") {
    elements.marquee.hidden = true;
    if (cancelled) {
      selectedPieceIds = drag.initialSelection;
    } else {
      drag.current = boundedBoardCoordinates(event);
      const moved = Math.abs(drag.current.x - drag.start.x) > .25 || Math.abs(drag.current.y - drag.start.y) > .25;
      selectedPieceIds = new Set(drag.initialSelection);
      if (moved) {
        for (const piece of deploymentPiecesInRect(plan.pieces, {
          x1: drag.start.x,
          y1: drag.start.y,
          x2: drag.current.x,
          y2: drag.current.y,
        })) selectedPieceIds.add(piece.id);
      }
    }
    renderSelection();
    elements.status.textContent = `${selectedPieceIds.size} markers selected.`;
    drag = null;
    return;
  }

  for (const piece of drag.pieces) markerElementsById.get(piece.id)?.classList.remove("is-dragging");
  if (drag.pieces.length > 1) elements.status.textContent = `Moved ${drag.pieces.length} selected markers.`;
  else announce(drag.pieces[0]);
  drag = null;
  persistDeployment();
}

elements.zone.addEventListener("pointerup", endDrag);
elements.zone.addEventListener("pointercancel", (event) => endDrag(event, true));

elements.clearSelection.addEventListener("click", () => {
  clearSelection();
  elements.status.textContent = "Selection cleared.";
});

elements.reset.addEventListener("click", () => {
  if (!window.confirm("Reset every marker to its initial grouped formation?")) return;
  selectedPieceIds.clear();
  loadCurrentPlan(false);
  elements.status.textContent = "Deployment reset to its initial formation.";
});

elements.print.addEventListener("click", () => window.print());

window.addEventListener("storage", (event) => {
  if (event.key === MUSTER_STORAGE_KEY || event.key === DEPLOYMENT_STORAGE_KEY) loadCurrentPlan(true);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !drag) loadCurrentPlan(true);
});

let resizeTimer;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(centreViewportOnPieces, 80);
});

loadCurrentPlan(true);

globalThis.__FB_DEPLOYMENT__ = Object.freeze({
  getArmy: () => structuredClone(army),
  getPlan: () => structuredClone(plan),
  getSelection: () => [...selectedPieceIds],
  reset: () => loadCurrentPlan(false),
});
