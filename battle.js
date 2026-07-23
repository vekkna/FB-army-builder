import {
  RELIC_BY_NAME,
  SPELL_BY_NAME,
  STRATEGY_BY_NAME,
  TRAIT_BY_NAME,
} from "./data.js";
import {
  armyRosterStats,
  calculateArmy,
} from "./calculator.js";
import {
  armyFingerprint,
  battleProgressKey,
  clampCurrentResolve,
  decodeArmyPayload,
  encodeArmyPayload,
  normaliseBattleArmy,
  reconcileBattleProgress,
  unitMaxResolve,
} from "./battle-state.js";
import { createQrSvg } from "./qr-code.js";

const MUSTER_STORAGE_KEY = "fantastic-battles-muster:v1";
const LAST_BATTLE_ARMY_KEY = "fantastic-battles-battle-army:v1";
const byId = (id) => document.getElementById(id);
const integer = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 });

const elements = {
  title: byId("battle-army-name"),
  guidance: byId("battle-guidance"),
  unitCount: byId("battle-unit-count"),
  points: byId("battle-points"),
  breakPoint: byId("battle-break-point"),
  strategiesPanel: byId("battle-strategies-panel"),
  strategies: byId("battle-strategies"),
  empty: byId("battle-empty"),
  cards: byId("battle-cards"),
  reset: byId("reset-battle"),
  share: byId("share-battle"),
  ruleDialog: byId("rule-dialog"),
  ruleDialogKind: byId("rule-dialog-kind"),
  ruleDialogTitle: byId("rule-dialog-title"),
  ruleDialogMeta: byId("rule-dialog-meta"),
  ruleDialogCopy: byId("rule-dialog-copy"),
  shareDialog: byId("share-dialog"),
  shareLink: byId("share-link"),
  shareQr: byId("share-qr"),
  nativeShare: byId("native-share"),
  copyShareLink: byId("copy-share-link"),
  toast: byId("battle-toast"),
};

let army = normaliseBattleArmy({});
let calculatedArmy = calculateArmy(army);
let fingerprint = "";
let progressStorageKey = "";
let currentResolveByUnitId = Object.create(null);
let shareLinkPromise = null;
let toastTimer = null;

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function plural(number, singular, pluralForm = `${singular}s`) {
  return `${integer.format(number)} ${number === 1 ? singular : pluralForm}`;
}

function readJSON(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function hashArmyPayload() {
  const parameters = new URLSearchParams(window.location.hash.slice(1));
  return parameters.get("army") || "";
}

async function loadArmy() {
  const payload = hashArmyPayload();
  if (payload) {
    const decoded = await decodeArmyPayload(payload);
    if (!decoded) throw new TypeError("Invalid battle-card payload");
    const sharedArmy = normaliseBattleArmy(decoded);
    writeJSON(LAST_BATTLE_ARMY_KEY, sharedArmy);
    return { army: sharedArmy, source: "shared" };
  }

  const currentArmy = normaliseBattleArmy(readJSON(MUSTER_STORAGE_KEY, {}));
  if (currentArmy.units.length) {
    writeJSON(LAST_BATTLE_ARMY_KEY, currentArmy);
    return { army: currentArmy, source: "muster" };
  }

  const previousArmy = normaliseBattleArmy(readJSON(LAST_BATTLE_ARMY_KEY, {}));
  return { army: previousArmy, source: previousArmy.units.length ? "saved" : "empty" };
}

function loadResolveProgress() {
  const stored = readJSON(progressStorageKey, {});
  return reconcileBattleProgress(army, stored).currentResolve;
}

function persistResolveProgress() {
  writeJSON(progressStorageKey, {
    version: 1,
    armyFingerprint: fingerprint,
    updatedAt: new Date().toISOString(),
    currentResolve: currentResolveByUnitId,
  });
}

function resolveClass(current, maximum) {
  if (maximum <= 0) return "is-off-table";
  if (current <= 0) return "is-zero";
  if (current <= Math.ceil(maximum / 3)) return "is-low";
  if (current < maximum) return "is-damaged";
  return "is-full";
}

function ruleButton({ type, kind, name, label = name, level = 0, className = "" }) {
  return `<button class="battle-rule${className ? ` ${className}` : ""}" type="button"
    data-rule-type="${escapeHTML(type)}" data-rule-name="${escapeHTML(name)}"
    ${level ? `data-rule-level="${level}"` : ""}>
    <small>${escapeHTML(kind)}</small>${escapeHTML(label)}
  </button>`;
}

function unitRuleMarkup(unit) {
  const rules = [];
  if (unit.racialTrait && TRAIT_BY_NAME.has(unit.racialTrait)) {
    rules.push(ruleButton({
      type: "trait",
      kind: "Racial trait",
      name: unit.racialTrait,
      className: "is-racial",
    }));
  }
  for (const name of unit.traits ?? []) {
    if (TRAIT_BY_NAME.has(name)) rules.push(ruleButton({ type: "trait", kind: "Trait", name }));
  }
  for (const selection of unit.spells ?? []) {
    if (!SPELL_BY_NAME.has(selection.name)) continue;
    rules.push(ruleButton({
      type: "spell",
      kind: "Spell",
      name: selection.name,
      label: `${selection.name} · L${selection.level}`,
      level: selection.level,
      className: "is-spell",
    }));
  }
  if (unit.relic && RELIC_BY_NAME.has(unit.relic)) {
    rules.push(ruleButton({
      type: "relic",
      kind: "Relic",
      name: unit.relic,
      className: "is-relic",
    }));
  }
  return rules.length ? rules.join("") : `<p class="battle-no-rules">No traits, spells, or relic.</p>`;
}

function statMarkup(stats, profileName) {
  const statsToShow = armyRosterStats(stats, profileName);
  return `<div class="battle-stat-grid" style="--stat-count: ${statsToShow.length}">
    ${statsToShow.map(({ label, value }) => `<div class="battle-stat"${label === "RES" ? ' title="Resolve per base"' : ""}>
      <span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong>
    </div>`).join("")}
  </div>`;
}

function resolveMarkup(unit, index) {
  const maximum = unitMaxResolve(unit);
  if (maximum <= 0) {
    return `<div class="resolve-off-table">
      <strong>Off-table entry</strong>
      <span>This zero-base unit has no starting Resolve to track. Its rules remain available below.</span>
    </div>`;
  }

  const current = currentResolveByUnitId[unit.id];
  const title = unit.name.trim() || unit.profile;
  const inputId = `resolve-${index + 1}`;
  return `<div class="battle-resolve">

    <div class="resolve-stepper">
      <button class="resolve-button" type="button" data-resolve-action="decrease"
        aria-label="Reduce ${escapeHTML(title)} Resolve; currently ${current} of ${maximum}" ${current <= 0 ? "disabled" : ""}>−</button>
      <label class="resolve-value-wrap" for="${inputId}">
        <input class="resolve-input" id="${inputId}" type="number" inputmode="numeric" min="0" max="${maximum}"
          value="${current}" data-resolve-input aria-label="Current Resolve for ${escapeHTML(title)}, maximum ${maximum}">
        <span class="resolve-maximum">/ ${maximum}</span>
      </label>
      <button class="resolve-button" type="button" data-resolve-action="increase"
        aria-label="Increase ${escapeHTML(title)} Resolve; currently ${current} of ${maximum}" ${current >= maximum ? "disabled" : ""}>+</button>
    </div>
  </div>`;
}

function unitCardMarkup({ unit, stats }, index) {
  const title = unit.name.trim() || unit.profile || "Unnamed unit";
  const maximum = unitMaxResolve(unit);
  const current = currentResolveByUnitId[unit.id] ?? maximum;
  const stateClass = resolveClass(current, maximum);
  const displayedPoints = stats.bases === 0 ? stats.pointsPerBase : stats.total;
  return `<article class="battle-unit-card ${stateClass}" data-unit-id="${escapeHTML(unit.id)}">
    <header class="battle-card-heading">
      <div class="battle-card-title">
        <h2>${escapeHTML(title)}</h2>
        <p class="battle-unit-meta"><span>${escapeHTML(unit.profile)}</span><span>${plural(stats.bases, "base")}</span></p>
      </div>
      <span class="battle-card-points">${integer.format(displayedPoints)} pts</span>
    </header>
    ${statMarkup(stats, unit.profile)}
    ${resolveMarkup(unit, index)}
    <div class="battle-card-rules">
      <div class="battle-rule-row">${unitRuleMarkup(unit)}</div>
    </div>
  </article>`;
}

function renderStrategies() {
  const selected = (army.strategies ?? []).filter((name) => STRATEGY_BY_NAME.has(name));
  elements.strategiesPanel.hidden = selected.length === 0;
  elements.strategies.innerHTML = selected.map((name) => ruleButton({
    type: "strategy",
    kind: "Strategy",
    name,
    className: "is-strategy",
  })).join("");
}

function render() {
  calculatedArmy = calculateArmy(army);
  const count = army.units.length;
  elements.title.textContent = army.armyName.trim() || "Untitled army";
  elements.unitCount.textContent = integer.format(count);
  elements.points.textContent = integer.format(calculatedArmy.total);
  elements.breakPoint.textContent = calculatedArmy.breakPoint ? integer.format(calculatedArmy.breakPoint) : "—";
  elements.empty.hidden = count > 0;
  elements.cards.hidden = count === 0;
  elements.reset.disabled = count === 0;
  elements.share.disabled = count === 0;
  renderStrategies();
  elements.cards.innerHTML = calculatedArmy.units.map(unitCardMarkup).join("");
}

function cardForUnitId(unitId) {
  return [...elements.cards.querySelectorAll("[data-unit-id]")]
    .find((card) => card.dataset.unitId === unitId);
}

function updateResolveUI(unitId) {
  const unit = army.units.find(({ id }) => id === unitId);
  const card = cardForUnitId(unitId);
  if (!unit || !card) return;
  const maximum = unitMaxResolve(unit);
  const current = currentResolveByUnitId[unitId];
  const stateClass = resolveClass(current, maximum);
  card.classList.remove("is-full", "is-damaged", "is-low", "is-zero", "is-off-table");
  card.classList.add(stateClass);

  const title = unit.name.trim() || unit.profile || "Unnamed unit";
  const input = card.querySelector("[data-resolve-input]");
  const decrease = card.querySelector('[data-resolve-action="decrease"]');
  const increase = card.querySelector('[data-resolve-action="increase"]');
  if (input) input.value = String(current);
  if (decrease) {
    decrease.disabled = current <= 0;
    decrease.setAttribute("aria-label", `Reduce ${title} Resolve; currently ${current} of ${maximum}`);
  }
  if (increase) {
    increase.disabled = current >= maximum;
    increase.setAttribute("aria-label", `Increase ${title} Resolve; currently ${current} of ${maximum}`);
  }
}

function setCurrentResolve(unitId, rawValue) {
  const unit = army.units.find(({ id }) => id === unitId);
  if (!unit) return;
  if (rawValue === "" || !Number.isFinite(Number(rawValue))) {
    updateResolveUI(unitId);
    return;
  }
  const maximum = unitMaxResolve(unit);
  currentResolveByUnitId[unitId] = clampCurrentResolve(rawValue, maximum);
  persistResolveProgress();
  updateResolveUI(unitId);
}

function ruleDetails(type, name, level) {
  if (type === "trait") {
    const rule = TRAIT_BY_NAME.get(name);
    return rule ? { kind: "Trait", title: rule.name, meta: "", description: rule.description } : null;
  }
  if (type === "relic") {
    const rule = RELIC_BY_NAME.get(name);
    return rule ? { kind: "Relic", title: rule.name, meta: "", description: rule.description } : null;
  }
  if (type === "strategy") {
    const rule = STRATEGY_BY_NAME.get(name);
    return rule ? {
      kind: "Strategy",
      title: rule.name,
      meta: `${integer.format(rule.points)} points`,
      description: rule.description,
    } : null;
  }
  if (type === "spell") {
    const rule = SPELL_BY_NAME.get(name);
    return rule ? {
      kind: "Spell",
      title: rule.name,
      meta: `Selected at level ${level || 1} · Roll needed: ${rule.difficulty}${rule.errata ? " · Errata applied" : ""}`,
      description: rule.description,
    } : null;
  }
  return null;
}

function openRule(type, name, level) {
  const details = ruleDetails(type, name, level);
  if (!details) return;
  elements.ruleDialogKind.textContent = details.kind;
  elements.ruleDialogTitle.textContent = details.title;
  elements.ruleDialogMeta.textContent = details.meta;
  elements.ruleDialogMeta.hidden = !details.meta;
  elements.ruleDialogCopy.replaceChildren();
  for (const paragraphText of String(details.description).split(/\n{2,}/)) {
    const paragraph = document.createElement("p");
    paragraph.textContent = paragraphText;
    elements.ruleDialogCopy.append(paragraph);
  }
  elements.ruleDialog.showModal();
  byId("rule-dialog-close").focus();
}

function closeOnBackdrop(dialog, event) {
  if (event.target === dialog) dialog.close();
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

async function createShareLink() {
  if (!shareLinkPromise) {
    shareLinkPromise = encodeArmyPayload(army).then((payload) => {
      const url = new URL("battle.html", window.location.href);
      url.hash = `army=${payload}`;
      return url.href;
    }).catch((error) => {
      shareLinkPromise = null;
      throw error;
    });
  }
  return shareLinkPromise;
}

async function openShareDialog() {
  elements.share.disabled = true;
  elements.share.setAttribute("aria-busy", "true");
  try {
    const url = await createShareLink();
    elements.shareLink.value = url;
    try {
      elements.shareQr.innerHTML = createQrSvg(url, { border: 4 });
    } catch {
      elements.shareQr.textContent = "This roster is too large for a QR code. Copy or share the link instead.";
    }
    elements.nativeShare.hidden = typeof navigator.share !== "function";
    elements.shareDialog.showModal();
  } catch {
    showToast("The phone link could not be created.");
  } finally {
    elements.share.disabled = army.units.length === 0;
    elements.share.removeAttribute("aria-busy");
  }
}

async function copyShareLink() {
  const url = elements.shareLink.value || await createShareLink();
  let copied = false;
  try {
    await navigator.clipboard.writeText(url);
    copied = true;
  } catch {
    elements.shareLink.value = url;
    elements.shareLink.focus();
    elements.shareLink.select();
    copied = typeof document.execCommand === "function" && document.execCommand("copy");
  }
  showToast(copied ? "Battle-card link copied." : "Select the link and copy it manually.");
}

elements.cards.addEventListener("click", (event) => {
  const rule = event.target.closest("[data-rule-type]");
  if (rule) {
    openRule(rule.dataset.ruleType, rule.dataset.ruleName, Number(rule.dataset.ruleLevel) || 0);
    return;
  }
  const action = event.target.closest("[data-resolve-action]");
  const card = action?.closest("[data-unit-id]");
  if (!action || !card) return;
  const current = currentResolveByUnitId[card.dataset.unitId] ?? 0;
  if (action.dataset.resolveAction === "decrease") setCurrentResolve(card.dataset.unitId, current - 1);
  else if (action.dataset.resolveAction === "increase") setCurrentResolve(card.dataset.unitId, current + 1);
});

elements.cards.addEventListener("change", (event) => {
  const input = event.target.closest("[data-resolve-input]");
  const card = input?.closest("[data-unit-id]");
  if (input && card) setCurrentResolve(card.dataset.unitId, input.value);
});

elements.cards.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || !event.target.matches("[data-resolve-input]")) return;
  event.preventDefault();
  event.target.blur();
});

elements.strategies.addEventListener("click", (event) => {
  const rule = event.target.closest("[data-rule-type]");
  if (rule) openRule(rule.dataset.ruleType, rule.dataset.ruleName, 0);
});

elements.reset.addEventListener("click", () => {
  const changed = army.units.some((unit) => (
    currentResolveByUnitId[unit.id] !== unitMaxResolve(unit)
  ));
  if (!changed) {
    showToast("Every unit is already at full Resolve.");
    return;
  }
  if (!window.confirm("Reset every unit to its full starting Resolve?")) return;
  for (const unit of army.units) currentResolveByUnitId[unit.id] = unitMaxResolve(unit);
  persistResolveProgress();
  for (const unit of army.units) updateResolveUI(unit.id);
  showToast("All Resolve values reset.");
});

elements.share.addEventListener("click", openShareDialog);
elements.copyShareLink.addEventListener("click", copyShareLink);
elements.nativeShare.addEventListener("click", async () => {
  try {
    const url = elements.shareLink.value || await createShareLink();
    await navigator.share({
      title: `${army.armyName.trim() || "Fantastic Battles Army"} · Battle Cards`,
      text: "Open these interactive Fantastic Battles unit cards.",
      url,
    });
  } catch (error) {
    if (error?.name !== "AbortError") showToast("The share sheet could not be opened.");
  }
});

byId("rule-dialog-close").addEventListener("click", () => elements.ruleDialog.close());
byId("share-dialog-close").addEventListener("click", () => elements.shareDialog.close());
elements.ruleDialog.addEventListener("click", (event) => closeOnBackdrop(elements.ruleDialog, event));
elements.shareDialog.addEventListener("click", (event) => closeOnBackdrop(elements.shareDialog, event));
elements.shareLink.addEventListener("focus", () => elements.shareLink.select());

async function initialise() {
  let source = "empty";
  try {
    ({ army, source } = await loadArmy());
  } catch {
    army = normaliseBattleArmy({});
    source = "invalid";
  }
  calculatedArmy = calculateArmy(army);
  fingerprint = armyFingerprint(army);
  progressStorageKey = battleProgressKey(army);
  currentResolveByUnitId = loadResolveProgress();
  render();

  const guidance = {
    shared: "Loaded from a self-contained battle-card link. Resolve changes are saved on this device.",
    muster: "Loaded from the current muster. Resolve changes are saved separately on this device.",
    saved: "Reopened from this device. Resolve changes from your last session are still here.",
    invalid: "That battle-card link could not be read. Return to the muster and create a new one.",
    empty: "Build an army in the muster, then open its battle cards.",
  };
  elements.guidance.textContent = guidance[source];
  if (source === "invalid") showToast("That battle-card link is invalid or damaged.");

  globalThis.__FB_BATTLE__ = Object.freeze({
    getArmy: () => structuredClone(army),
    getCalculatedArmy: () => structuredClone(calculatedArmy),
    getCurrentResolve: () => structuredClone(currentResolveByUnitId),
    getFingerprint: () => fingerprint,
    createShareLink,
    setCurrentResolve,
  });
}

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    // The battle cards remain usable online when offline caching is unavailable.
  });
}

initialise();
