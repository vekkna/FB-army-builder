param(
  [int]$DebugPort = 9222
)

$pages = Invoke-RestMethod -Uri "http://127.0.0.1:$DebugPort/json"
$page = $pages | Where-Object {
  $_.type -eq "page" -and $_.url -in @("http://127.0.0.1:8765/", "http://127.0.0.1:8765/index.html")
} | Select-Object -First 1
if (-not $page) {
  throw "Fantastic Battles Muster page was not found on Chrome debugging port $DebugPort."
}

$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$token = [System.Threading.CancellationToken]::None
[void]$socket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $token).GetAwaiter().GetResult()

try {
  $expression = @'
(async () => {
  const click = (selector) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    element.click();
  };
  const input = (selector, value, eventName) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    element.value = value;
    element.dispatchEvent(new Event(eventName, { bubbles: true }));
  };

  const existing = globalThis.__FB_MUSTER__.getState();
  const libraryCountAtStart = globalThis.__FB_MUSTER__.getLibrary().length;
  const smokeSuffix = String(Date.now());
  const smokeLibraryName = `Smoke Army ${smokeSuffix}`;
  const smokeVariantName = `Tournament Variant ${smokeSuffix}`;
  if (existing.units.length || existing.strategies.length || existing.armyName || existing.pointsLimit !== 1000) {
    const confirm = window.confirm;
    window.confirm = () => true;
    click('#new-button');
    window.confirm = confirm;
  }
  const cardsDisabledWhenEmpty = document.querySelector('#unit-cards-button').disabled;
  const rulesDisabledWhenEmpty = document.querySelector('#rules-button').disabled;
  const battleDisabledWhenEmpty = document.querySelector('#battle-button').disabled;
  const saveLoadInitiallyClean = !document.querySelector('#library-button').classList.contains('has-unsaved-changes');

  click('[data-profile="Formed company"]');
  input('#unit-name', 'The Iron Guard', 'input');
  input('#unit-bases', '4', 'change');
  click('#racial-trait-button');
  click('[data-trait-name="Doughty"]');
  click('[data-trait-slot="0"]');
  click('[data-trait-name="Shieldwall"]');
  click('#save-unit-button');

  click('[data-profile="Mage-lord"]');
  input('#unit-name', 'Lady Rowan', 'input');
  click('#add-spell-button');
  click('[data-spell-name="Bless"]');
  click('[data-spell-action="increase"][data-spell-index="0"]');
  click('[data-spell-action="increase"][data-spell-index="0"]');
  input('#unit-relic', 'Mystical Tome of Revelation', 'change');
  const levelThreeIncreaseDisabled = document.querySelector('[data-spell-action="increase"][data-spell-index="0"]').disabled;
  click('#add-spell-button');
  click('[data-spell-name="Bless"]');
  const tomeSpellCapacity = document.querySelector('#spell-count').textContent;
  click('#save-unit-button');

  click('[data-strategy="Agent"]');

  const orderBeforeDrag = globalThis.__FB_MUSTER__.getState().units.map((unit) => unit.name);
  const firstHandle = document.querySelector('[data-drag-handle]');
  const secondCard = document.querySelectorAll('[data-unit-id]')[1];
  secondCard.scrollIntoView({ block: 'center' });
  const firstBounds = firstHandle.getBoundingClientRect();
  const secondBounds = secondCard.getBoundingClientRect();
  firstHandle.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, cancelable: true, pointerId: 42, pointerType: 'mouse', button: 0,
    clientX: firstBounds.left + 2, clientY: firstBounds.top + 2,
  }));
  document.querySelector('#roster-list').dispatchEvent(new PointerEvent('pointermove', {
    bubbles: true, cancelable: true, pointerId: 42, pointerType: 'mouse', buttons: 1,
    clientX: secondBounds.left + 2, clientY: secondBounds.bottom - 1,
  }));
  document.querySelector('#roster-list').dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, cancelable: true, pointerId: 42, pointerType: 'mouse', button: 0,
    clientX: secondBounds.left + 2, clientY: secondBounds.bottom - 1,
  }));
  const orderAfterDrag = globalThis.__FB_MUSTER__.getState().units.map((unit) => unit.name);
  const saveLoadUnsavedBeforeFirstSave = document.querySelector('#library-button').classList.contains('has-unsaved-changes');

  const army = globalThis.__FB_MUSTER__.calculateArmy();
  const cardData = globalThis.__FB_MUSTER__.buildUnitCardData();
  const cardPdf = globalThis.__FB_MUSTER__.createUnitCardsPdf();
  const rulesData = globalThis.__FB_MUSTER__.buildArmyRules();
  const rulesPdf = globalThis.__FB_MUSTER__.createRulesPdf();
  const battlePayload = await globalThis.__FB_MUSTER__.createBattlePayload();
  let downloadedCardFile = '';
  let downloadedRulesFile = '';
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { downloadedCardFile = this.download; };
  try {
    click('#unit-cards-button');
  } finally {
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  }
  HTMLAnchorElement.prototype.click = function () { downloadedRulesFile = this.download; };
  try {
    click('#rules-button');
  } finally {
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  }

  click('#library-button');
  const libraryWarning = document.querySelector('.library-warning').textContent;
  const libraryBounds = document.querySelector('#library-dialog').getBoundingClientRect();
  const libraryMobileLayout = innerWidth > 620 || (
    Math.abs(libraryBounds.width - document.documentElement.clientWidth) < 1
    && Math.abs(libraryBounds.bottom - innerHeight) < 1
    && libraryBounds.top > 0
  );
  input('#library-save-name', smokeLibraryName, 'input');
  click('#library-save-button');
  const saveLoadCleanAfterFirstSave = !document.querySelector('#library-button').classList.contains('has-unsaved-changes');
  const savedEntry = globalThis.__FB_MUSTER__.getLibrary().find((entry) => entry.name === smokeLibraryName);
  const idsBeforeDuplicate = new Set(globalThis.__FB_MUSTER__.getLibrary().map((entry) => entry.id));
  document.querySelector(`[data-library-id="${savedEntry.id}"] [data-library-action="duplicate"]`).click();
  const duplicateEntry = globalThis.__FB_MUSTER__.getLibrary().find((entry) => !idsBeforeDuplicate.has(entry.id));
  document.querySelector(`[data-library-id="${duplicateEntry.id}"] [data-library-action="rename"]`).click();
  const renameForm = document.querySelector(`[data-library-id="${duplicateEntry.id}"] [data-library-rename-form]`);
  input(`[data-library-id="${duplicateEntry.id}"] [data-library-rename-input]`, smokeVariantName, 'input');
  renameForm.requestSubmit();
  click('#library-dialog-close');

  const savedLimitBeforeWorkspaceEdit = globalThis.__FB_MUSTER__.getLibrary().find((entry) => entry.id === savedEntry.id).army.pointsLimit;
  input('#points-limit', '1200', 'change');
  const saveLoadUnsavedAfterEdit = document.querySelector('#library-button').classList.contains('has-unsaved-changes');
  const saveLoadUnsavedDotVisible = getComputedStyle(document.querySelector('.library-unsaved-dot')).display !== 'none';
  const saveLoadUnsavedLabel = document.querySelector('#library-button').getAttribute('aria-label');
  const savedLimitAfterWorkspaceEdit = globalThis.__FB_MUSTER__.getLibrary().find((entry) => entry.id === savedEntry.id).army.pointsLimit;
  click('#library-button');
  const unsavedLibraryStatus = document.querySelector('#library-save-status').textContent;
  click('#library-save-button');
  const saveLoadCleanAfterExplicitSave = !document.querySelector('#library-button').classList.contains('has-unsaved-changes');
  const savedLimitAfterExplicitSave = globalThis.__FB_MUSTER__.getLibrary().find((entry) => entry.id === savedEntry.id).army.pointsLimit;
  let downloadedLibraryFile = '';
  HTMLAnchorElement.prototype.click = function () { downloadedLibraryFile = this.download; };
  try {
    click('#library-export-all-button');
  } finally {
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  }
  const libraryNames = globalThis.__FB_MUSTER__.getLibrary().map((entry) => entry.name);
  const libraryModifiedTimesPresent = Array.from(document.querySelectorAll('.library-entry time')).every((time) => time.dateTime && time.textContent.includes('Modified'));
  const libraryActionHeights = Array.from(document.querySelectorAll('.library-entry-actions button'))
    .map((button) => button.getBoundingClientRect().height);
  const libraryTouchTargets = innerWidth > 620 || libraryActionHeights.every((height) => height >= 40);
  const backupFile = new File([JSON.stringify({
    format: 'fantastic-battles-muster-library',
    version: 1,
    armies: globalThis.__FB_MUSTER__.getLibrary(),
  })], 'army-library.json', { type: 'application/json' });
  const transfer = new DataTransfer();
  transfer.items.add(backupFile);
  const importInput = document.querySelector('#import-file');
  importInput.files = transfer.files;
  importInput.dispatchEvent(new Event('change', { bubbles: true }));
  const expectedRestoredLibraryCount = Math.min(100, libraryNames.length * 2);
  for (let attempt = 0; attempt < 20 && globalThis.__FB_MUSTER__.getLibrary().length < expectedRestoredLibraryCount; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const restoredLibraryCount = globalThis.__FB_MUSTER__.getLibrary().length;
  click('#library-dialog-close');
  const builderRuleDialogs = {};
  for (const type of ['trait', 'spell', 'relic', 'strategy']) {
    const trigger = Array.from(document.querySelectorAll(`[data-rule-info-type="${type}"]`))
      .find((element) => element.getClientRects().length > 0);
    if (!trigger) {
      builderRuleDialogs[type] = false;
      continue;
    }
    trigger.click();
    builderRuleDialogs[type] = document.querySelector('#rule-info-dialog').open
      && document.querySelector('#rule-info-title').textContent.trim().length > 0
      && document.querySelector('#rule-info-copy').textContent.trim().length > 20;
    click('#rule-info-close');
  }
  const ruleInfoTouchTargets = Array.from(document.querySelectorAll('.rule-info-button'))
    .filter((button) => button.getClientRects().length > 0)
    .every((button) => button.getBoundingClientRect().width >= 38 && button.getBoundingClientRect().height >= 38);
  return {
    units: globalThis.__FB_MUSTER__.getState().units.length,
    total: army.total,
    breakPoint: army.breakPoint,
    generals: army.roles.generals,
    issues: army.issues.length,
    displayedTotal: document.querySelector('#points-total').textContent,
    cards: document.querySelectorAll('.unit-card').length,
    emptyStateHidden: document.querySelector('#empty-roster').hidden && getComputedStyle(document.querySelector('#empty-roster')).display === 'none',
    hasPerBaseLabel: document.body.textContent.includes('/ base'),
    cardsDisabledWhenEmpty,
    rulesDisabledWhenEmpty,
    battleDisabledWhenEmpty,
    cardsButtonEnabled: !document.querySelector('#unit-cards-button').disabled,
    rulesButtonEnabled: !document.querySelector('#rules-button').disabled,
    battleButtonEnabled: !document.querySelector('#battle-button').disabled,
    battlePayload,
    cardCount: cardData.length,
    cardPdfType: cardPdf.type,
    cardPdfSize: cardPdf.size,
    downloadedCardFile,
    rulesCount: rulesData.sections.reduce((sum, section) => sum + section.entries.length, 0),
    rulesPdfType: rulesPdf.type,
    rulesPdfSize: rulesPdf.size,
    downloadedRulesFile,
    strategyTooltip: document.querySelector('[data-strategy="Agent"]').title,
    headerTooltipsPresent: Array.from(document.querySelectorAll('.header-actions [title]')).every((element) => element.title.trim()),
    actionTooltips: {
      cards: document.querySelector('#unit-cards-button').title,
      rules: document.querySelector('#rules-button').title,
      battle: document.querySelector('#battle-button').title,
      deploy: document.querySelector('#deployment-button').title,
    },
    battleActionOrder: document.querySelector('#unit-cards-button').nextElementSibling?.id === 'rules-button'
      && document.querySelector('#rules-button').nextElementSibling?.id === 'battle-button'
      && document.querySelector('#battle-button').nextElementSibling?.id === 'deployment-button',
    spells: globalThis.__FB_MUSTER__.getState().units.flatMap((unit) => unit.spells || []),
    spellChips: Array.from(document.querySelectorAll('.upgrade-chip.is-spell')).map((chip) => chip.textContent.trim()),
    hasBlessLevelThreeChip: Array.from(document.querySelectorAll('.upgrade-chip.is-spell')).some((chip) => chip.textContent.includes('Bless L3')),
    hasBlessLevelOneChip: Array.from(document.querySelectorAll('.upgrade-chip.is-spell')).some((chip) => chip.textContent.includes('Bless L1')),
    blinkTooltip: document.querySelector('[data-spell-name="Blink"]')?.title || '',
    tomeTooltip: document.querySelector('#unit-relic option[value="Mystical Tome of Revelation"]')?.title || '',
    tomeSpellCapacity,
    levelThreeIncreaseDisabled,
    builderRuleDialogs,
    ruleInfoTouchTargets,
    cardSpellNames: cardData.flatMap((card) => card.abilities.filter((ability) => ability.kind === 'Spell').map((ability) => ability.name)),
    dragReordered: orderBeforeDrag[0] === orderAfterDrag[1] && orderBeforeDrag[1] === orderAfterDrag[0],
    dragHandles: document.querySelectorAll('[data-drag-handle]').length,
    directionButtons: document.querySelectorAll('[data-action="up"], [data-action="down"]').length,
    libraryWarning,
    libraryNames,
    libraryCountAtStart,
    smokeLibraryName,
    smokeVariantName,
    expectedRestoredLibraryCount,
    libraryModifiedTimesPresent,
    downloadedLibraryFile,
    savedLimitBeforeWorkspaceEdit,
    savedLimitAfterWorkspaceEdit,
    savedLimitAfterExplicitSave,
    unsavedLibraryStatus,
    libraryMobileLayout,
    libraryTouchTargets,
    libraryViewport: { width: innerWidth, layoutWidth: document.documentElement.clientWidth, height: innerHeight },
    libraryBounds: { left: libraryBounds.left, top: libraryBounds.top, bottom: libraryBounds.bottom, width: libraryBounds.width, height: libraryBounds.height },
    libraryActionHeights,
    restoredLibraryCount,
    saveLoadInitiallyClean,
    saveLoadUnsavedBeforeFirstSave,
    saveLoadCleanAfterFirstSave,
    saveLoadUnsavedAfterEdit,
    saveLoadUnsavedDotVisible,
    saveLoadUnsavedLabel,
    saveLoadCleanAfterExplicitSave,
  };
})()
'@

  $payload = @{
    id = 1
    method = "Runtime.evaluate"
    params = @{
      expression = $expression
      returnByValue = $true
      awaitPromise = $true
    }
  } | ConvertTo-Json -Compress -Depth 8

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $sendSegment = [System.ArraySegment[byte]]::new($bytes)
  [void]$socket.SendAsync($sendSegment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $token).GetAwaiter().GetResult()

  do {
    $builder = [System.Text.StringBuilder]::new()
    do {
      $buffer = [byte[]]::new(65536)
      $receiveSegment = [System.ArraySegment[byte]]::new($buffer)
      $received = $socket.ReceiveAsync($receiveSegment, $token).GetAwaiter().GetResult()
      [void]$builder.Append([System.Text.Encoding]::UTF8.GetString($buffer, 0, $received.Count))
    } until ($received.EndOfMessage)
    $message = $builder.ToString() | ConvertFrom-Json
  } until ($message.id -eq 1)

  if ($message.result.exceptionDetails) {
    throw $message.result.exceptionDetails.exception.description
  }
  $result = $message.result.result.value

  if ($result.units -ne 2 -or $result.cards -ne 2) { throw "Expected two roster units." }
  if ($result.total -ne 265 -or $result.displayedTotal -ne "265") { throw "Expected a 265-point army." }
  if ($result.breakPoint -ne 3) { throw "Expected break point 3." }
  if ($result.generals -ne 1 -or $result.issues -ne 0) { throw "Expected a legal army with one general." }
  if (-not $result.emptyStateHidden) { throw "Expected the empty roster message to disappear after adding a unit." }
  if ($result.hasPerBaseLabel) { throw "Expected points labels to omit '/ base'." }
  if (-not $result.cardsDisabledWhenEmpty -or -not $result.cardsButtonEnabled) { throw "Expected Cards to be disabled for an empty roster and enabled after adding units." }
  if (-not $result.rulesDisabledWhenEmpty -or -not $result.rulesButtonEnabled) { throw "Expected Rules to be disabled with no selected rules and enabled after building the army." }
  if (-not $result.battleDisabledWhenEmpty -or -not $result.battleButtonEnabled -or $result.battlePayload -notmatch "^fb2\.(gz|raw)\.") { throw "Expected Battle to enable for a roster and create a versioned phone payload." }
  if ($result.cardCount -ne 2 -or $result.cardPdfType -ne "application/pdf" -or $result.cardPdfSize -lt 1000) { throw "Expected two generated cards in a non-empty PDF." }
  if ($result.downloadedCardFile -ne "fantastic-battles-army-unit-cards.pdf") { throw "Expected the Cards action to download the army-named PDF." }
  if ($result.rulesCount -ne 4 -or $result.rulesPdfType -ne "application/pdf" -or $result.rulesPdfSize -lt 1000) { throw "Expected four unique selected rules in a non-empty PDF." }
  if ($result.downloadedRulesFile -ne "fantastic-battles-army-rules-reference.pdf") { throw "Expected the Rules action to download the army-named PDF." }
  if ($result.strategyTooltip -like "*Add Agent*" -or $result.strategyTooltip -notlike "*Sowing discord*") { throw "Expected strategy tooltips to contain descriptions without add prompts." }
  if (-not $result.headerTooltipsPresent -or -not $result.battleActionOrder) { throw "Expected descriptive header tooltips and Cards, Rules, Battle, Deploy ordering." }
  if ($result.actionTooltips.cards -ne "Print and cut out unit cards for the battlefield." -or $result.actionTooltips.rules -ne "Print the rules your army uses." -or $result.actionTooltips.battle -ne "Open interactive unit cards and track Resolve." -or $result.actionTooltips.deploy -ne "Plan your army's deployment.") { throw "Expected the requested Cards, Rules, Battle, and Deploy tooltips." }
  if ($result.spells.Count -ne 2 -or $result.spells[0].name -ne "Bless" -or $result.spells[0].level -ne 3 -or $result.spells[1].name -ne "Bless" -or $result.spells[1].level -ne 1) { throw "Expected Bless at levels 3 and 1 on the Tome-bearing Mage-lord." }
  if (-not $result.hasBlessLevelThreeChip -or -not $result.hasBlessLevelOneChip) { throw "Expected both Bless selections in the roster." }
  if ($result.tomeSpellCapacity -ne "4 / 4 levels" -or $result.tomeTooltip -notlike "*additional spell level*") { throw "Expected Mystical Tome to visibly grant a fourth spell level." }
  if (-not $result.levelThreeIncreaseDisabled) { throw "Expected individual spells to remain capped at level 3 with the Tome." }
  if ($result.blinkTooltip -notlike "*Roll needed: 5+ (errata)*") { throw "Expected the Blink errata in its tooltip." }
  if (-not $result.builderRuleDialogs.trait -or -not $result.builderRuleDialogs.spell -or -not $result.builderRuleDialogs.relic -or -not $result.builderRuleDialogs.strategy -or -not $result.ruleInfoTouchTargets) { throw "Expected touch-readable trait, spell, relic, and strategy descriptions in the muster. Dialogs: $($result.builderRuleDialogs | ConvertTo-Json -Compress); touch targets: $($result.ruleInfoTouchTargets)." }
  if ($result.cardSpellNames -notcontains "Bless L3" -or $result.cardSpellNames -notcontains "Bless L1") { throw "Expected both Bless selections in unit-card data." }
  if (-not $result.dragReordered -or $result.dragHandles -ne 2 -or $result.directionButtons -ne 0) { throw "Expected drag handles to reorder units without Up/Down buttons." }
  if ($result.libraryWarning -notlike "*Clearing this site's data*" -or $result.libraryWarning -notlike "*Export a JSON backup*") { throw "Expected a clear browser-storage loss warning in the army library." }
  if ($result.libraryNames.Count -ne ($result.libraryCountAtStart + 2) -or $result.libraryNames -notcontains $result.smokeLibraryName -or $result.libraryNames -notcontains $result.smokeVariantName) { throw "Expected saved, duplicated, and renamed library armies." }
  if (-not $result.libraryModifiedTimesPresent -or $result.downloadedLibraryFile -ne "fantastic-battles-army-library.json") { throw "Expected last-modified dates and an export-all JSON backup." }
  if ($result.savedLimitBeforeWorkspaceEdit -ne 1000 -or $result.savedLimitAfterWorkspaceEdit -ne 1000 -or $result.savedLimitAfterExplicitSave -ne 1200 -or $result.unsavedLibraryStatus -notlike "*Unsaved changes*") { throw "Expected library snapshots to change only after an explicit save." }
  if (-not $result.libraryMobileLayout -or -not $result.libraryTouchTargets) { throw "Expected a bottom-anchored library with touch-friendly controls on mobile (viewport $($result.libraryViewport.width)x$($result.libraryViewport.height); dialog $($result.libraryBounds.left),$($result.libraryBounds.top),$($result.libraryBounds.width)x$($result.libraryBounds.height); action heights $($result.libraryActionHeights -join ','))." }
  if ($result.restoredLibraryCount -ne $result.expectedRestoredLibraryCount) { throw "Expected an exported whole-library JSON backup to import its armies again." }
  if (-not $result.saveLoadInitiallyClean -or -not $result.saveLoadUnsavedBeforeFirstSave -or -not $result.saveLoadCleanAfterFirstSave -or -not $result.saveLoadUnsavedAfterEdit -or -not $result.saveLoadUnsavedDotVisible -or -not $result.saveLoadCleanAfterExplicitSave) { throw "Expected the Save/Load indicator to track unsaved library changes." }
  if ($result.saveLoadUnsavedLabel -notlike "Save/Load*changes not saved to library") { throw "Expected the unsaved Save/Load state to have a clear accessible label." }

  $result | ConvertTo-Json -Compress
}
finally {
  if ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    [void]$socket.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $token).GetAwaiter().GetResult()
  }
  $socket.Dispose()
}
