import {
  DEPLOYMENT_STORAGE_KEY,
  ZONE_DEPTH_CM,
  ZONE_WIDTH_CM,
  clampDeploymentDelta,
  clampDeploymentPosition,
  createDeploymentPlan,
  deploymentDataFromPieces,
  deploymentPiecesInRect,
  deploymentSpellSummary,
  sanitiseDeploymentData,
} from "./deployment.js?v=spell-key-2";
import { calculateUnit } from "./calculator.js";

const MUSTER_STORAGE_KEY = "fantastic-battles-muster:v1";
const byId = (id) => document.getElementById(id);

const elements = {
  title: byId("deployment-title"),
  zone: byId("deployment-zone"),
  canvas: byId("zone-canvas"),
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
  zoomOut: byId("zoom-out"),
  zoomIn: byId("zoom-in"),
  zoomFit: byId("zoom-fit"),
  zoomLevel: byId("zoom-level"),
  reset: byId("reset-deployment"),
  print: byId("print-deployment"),
};

const MIN_CANVAS_WIDTH = 1038;
const MIN_ZOOM = .25;
const MAX_ZOOM = 2.5;
const ZOOM_FACTOR = 1.25;
let army = { armyName: "", units: [] };
let plan = { pieces: [], summons: [], overflow: false };
let piecesById = new Map();
let markerElementsById = new Map();
let selectedPieceIds = new Set();
let drag = null;
let canvasBaseWidth = MIN_CANVAS_WIDTH;
let zoom = 1;
let fitMode = window.innerWidth <= 700 || window.innerHeight <= 500;
const touchPoints = new Map();
let touchGesture = null;
let suppressTouchGestureUntilRelease = false;

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
  element.style.height = `${piece.sizeCm / ZONE_WIDTH_CM * 100}cqw`;
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
    const sourceUnit = army.units.find((unit) => String(unit?.id) === first.unitId);
    const spellSummary = deploymentSpellSummary(sourceUnit);
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
    if (spellSummary) {
      const spells = document.createElement("span");
      spells.className = "legend-spells";
      spells.textContent = spellSummary;
      copy.append(spells);
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

function clampZoom(value) {
  const numeric = Number(value);
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(numeric) ? numeric : 1));
}

function fitZoomLevel() {
  return clampZoom((elements.scroll.clientWidth - 2) / canvasBaseWidth);
}

function updateZoomControls() {
  const rounded = Math.round(zoom * 100);
  elements.zoomLevel.textContent = `${rounded}%`;
  elements.zoomOut.disabled = zoom <= MIN_ZOOM + .001;
  elements.zoomIn.disabled = zoom >= MAX_ZOOM - .001;
  elements.zoomFit.setAttribute("aria-pressed", String(fitMode));
  elements.zoomFit.title = fitMode ? "The whole deployment zone is fitted to the viewport" : "Fit the whole deployment zone";
}

function setZoom(nextZoom, {
  fit = false,
  announce = true,
  anchorClientX,
  anchorClientY,
  anchorFractionX,
  anchorFractionY,
} = {}) {
  const bounds = elements.scroll.getBoundingClientRect();
  const localX = Number.isFinite(anchorClientX)
    ? anchorClientX - bounds.left
    : elements.scroll.clientWidth / 2;
  const localY = Number.isFinite(anchorClientY)
    ? anchorClientY - bounds.top
    : elements.scroll.clientHeight / 2;
  const fractionX = Number.isFinite(anchorFractionX)
    ? anchorFractionX
    : (elements.scroll.scrollLeft + localX) / Math.max(1, elements.scroll.scrollWidth);
  const fractionY = Number.isFinite(anchorFractionY)
    ? anchorFractionY
    : (elements.scroll.scrollTop + localY) / Math.max(1, elements.scroll.scrollHeight);

  zoom = clampZoom(nextZoom);
  fitMode = fit;
  elements.canvas.style.width = `${Math.round(canvasBaseWidth * zoom)}px`;
  elements.scroll.scrollLeft = fractionX * elements.scroll.scrollWidth - localX;
  elements.scroll.scrollTop = fractionY * elements.scroll.scrollHeight - localY;
  updateZoomControls();
  if (announce) elements.status.textContent = `Deployment map zoom ${Math.round(zoom * 100)} percent.`;
}

function settleFittedZoom() {
  window.requestAnimationFrame(() => {
    if (!fitMode) return;
    const fittedZoom = fitZoomLevel();
    if (Math.abs(fittedZoom - zoom) > .001) {
      setZoom(fittedZoom, { fit: true, announce: false });
    }
    centreViewportOnPieces();
  });
}

function refreshZoomForViewport({ initial = false } = {}) {
  canvasBaseWidth = Math.max(MIN_CANVAS_WIDTH, elements.scroll.clientWidth - 2);
  if (fitMode) {
    setZoom(fitZoomLevel(), { fit: true, announce: false });
    settleFittedZoom();
  } else {
    setZoom(zoom, { fit: false, announce: false });
  }
  if (initial) updateZoomControls();
}

function fitDeploymentMap({ announce = true } = {}) {
  setZoom(fitZoomLevel(), { fit: true, announce });
  settleFittedZoom();
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

function boardCoordinates(event, bounds = elements.zone.getBoundingClientRect()) {
  return {
    x: (event.clientX - bounds.left) / Math.max(1, bounds.width) * ZONE_WIDTH_CM,
    y: (event.clientY - bounds.top) / Math.max(1, bounds.height) * ZONE_DEPTH_CM,
  };
}

function boundedBoardCoordinates(event, bounds) {
  return clampDeploymentPosition(boardCoordinates(event, bounds), 0);
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

function latestPointerSample(event) {
  const samples = event.getCoalescedEvents?.();
  return samples?.length ? samples[samples.length - 1] : event;
}

function pieceDragDelta(activeDrag, event) {
  const pointer = boardCoordinates(event, activeDrag.bounds);
  return clampDeploymentDelta(activeDrag.startPieces, {
    x: pointer.x - activeDrag.start.x,
    y: pointer.y - activeDrag.start.y,
  });
}

function renderPieceDrag(activeDrag) {
  const delta = activeDrag.pendingDelta ?? { x: 0, y: 0 };
  const xPixels = delta.x / ZONE_WIDTH_CM * activeDrag.bounds.width;
  const yPixels = delta.y / ZONE_DEPTH_CM * activeDrag.bounds.height;
  for (const piece of activeDrag.pieces) {
    const marker = markerElementsById.get(piece.id);
    if (marker) marker.style.transform = `translate3d(${xPixels}px, ${yPixels}px, 0)`;
  }
}

function scheduleDragFrame(activeDrag) {
  if (activeDrag.frame) return;
  activeDrag.frame = window.requestAnimationFrame(() => {
    activeDrag.frame = 0;
    if (drag !== activeDrag) return;
    if (activeDrag.type === "marquee") renderMarquee(activeDrag.start, activeDrag.current);
    else renderPieceDrag(activeDrag);
  });
}

function clearPieceDragVisuals(activeDrag) {
  for (const piece of activeDrag.pieces) {
    const marker = markerElementsById.get(piece.id);
    marker?.classList.remove("is-dragging");
    marker?.style.removeProperty("transform");
  }
}

function commitPieceDrag(activeDrag, delta) {
  for (const piece of activeDrag.pieces) {
    const origin = activeDrag.origins.get(piece.id);
    piece.x = origin.x + delta.x;
    piece.y = origin.y + delta.y;
    applyPiecePosition(markerElementsById.get(piece.id), piece);
  }
}

function cancelDragForViewportGesture() {
  if (!drag) return;
  const activeDrag = drag;
  if (activeDrag.frame) window.cancelAnimationFrame(activeDrag.frame);
  if (activeDrag.capture.hasPointerCapture?.(activeDrag.pointerId)) {
    activeDrag.capture.releasePointerCapture(activeDrag.pointerId);
  }
  if (activeDrag.type === "marquee") {
    elements.marquee.hidden = true;
    selectedPieceIds = activeDrag.initialSelection;
    renderSelection();
  } else {
    clearPieceDragVisuals(activeDrag);
  }
  drag = null;
}

function touchPoint(event) {
  return { x: event.clientX, y: event.clientY };
}

function touchPair() {
  return [...touchPoints.values()].slice(0, 2);
}

function pairDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pairMidpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function beginPinchGesture(event) {
  const [first, second] = touchPair();
  if (!first || !second) return;
  cancelDragForViewportGesture();
  const midpoint = pairMidpoint(first, second);
  const bounds = elements.scroll.getBoundingClientRect();
  const localX = midpoint.x - bounds.left;
  const localY = midpoint.y - bounds.top;
  touchGesture = {
    type: "pinch",
    startDistance: Math.max(1, pairDistance(first, second)),
    startZoom: zoom,
    anchorFractionX: (elements.scroll.scrollLeft + localX) / Math.max(1, elements.scroll.scrollWidth),
    anchorFractionY: (elements.scroll.scrollTop + localY) / Math.max(1, elements.scroll.scrollHeight),
  };
  fitMode = false;
  event.preventDefault();
  event.stopPropagation();
}

elements.scroll.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") return;
  touchPoints.set(event.pointerId, touchPoint(event));
  if (suppressTouchGestureUntilRelease) {
    event.preventDefault();
    return;
  }
  if (touchPoints.size >= 2) {
    beginPinchGesture(event);
    return;
  }
  touchGesture = {
    type: "pending-pan",
    pointerId: event.pointerId,
    startsOnPiece: Boolean(event.target.closest(".deployment-piece")),
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: elements.scroll.scrollLeft,
    scrollTop: elements.scroll.scrollTop,
  };
}, true);

elements.scroll.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "touch" || !touchPoints.has(event.pointerId)) return;
  touchPoints.set(event.pointerId, touchPoint(event));
  if (suppressTouchGestureUntilRelease) {
    event.preventDefault();
    return;
  }
  if (touchPoints.size >= 2) {
    if (touchGesture?.type !== "pinch") beginPinchGesture(event);
    const [first, second] = touchPair();
    if (!first || !second || touchGesture?.type !== "pinch") return;
    const midpoint = pairMidpoint(first, second);
    const scale = pairDistance(first, second) / touchGesture.startDistance;
    setZoom(touchGesture.startZoom * scale, {
      fit: false,
      announce: false,
      anchorClientX: midpoint.x,
      anchorClientY: midpoint.y,
      anchorFractionX: touchGesture.anchorFractionX,
      anchorFractionY: touchGesture.anchorFractionY,
    });
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (touchGesture?.pointerId !== event.pointerId || touchGesture.startsOnPiece) return;
  touchGesture.type = "pan";
  elements.scroll.scrollLeft = touchGesture.scrollLeft - (event.clientX - touchGesture.startX);
  elements.scroll.scrollTop = touchGesture.scrollTop - (event.clientY - touchGesture.startY);
  event.preventDefault();
  event.stopPropagation();
}, true);

function finishTouchGesture(event) {
  if (event.pointerType !== "touch") return;
  const wasPinching = touchGesture?.type === "pinch";
  touchPoints.delete(event.pointerId);
  if (wasPinching && touchPoints.size < 2) {
    elements.status.textContent = `Deployment map zoom ${Math.round(zoom * 100)} percent.`;
    suppressTouchGestureUntilRelease = touchPoints.size > 0;
    touchGesture = null;
  } else if (touchGesture?.pointerId === event.pointerId) {
    touchGesture = null;
  }
  if (touchPoints.size === 0) suppressTouchGestureUntilRelease = false;
}

elements.scroll.addEventListener("pointerup", finishTouchGesture, true);
elements.scroll.addEventListener("pointercancel", finishTouchGesture, true);

elements.zone.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const marker = event.target.closest(".deployment-piece");
  const piece = marker && piecesById.get(marker.dataset.pieceId);
  const additive = event.shiftKey || event.ctrlKey || event.metaKey;

  if (!piece) {
    if (event.pointerType === "touch") return;
    event.preventDefault();
    const bounds = elements.zone.getBoundingClientRect();
    const start = boundedBoardCoordinates(event, bounds);
    const initialSelection = additive ? new Set(selectedPieceIds) : new Set();
    if (!additive) clearSelection();
    drag = {
      type: "marquee",
      pointerId: event.pointerId,
      capture: elements.zone,
      start,
      current: start,
      initialSelection,
      bounds,
      frame: 0,
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
  const bounds = elements.zone.getBoundingClientRect();
  const pointer = boardCoordinates(event, bounds);
  drag = {
    type: "pieces",
    pointerId: event.pointerId,
    capture: marker,
    start: pointer,
    pieces: selectedPieces,
    origins: new Map(selectedPieces.map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }])),
    startPieces: selectedPieces.map((candidate) => ({ ...candidate })),
    bounds,
    pendingDelta: { x: 0, y: 0 },
    frame: 0,
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
  const sample = latestPointerSample(event);
  if (drag.type === "marquee") {
    drag.current = boundedBoardCoordinates(sample, drag.bounds);
    scheduleDragFrame(drag);
    return;
  }

  const delta = pieceDragDelta(drag, sample);
  drag.pendingDelta = delta;
  drag.moved ||= Math.abs(delta.x) > .01 || Math.abs(delta.y) > .01;
  scheduleDragFrame(drag);
});

function endDrag(event, cancelled = false) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const activeDrag = drag;
  if (activeDrag.frame) window.cancelAnimationFrame(activeDrag.frame);
  if (activeDrag.capture.hasPointerCapture?.(event.pointerId)) activeDrag.capture.releasePointerCapture(event.pointerId);

  if (activeDrag.type === "marquee") {
    elements.marquee.hidden = true;
    if (cancelled) {
      selectedPieceIds = activeDrag.initialSelection;
    } else {
      activeDrag.current = boundedBoardCoordinates(latestPointerSample(event), activeDrag.bounds);
      const moved = Math.abs(activeDrag.current.x - activeDrag.start.x) > .25 || Math.abs(activeDrag.current.y - activeDrag.start.y) > .25;
      selectedPieceIds = new Set(activeDrag.initialSelection);
      if (moved) {
        for (const piece of deploymentPiecesInRect(plan.pieces, {
          x1: activeDrag.start.x,
          y1: activeDrag.start.y,
          x2: activeDrag.current.x,
          y2: activeDrag.current.y,
        })) selectedPieceIds.add(piece.id);
      }
    }
    renderSelection();
    elements.status.textContent = `${selectedPieceIds.size} markers selected.`;
    drag = null;
    return;
  }

  const finalDelta = cancelled ? { x: 0, y: 0 } : pieceDragDelta(activeDrag, latestPointerSample(event));
  if (!cancelled) commitPieceDrag(activeDrag, finalDelta);
  clearPieceDragVisuals(activeDrag);
  if (cancelled) elements.status.textContent = "Move cancelled.";
  else if (activeDrag.pieces.length > 1) elements.status.textContent = `Moved ${activeDrag.pieces.length} selected markers.`;
  else announce(activeDrag.pieces[0]);
  drag = null;
  if (!cancelled) persistDeployment();
}

elements.zone.addEventListener("pointerup", endDrag);
elements.zone.addEventListener("pointercancel", (event) => endDrag(event, true));

elements.clearSelection.addEventListener("click", () => {
  clearSelection();
  elements.status.textContent = "Selection cleared.";
});

elements.zoomOut.addEventListener("click", () => {
  setZoom(zoom / ZOOM_FACTOR, { fit: false });
});

elements.zoomIn.addEventListener("click", () => {
  setZoom(zoom * ZOOM_FACTOR, { fit: false });
});

elements.zoomFit.addEventListener("click", () => fitDeploymentMap());

elements.scroll.addEventListener("wheel", (event) => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  setZoom(zoom * Math.exp(-event.deltaY * .002), {
    fit: false,
    anchorClientX: event.clientX,
    anchorClientY: event.clientY,
  });
}, { passive: false });

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
  resizeTimer = window.setTimeout(() => {
    refreshZoomForViewport();
    centreViewportOnPieces();
  }, 80);
});

refreshZoomForViewport({ initial: true });
loadCurrentPlan(true);

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    // Deployment planning remains usable online when offline caching is unavailable.
  });
}

globalThis.__FB_DEPLOYMENT__ = Object.freeze({
  getArmy: () => structuredClone(army),
  getPlan: () => structuredClone(plan),
  getSelection: () => [...selectedPieceIds],
  getZoom: () => zoom,
  getZoomBounds: () => ({ minimum: MIN_ZOOM, maximum: MAX_ZOOM, fit: fitZoomLevel() }),
  setZoom: (value) => setZoom(value, { fit: false }),
  fit: () => fitDeploymentMap({ announce: false }),
  reset: () => loadCurrentPlan(false),
});
