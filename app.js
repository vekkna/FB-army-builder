import {
  PROFILES,
  PROFILE_BY_NAME,
  RELICS,
  RELIC_BY_NAME,
  STAT_KEYS,
  STRATEGIES,
  STRATEGY_BY_NAME,
  TRAITS,
  TRAIT_BY_NAME,
  WORKBOOK_META,
} from "./data.js";
import {
  calculateArmy,
  calculateUnit,
  canTakeRelic,
  describeOption,
  formatSigned,
  getTraitAvailability,
  getTraitNames,
  isHeroProfile,
  traitsConflict,
  validateUnit,
} from "./calculator.js";
import {
  buildUnitCardData,
  createUnitCardsPdf,
  unitCardsFileName,
} from "./unit-cards.js";
import {
  DEPLOYMENT_STORAGE_KEY,
  sanitiseDeploymentData,
} from "./deployment.js";

const STORAGE_KEY = "fantastic-battles-muster:v1";
const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);
const integer = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 });

const elements = {
  armyName: byId("army-name"),
  pointsLimit: byId("points-limit"),
  pointsMeter: byId("points-meter"),
  pointsTotal: byId("points-total"),
  pointsTarget: byId("points-target"),
  meterFill: byId("meter-fill"),
  basesTotal: byId("bases-total"),
  breakPoint: byId("break-point"),
  armyStatus: byId("army-status"),
  statusLabel: byId("status-label"),
  profileOptions: byId("profile-options"),
  profileSelectionNote: byId("profile-selection-note"),
  identitySection: byId("identity-section"),
  traitsSection: byId("traits-section"),
  unitName: byId("unit-name"),
  unitBases: byId("unit-bases"),
  racialTraitButton: byId("racial-trait-button"),
  additionalTraits: byId("additional-traits"),
  heroTraitNote: byId("hero-trait-note"),
  traitControls: byId("trait-controls"),
  traitCount: byId("trait-count"),
  relicField: byId("relic-field"),
  relicHelp: byId("relic-help"),
  unitRelic: byId("unit-relic"),
  unitPreview: byId("unit-preview"),
  saveUnitButton: byId("save-unit-button"),
  saveUnitIcon: byId("save-unit-icon"),
  saveUnitLabel: byId("save-unit-label"),
  saveUnitCost: byId("save-unit-cost"),
  editorMode: byId("editor-mode"),
  forgeTitle: byId("forge-title"),
  cancelEditButton: byId("cancel-edit-button"),
  strategyOptions: byId("strategy-options"),
  strategyCount: byId("strategy-count"),
  checksPanel: byId("checks-panel"),
  checksToggle: byId("checks-toggle"),
  checksList: byId("checks-list"),
  checksSummary: byId("checks-summary"),
  emptyRoster: byId("empty-roster"),
  rosterList: byId("roster-list"),
  rosterFooter: byId("roster-footer"),
  unitCount: byId("unit-count"),
  rosterPoints: byId("roster-points"),
  footerUnits: byId("footer-units"),
  footerUnitPoints: byId("footer-unit-points"),
  footerStrategyPoints: byId("footer-strategy-points"),
  footerTotal: byId("footer-total"),
  traitDialog: byId("trait-dialog"),
  traitDialogKicker: byId("trait-dialog-kicker"),
  traitSearch: byId("trait-search"),
  traitResults: byId("trait-results"),
  traitResultsCount: byId("trait-results-count"),
  clearTraitButton: byId("clear-trait-button"),
  toast: byId("toast"),
  importFile: byId("import-file"),
  unitCardsButton: byId("unit-cards-button"),
};

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `unit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyDraft() {
  return {
    id: makeId(),
    name: "",
    profile: "",
    bases: 1,
    racialTrait: "",
    traits: [],
    relic: "",
  };
}

function defaultState() {
  return {
    version: 1,
    armyName: "",
    pointsLimit: 1000,
    strategies: [],
    units: [],
  };
}

function positiveInteger(raw, fallback, maximum) {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(1, Math.round(numeric)));
}

function nonnegativeInteger(raw, fallback, maximum) {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(0, Math.round(numeric)));
}

function sanitiseUnit(raw = {}) {
  const profile = PROFILE_BY_NAME.has(raw.profile) ? raw.profile : "";
  const rawRacialTrait = TRAIT_BY_NAME.has(raw.racialTrait) ? raw.racialTrait : "";
  const rawAdditionalTraits = (Array.isArray(raw.traits) ? raw.traits : [])
    .filter((name) => TRAIT_BY_NAME.has(name))
    .slice(0, WORKBOOK_META.maxAdditionalTraits);
  const names = [rawRacialTrait, ...rawAdditionalTraits].filter(Boolean);
  const accepted = [];
  for (const name of names) {
    if (accepted.length >= WORKBOOK_META.maxTraits) break;
    if (!accepted.includes(name) && !accepted.some((selected) => traitsConflict(name, selected))) accepted.push(name);
  }
  const hero = isHeroProfile(profile);
  const racialTrait = !hero && rawRacialTrait && accepted.includes(rawRacialTrait) ? rawRacialTrait : "";
  const traits = hero ? [] : rawAdditionalTraits.filter((name) => accepted.includes(name) && name !== racialTrait);
  const unit = {
    id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
    name: typeof raw.name === "string" ? raw.name.slice(0, 60) : "",
    profile,
    bases: nonnegativeInteger(raw.bases, 1, 999),
    racialTrait,
    traits: traits.slice(0, WORKBOOK_META.maxAdditionalTraits),
    relic: RELIC_BY_NAME.has(raw.relic) ? raw.relic : "",
  };
  if (!canTakeRelic(unit)) unit.relic = "";
  return unit;
}

function sanitiseState(raw = {}) {
  const units = Array.isArray(raw.units) ? raw.units.slice(0, WORKBOOK_META.maxUnits).map(sanitiseUnit) : [];
  const ids = new Set();
  for (const unit of units) {
    if (ids.has(unit.id)) unit.id = makeId();
    ids.add(unit.id);
  }
  const strategies = [];
  for (const name of Array.isArray(raw.strategies) ? raw.strategies : []) {
    if (STRATEGY_BY_NAME.has(name) && !strategies.includes(name) && strategies.length < WORKBOOK_META.maxStrategies) {
      strategies.push(name);
    }
  }
  return {
    version: 1,
    armyName: typeof raw.armyName === "string" ? raw.armyName.slice(0, 80) : "",
    pointsLimit: positiveInteger(raw.pointsLimit, 1000, 1000000),
    strategies,
    units,
  };
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? sanitiseState(JSON.parse(stored)) : defaultState();
  } catch {
    return defaultState();
  }
}

let state = loadState();
let draft = emptyDraft();
let editingId = "";
let traitTarget = null;
let toastTimer = null;
let unitDrag = { sourceId: "", targetId: "", position: "before" };
let pointerDrag = null;

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The app remains usable when storage is blocked.
  }
}

function storedDeployment() {
  try {
    return sanitiseDeploymentData(JSON.parse(localStorage.getItem(DEPLOYMENT_STORAGE_KEY) || "{}"));
  } catch {
    return sanitiseDeploymentData();
  }
}

function replaceStoredDeployment(raw) {
  try {
    if (raw && typeof raw === "object") {
      localStorage.setItem(DEPLOYMENT_STORAGE_KEY, JSON.stringify(sanitiseDeploymentData(raw)));
    } else {
      localStorage.removeItem(DEPLOYMENT_STORAGE_KEY);
    }
  } catch {
    // Saving and loading the muster still works when storage is unavailable.
  }
}

function showToast(message, action = null) {
  clearTimeout(toastTimer);
  elements.toast.replaceChildren();
  const copy = document.createElement("span");
  copy.textContent = message;
  elements.toast.append(copy);
  if (action?.label && typeof action.callback === "function") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      clearTimeout(toastTimer);
      elements.toast.classList.remove("is-visible");
      action.callback();
    }, { once: true });
    elements.toast.append(button);
  }
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

function plural(number, singular, pluralForm = `${singular}s`) {
  return `${integer.format(number)} ${number === 1 ? singular : pluralForm}`;
}

function displayedUnitPoints(stats) {
  return stats.bases === 0 ? stats.pointsPerBase : stats.total;
}

function displayedUnitPointsLabel(stats) {
  return stats.bases === 0 ? "summon cost" : "unit total";
}

function statMarkup(stats, className = "") {
  return `<div class="${className}">${STAT_KEYS.map(([key, , short]) => `
    <div class="stat-cell">
      <span>${short}</span>
      <strong>${integer.format(Number(stats[key]) || 0)}</strong>
    </div>`).join("")}</div>`;
}

function renderProfiles() {
  const groups = [
    ["Characters", PROFILES.slice(0, 5)],
    ["Companies", PROFILES.slice(5)],
  ];
  elements.profileOptions.innerHTML = groups.map(([label, profiles]) => `
    <div class="profile-group">
      <span class="profile-group-label">${label}</span>
      <div class="profile-grid">
        ${profiles.map((profile) => `
          <button class="profile-option${draft.profile === profile.name ? " is-selected" : ""}" type="button"
            data-profile="${escapeHTML(profile.name)}" aria-pressed="${draft.profile === profile.name}"
            title="${escapeHTML(describeOption(profile))}">
            <strong>${escapeHTML(profile.name)}</strong>
            <span>${profile.points} pts</span>
          </button>`).join("")}
      </div>
    </div>`).join("");
}

function pickerMarkup(label, value, slotLabel) {
  const item = TRAIT_BY_NAME.get(value);
  return `
    <span class="picker-copy">
      <small>${slotLabel}</small>
      <strong>${escapeHTML(value || label)}</strong>
      ${item ? `<em>${escapeHTML(describeOption(item))}</em>` : ""}
    </span>
    <span aria-hidden="true">›</span>`;
}

function renderRelicOptions() {
  elements.unitRelic.innerHTML = `<option value="">No relic</option>${RELICS.map((relic) => {
    const detail = describeOption(relic, { includePoints: false });
    const suffix = detail ? ` · ${detail}` : "";
    return `<option value="${escapeHTML(relic.name)}">${escapeHTML(relic.name)} (+${relic.points} pts${escapeHTML(suffix)})</option>`;
  }).join("")}`;
  elements.unitRelic.value = draft.relic;
}

function renderDraft() {
  const hasProfile = PROFILE_BY_NAME.has(draft.profile);
  const hero = isHeroProfile(draft.profile);
  const traitNames = getTraitNames(draft);
  const stats = calculateUnit(draft);
  const issues = validateUnit(draft);
  const rosterFull = !editingId && state.units.length >= WORKBOOK_META.maxUnits;

  renderProfiles();
  elements.profileSelectionNote.textContent = hasProfile ? `${PROFILE_BY_NAME.get(draft.profile).points} pts` : "Required";
  elements.identitySection.classList.toggle("is-disabled", !hasProfile);
  elements.traitsSection.classList.toggle("is-disabled", !hasProfile);
  elements.unitName.disabled = !hasProfile;
  elements.unitBases.disabled = !hasProfile;
  elements.unitName.value = draft.name;
  elements.unitBases.value = draft.bases;
  elements.heroTraitNote.hidden = !hero;
  elements.traitControls.hidden = hero;
  elements.traitCount.textContent = hero ? "Traits unavailable" : `${traitNames.length} / ${WORKBOOK_META.maxTraits} traits`;

  elements.racialTraitButton.disabled = !hasProfile || hero;
  elements.racialTraitButton.classList.toggle("is-filled", Boolean(draft.racialTrait));
  elements.racialTraitButton.innerHTML = pickerMarkup("Choose a trait", draft.racialTrait, "Racial");

  elements.additionalTraits.innerHTML = Array.from({ length: WORKBOOK_META.maxAdditionalTraits }, (_, index) => {
    const name = draft.traits[index] ?? "";
    return `<button class="trait-slot${name ? " is-filled" : ""}" type="button" data-trait-slot="${index}" ${!hasProfile || hero ? "disabled" : ""}>
      ${pickerMarkup(`Choose trait ${index + 1}`, name, `Trait ${index + 1}`)}
    </button>`;
  }).join("");

  const relicAllowed = canTakeRelic(draft);
  elements.unitRelic.disabled = !relicAllowed;
  elements.relicField.classList.toggle("is-disabled", !relicAllowed);
  elements.relicHelp.textContent = relicAllowed ? "Optional" : "Requires a character";
  renderRelicOptions();

  if (!hasProfile) {
    elements.unitPreview.innerHTML = `<div class="preview-placeholder"><span class="placeholder-crest" aria-hidden="true">◇</span><p>Choose a profile to see its final stats and cost.</p></div>`;
  } else {
    const title = draft.name.trim() || draft.profile;
    elements.unitPreview.innerHTML = `
      <div class="preview-top">
        <div class="preview-title"><small>${escapeHTML(draft.profile)} · ${plural(stats.bases, "base")}</small><strong>${escapeHTML(title)}</strong></div>
        <div class="preview-cost"><strong>${integer.format(displayedUnitPoints(stats))} pts</strong><small>${displayedUnitPointsLabel(stats)}</small></div>
      </div>
      ${statMarkup(stats, "stat-ribbon")}
      ${issues.length ? `<div class="preview-error">${escapeHTML(issues[0].message)}</div>` : ""}`;
  }

  elements.editorMode.textContent = editingId ? "Editing unit" : "New unit";
  elements.forgeTitle.textContent = editingId ? (draft.name.trim() || draft.profile || "Edit company") : "Build a company";
  elements.cancelEditButton.hidden = !editingId;
  elements.saveUnitIcon.textContent = editingId ? "✓" : "+";
  elements.saveUnitLabel.textContent = editingId ? "Save unit changes" : "Add unit to army";
  elements.saveUnitCost.textContent = hasProfile ? `${integer.format(displayedUnitPoints(stats))} pts` : "—";
  elements.saveUnitCost.hidden = !hasProfile;
  elements.saveUnitButton.disabled = !hasProfile || issues.length > 0 || rosterFull;
  elements.saveUnitButton.title = rosterFull ? `The workbook supports ${WORKBOOK_META.maxUnits} unit entries.` : "";
}

function renderHeader(army) {
  const limit = Number(state.pointsLimit) || 1;
  const used = army.total / limit;
  const bases = state.units.reduce((sum, unit) => sum + (Number(unit.bases) || 0), 0);
  elements.armyName.value = state.armyName;
  elements.pointsLimit.value = state.pointsLimit;
  elements.pointsTotal.textContent = integer.format(army.total);
  elements.pointsTarget.textContent = integer.format(limit);
  elements.basesTotal.textContent = integer.format(bases);
  elements.breakPoint.textContent = army.breakPoint || "—";
  elements.meterFill.style.width = `${Math.min(100, Math.max(0, used * 100))}%`;
  elements.pointsMeter.classList.toggle("is-near", used >= .9 && used <= 1);
  elements.pointsMeter.classList.toggle("is-over", used > 1);

  elements.armyStatus.className = "status-pill";
  if (!state.units.length) {
    elements.armyStatus.classList.add("is-empty");
    elements.statusLabel.textContent = "Ready to muster";
  } else if (army.errors.length) {
    elements.armyStatus.classList.add("is-error");
    elements.statusLabel.textContent = plural(army.errors.length, "error");
  } else if (army.warnings.length) {
    elements.armyStatus.classList.add("is-warning");
    elements.statusLabel.textContent = "Check your command";
  } else {
    elements.statusLabel.textContent = "Army legal";
  }
}

function renderStrategies() {
  elements.strategyCount.textContent = `${state.strategies.length} / ${WORKBOOK_META.maxStrategies}`;
  elements.strategyOptions.innerHTML = STRATEGIES.map((strategy) => {
    const selected = state.strategies.includes(strategy.name);
    const unavailable = !selected && state.strategies.length >= WORKBOOK_META.maxStrategies;
    const title = unavailable ? "Remove a selected strategy before adding another" : `${selected ? "Remove" : "Add"} ${strategy.name}`;
    return `<button class="strategy-option${selected ? " is-selected" : ""}${unavailable ? " is-unavailable" : ""}" type="button"
      data-strategy="${escapeHTML(strategy.name)}" aria-pressed="${selected}" ${unavailable ? 'disabled aria-disabled="true"' : ""} title="${escapeHTML(title)}">
      <strong>${escapeHTML(strategy.name)}</strong>
      <span>${selected ? "✓ " : "+ "}${strategy.points} pts</span>
    </button>`;
  }).join("");
}

function upgradeChips(unit) {
  const chips = [];
  if (unit.racialTrait) chips.push(`<span class="upgrade-chip is-racial"><span class="upgrade-kind">Racial · </span>${escapeHTML(unit.racialTrait)}</span>`);
  for (const trait of unit.traits ?? []) chips.push(`<span class="upgrade-chip">${escapeHTML(trait)}</span>`);
  if (unit.relic) chips.push(`<span class="upgrade-chip is-relic"><span class="upgrade-kind">Relic · </span>${escapeHTML(unit.relic)}</span>`);
  return chips.length ? chips.join("") : `<span class="upgrade-chip">No traits or relic</span>`;
}

function renderRoster(army) {
  const count = state.units.length;
  elements.rosterList.classList.toggle("is-dense", count > 9);
  elements.unitCardsButton.disabled = count === 0;
  elements.unitCardsButton.title = count
    ? `Download ${plural(count, "unit card")} as a print-ready PDF`
    : "Add a unit before creating cards";
  elements.emptyRoster.hidden = count > 0;
  elements.rosterFooter.hidden = count === 0;
  elements.unitCount.textContent = plural(count, "unit");
  elements.rosterPoints.textContent = `${integer.format(army.total)} pts`;
  elements.footerUnits.textContent = integer.format(count);
  elements.footerUnitPoints.textContent = `${integer.format(army.unitPoints)} pts`;
  elements.footerStrategyPoints.textContent = `${integer.format(army.strategyPoints)} pts`;
  elements.footerTotal.textContent = `${integer.format(army.total)} pts`;

  elements.rosterList.innerHTML = army.units.map(({ unit, stats }) => {
    const title = unit.name.trim() || unit.profile;
    return `<article class="unit-card${editingId === unit.id ? " is-editing" : ""}" data-unit-id="${escapeHTML(unit.id)}">
      <div class="unit-card-heading">
        <div class="unit-card-title">
          <h3>${escapeHTML(title)}</h3>
          <div class="roster-unit-meta"><span>${escapeHTML(unit.profile)}</span><span>${plural(stats.bases, "base")}</span></div>
        </div>
        <div class="unit-card-cost"><strong>${integer.format(displayedUnitPoints(stats))} pts</strong><small>${displayedUnitPointsLabel(stats)}</small></div>
      </div>
      ${statMarkup(stats, "unit-card-stats")}
      <div class="upgrade-row">${upgradeChips(unit)}</div>
      <div class="unit-card-actions" aria-label="Actions for ${escapeHTML(title)}">
        <span class="unit-drag-handle" data-drag-handle role="button" tabindex="0"
          aria-label="Reorder ${escapeHTML(title)}. Drag or use the arrow keys." title="Drag to reorder; use arrow keys for precise movement">
          <span aria-hidden="true">⠿</span><span>Drag</span>
        </span>
        <button class="card-action" type="button" data-action="duplicate">⧉ Duplicate</button>
        <button class="card-action" type="button" data-action="edit">✎ Edit</button>
        <button class="card-action delete" type="button" data-action="delete">Remove</button>
      </div>
    </article>`;
  }).join("");
}

function renderChecks(army) {
  elements.checksPanel.hidden = army.issues.length === 0;
  if (!army.issues.length) return;
  elements.checksPanel.classList.toggle("has-errors", army.errors.length > 0);
  elements.checksSummary.textContent = army.errors.length
    ? plural(army.errors.length, "error")
    : plural(army.warnings.length, "advisory", "advisories");
  elements.checksList.innerHTML = army.issues.map((issue) => `<li>${escapeHTML(issue.message)}</li>`).join("");
}

function renderAll() {
  const army = calculateArmy(state);
  renderHeader(army);
  renderStrategies();
  renderChecks(army);
  renderRoster(army);
  renderDraft();
  persist();
  return army;
}

function resetDraft() {
  draft = emptyDraft();
  editingId = "";
  renderDraft();
  renderRoster(calculateArmy(state));
}

function selectProfile(profile) {
  if (!PROFILE_BY_NAME.has(profile)) return;
  const hadTraits = getTraitNames(draft).length > 0;
  draft.profile = profile;
  if (isHeroProfile(profile)) {
    draft.racialTrait = "";
    draft.traits = [];
    if (hadTraits) showToast("Traits cleared: character profiles cannot take them.");
  }
  if (!canTakeRelic(draft)) draft.relic = "";
  renderDraft();
}

function setBases(next) {
  draft.bases = nonnegativeInteger(next, nonnegativeInteger(draft.bases, 1, 999), 999);
  renderDraft();
}

function saveDraft() {
  const issues = validateUnit(draft);
  if (issues.length) {
    showToast(issues[0].message);
    return;
  }
  const unit = sanitiseUnit({ ...draft, id: editingId || makeId(), name: draft.name.trim() });
  if (editingId) {
    const index = state.units.findIndex(({ id }) => id === editingId);
    if (index >= 0) state.units[index] = unit;
    showToast(`${unit.name || unit.profile} updated.`);
  } else {
    if (state.units.length >= WORKBOOK_META.maxUnits) {
      showToast(`The source workbook supports ${WORKBOOK_META.maxUnits} unit entries.`);
      return;
    }
    state.units.push(unit);
    showToast(`${unit.name || unit.profile} added to the army.`);
  }
  resetDraft();
  renderAll();
}

function editUnit(id) {
  const unit = state.units.find((entry) => entry.id === id);
  if (!unit) return;
  draft = structuredClone(unit);
  editingId = id;
  renderAll();
  $(".forge-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearUnitDragStyles() {
  elements.rosterList.classList.remove("is-reordering");
  elements.rosterList.querySelectorAll(".is-dragging, .is-drop-before, .is-drop-after").forEach((card) => {
    card.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
  });
}

function resetUnitDrag() {
  clearUnitDragStyles();
  unitDrag = { sourceId: "", targetId: "", position: "before" };
  pointerDrag = null;
}

function markUnitDropTarget(card, clientY) {
  clearUnitDragStyles();
  const sourceCard = Array.from(elements.rosterList.querySelectorAll("[data-unit-id]"))
    .find((item) => item.dataset.unitId === unitDrag.sourceId);
  sourceCard?.classList.add("is-dragging");
  if (!card || card.dataset.unitId === unitDrag.sourceId) {
    unitDrag.targetId = "";
    return;
  }
  const bounds = card.getBoundingClientRect();
  const position = clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  unitDrag.targetId = card.dataset.unitId;
  unitDrag.position = position;
  card.classList.add(position === "before" ? "is-drop-before" : "is-drop-after");
}

function commitUnitDrop() {
  const { sourceId, targetId, position } = unitDrag;
  const sourceIndex = state.units.findIndex((unit) => unit.id === sourceId);
  if (sourceIndex < 0 || !targetId || sourceId === targetId) {
    resetUnitDrag();
    return;
  }
  const [movedUnit] = state.units.splice(sourceIndex, 1);
  const targetIndex = state.units.findIndex((unit) => unit.id === targetId);
  if (targetIndex < 0) {
    state.units.splice(sourceIndex, 0, movedUnit);
    resetUnitDrag();
    return;
  }
  state.units.splice(targetIndex + (position === "after" ? 1 : 0), 0, movedUnit);
  resetUnitDrag();
  renderAll();
  showToast(`${movedUnit.name || movedUnit.profile} moved.`);
}

function moveUnitWithKeyboard(id, direction) {
  const index = state.units.findIndex((unit) => unit.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.units.length) return;
  [state.units[index], state.units[target]] = [state.units[target], state.units[index]];
  const unit = state.units[target];
  renderAll();
  showToast(`${unit.name || unit.profile} moved.`);
  requestAnimationFrame(() => {
    const card = Array.from(elements.rosterList.querySelectorAll("[data-unit-id]"))
      .find((item) => item.dataset.unitId === id);
    card?.querySelector("[data-drag-handle]")?.focus();
  });
}

function rosterAction(id, action) {
  const index = state.units.findIndex((unit) => unit.id === id);
  if (index < 0) return;
  const unit = state.units[index];
  if (action === "edit") {
    editUnit(id);
    return;
  }
  if (action === "duplicate") {
    if (state.units.length >= WORKBOOK_META.maxUnits) {
      showToast(`The source workbook supports ${WORKBOOK_META.maxUnits} unit entries.`);
      return;
    }
    state.units.splice(index + 1, 0, { ...structuredClone(unit), id: makeId() });
    showToast(`${unit.name || unit.profile} duplicated.`);
  } else if (action === "delete") {
    state.units.splice(index, 1);
    if (editingId === id) resetDraft();
    showToast(`${unit.name || unit.profile} removed.`, {
      label: "Undo",
      callback: () => {
        state.units.splice(Math.min(index, state.units.length), 0, unit);
        renderAll();
        showToast(`${unit.name || unit.profile} restored.`);
      },
    });
  }
  renderAll();
}

function openTraitPicker(kind, index = -1) {
  if (!draft.profile || isHeroProfile(draft.profile)) return;
  const current = kind === "racial" ? draft.racialTrait : (draft.traits[index] ?? "");
  traitTarget = { kind, index, current };
  elements.traitDialogKicker.textContent = kind === "racial" ? "Racial trait" : `Additional trait ${index + 1}`;
  elements.traitSearch.value = "";
  elements.clearTraitButton.hidden = !current;
  renderTraitResults();
  elements.traitDialog.showModal();
  requestAnimationFrame(() => elements.traitSearch.focus());
}

function renderTraitResults() {
  if (!traitTarget) return;
  const query = elements.traitSearch.value.trim().toLocaleLowerCase();
  const matches = TRAITS.filter((trait) => trait.name.toLocaleLowerCase().includes(query));
  let availableCount = 0;
  elements.traitResults.innerHTML = matches.map((trait) => {
    const current = trait.name === traitTarget.current;
    const availability = current
      ? { available: true, reason: "Selected" }
      : getTraitAvailability(trait.name, draft, traitTarget.current);
    if (availability.available) availableCount += 1;
    const detail = describeOption(trait, { includePoints: false }) || "No direct stat modifier";
    return `<button class="trait-result${current ? " is-selected" : ""}" type="button" data-trait-name="${escapeHTML(trait.name)}"
      ${availability.available ? "" : "disabled"}>
      <span class="trait-result-name">${current ? "✓ " : ""}${escapeHTML(trait.name)}</span>
      <span class="trait-result-detail">${escapeHTML(detail)}</span>
      ${availability.available
        ? `<span class="trait-result-points">${formatSigned(trait.points)} pts</span>`
        : `<span class="trait-result-reason">${escapeHTML(availability.reason)}</span>`}
    </button>`;
  }).join("") || `<div class="no-results">No traits match “${escapeHTML(elements.traitSearch.value)}”.</div>`;
  elements.traitResultsCount.textContent = `${matches.length} ${matches.length === 1 ? "match" : "matches"} · ${availableCount} available`;
}

function setTrait(name) {
  if (!traitTarget || !TRAIT_BY_NAME.has(name)) return;
  const availability = name === traitTarget.current
    ? { available: true }
    : getTraitAvailability(name, draft, traitTarget.current);
  if (!availability.available) return;
  if (traitTarget.kind === "racial") {
    draft.racialTrait = name;
  } else {
    const traits = [...draft.traits];
    traits[traitTarget.index] = name;
    draft.traits = traits.filter(Boolean).slice(0, WORKBOOK_META.maxAdditionalTraits);
  }
  if (!canTakeRelic(draft)) draft.relic = "";
  elements.traitDialog.close();
  traitTarget = null;
  renderDraft();
}

function clearTrait() {
  if (!traitTarget) return;
  if (traitTarget.kind === "racial") draft.racialTrait = "";
  else draft.traits = draft.traits.filter((_, index) => index !== traitTarget.index);
  if (!canTakeRelic(draft)) draft.relic = "";
  elements.traitDialog.close();
  traitTarget = null;
  renderDraft();
}

function downloadArmy() {
  const payload = {
    format: "fantastic-battles-muster",
    version: 1,
    exportedAt: new Date().toISOString(),
    army: state,
    deployment: storedDeployment(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const slug = (state.armyName || "fantastic-battles-army").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  anchor.href = url;
  anchor.download = `${slug || "fantastic-battles-army"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Army saved to a file.");
}

function downloadUnitCards() {
  if (!state.units.length) {
    showToast("Add a unit before creating cards.");
    return;
  }
  const invalidUnit = state.units.find((unit) => validateUnit(unit).length > 0);
  if (invalidUnit) {
    showToast(`Fix ${invalidUnit.name.trim() || invalidUnit.profile || "the invalid unit"} before creating cards.`);
    return;
  }

  try {
    const cards = buildUnitCardData(state.units);
    const pdf = createUnitCardsPdf(cards);
    const url = URL.createObjectURL(pdf);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = unitCardsFileName(state.armyName);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    showToast(`${plural(cards.length, "unit card")} PDF downloaded.`);
  } catch {
    showToast("The unit cards PDF could not be created.");
  }
}

async function importArmy(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const raw = parsed?.format === "fantastic-battles-muster" ? parsed.army : parsed;
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.units)) throw new Error("Not an army file");
    state = sanitiseState(raw);
    replaceStoredDeployment(parsed?.format === "fantastic-battles-muster" ? parsed.deployment : raw.deployment);
    resetDraft();
    renderAll();
    showToast(`Loaded ${plural(state.units.length, "unit")}.`);
  } catch {
    showToast("That army file could not be loaded.");
  } finally {
    elements.importFile.value = "";
  }
}

elements.armyName.addEventListener("input", () => {
  state.armyName = elements.armyName.value.slice(0, 80);
  persist();
});

elements.pointsLimit.addEventListener("change", () => {
  state.pointsLimit = positiveInteger(elements.pointsLimit.value, state.pointsLimit || 1000, 1000000);
  renderAll();
});

elements.profileOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-profile]");
  if (button) selectProfile(button.dataset.profile);
});

elements.unitName.addEventListener("input", () => {
  draft.name = elements.unitName.value.slice(0, 60);
  const stats = calculateUnit(draft);
  const title = elements.unitPreview.querySelector(".preview-title strong");
  if (title) title.textContent = draft.name.trim() || draft.profile;
  elements.forgeTitle.textContent = editingId ? (draft.name.trim() || draft.profile || "Edit company") : "Build a company";
  elements.saveUnitCost.textContent = draft.profile ? `${integer.format(displayedUnitPoints(stats))} pts` : "—";
});

elements.unitBases.addEventListener("change", () => setBases(elements.unitBases.value));
byId("bases-minus").addEventListener("click", () => setBases(Number(draft.bases) - 1));
byId("bases-plus").addEventListener("click", () => setBases(Number(draft.bases) + 1));
elements.racialTraitButton.addEventListener("click", () => openTraitPicker("racial"));
elements.additionalTraits.addEventListener("click", (event) => {
  const button = event.target.closest("[data-trait-slot]");
  if (button) openTraitPicker("additional", Number(button.dataset.traitSlot));
});
elements.unitRelic.addEventListener("change", () => {
  draft.relic = elements.unitRelic.value;
  renderDraft();
});

elements.saveUnitButton.addEventListener("click", saveDraft);
byId("reset-unit-button").addEventListener("click", resetDraft);
elements.cancelEditButton.addEventListener("click", resetDraft);

elements.strategyOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-strategy]");
  if (!button) return;
  const name = button.dataset.strategy;
  const index = state.strategies.indexOf(name);
  if (index >= 0) state.strategies.splice(index, 1);
  else if (state.strategies.length < WORKBOOK_META.maxStrategies) state.strategies.push(name);
  else {
    showToast("Choose no more than three strategies.");
    return;
  }
  renderAll();
});

elements.rosterList.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  const card = event.target.closest("[data-unit-id]");
  if (action && card) rosterAction(card.dataset.unitId, action.dataset.action);
});

elements.rosterList.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const handle = event.target.closest("[data-drag-handle]");
  const card = handle?.closest("[data-unit-id]");
  if (!card) return;
  event.preventDefault();
  unitDrag = { sourceId: card.dataset.unitId, targetId: "", position: "before" };
  pointerDrag = { pointerId: event.pointerId, handle };
  try {
    handle.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic pointer events used by tests do not own a native pointer capture.
  }
  elements.rosterList.classList.add("is-reordering");
  card.classList.add("is-dragging");
});

elements.rosterList.addEventListener("pointermove", (event) => {
  if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
  event.preventDefault();
  if (event.clientY < 70) window.scrollBy(0, -14);
  else if (event.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
  const card = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-unit-id]");
  markUnitDropTarget(card, event.clientY);
});

elements.rosterList.addEventListener("pointerup", (event) => {
  if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
  const { handle } = pointerDrag;
  if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  commitUnitDrop();
});

elements.rosterList.addEventListener("pointercancel", resetUnitDrag);

elements.rosterList.addEventListener("keydown", (event) => {
  const handle = event.target.closest("[data-drag-handle]");
  const card = handle?.closest("[data-unit-id]");
  if (!card || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  moveUnitWithKeyboard(card.dataset.unitId, event.key === "ArrowUp" ? -1 : 1);
});

elements.checksToggle.addEventListener("click", () => {
  const expanded = elements.checksToggle.getAttribute("aria-expanded") === "true";
  elements.checksToggle.setAttribute("aria-expanded", String(!expanded));
  elements.checksList.hidden = expanded;
});

elements.traitSearch.addEventListener("input", renderTraitResults);
elements.traitResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-trait-name]");
  if (button) setTrait(button.dataset.traitName);
});
elements.clearTraitButton.addEventListener("click", clearTrait);
byId("trait-dialog-close").addEventListener("click", () => elements.traitDialog.close());
elements.traitDialog.addEventListener("close", () => { traitTarget = null; });
elements.traitDialog.addEventListener("click", (event) => {
  if (event.target === elements.traitDialog) elements.traitDialog.close();
});
elements.traitDialog.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== elements.traitSearch) {
    event.preventDefault();
    elements.traitSearch.focus();
  }
});

byId("export-button").addEventListener("click", downloadArmy);
byId("import-button").addEventListener("click", () => elements.importFile.click());
elements.importFile.addEventListener("change", () => {
  const [file] = elements.importFile.files;
  if (file) importArmy(file);
});
byId("print-button").addEventListener("click", () => window.print());
elements.unitCardsButton.addEventListener("click", downloadUnitCards);
byId("new-button").addEventListener("click", () => {
  const hasWork = state.units.length
    || state.strategies.length
    || state.armyName.trim()
    || state.pointsLimit !== defaultState().pointsLimit;
  if (hasWork && !window.confirm("Have you saved your current army? Starting a new army will clear it from this device.")) return;
  state = defaultState();
  replaceStoredDeployment();
  resetDraft();
  renderAll();
  showToast("New army ready.");
});
byId("mobile-start-button").addEventListener("click", () => {
  $(".forge-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

renderAll();

// A small read-only hook makes browser smoke tests and debugging straightforward.
globalThis.__FB_MUSTER__ = Object.freeze({
  getState: () => structuredClone(state),
  getDraft: () => structuredClone(draft),
  calculateArmy: () => calculateArmy(state),
  buildUnitCardData: () => buildUnitCardData(state.units),
  createUnitCardsPdf: () => createUnitCardsPdf(buildUnitCardData(state.units)),
});
