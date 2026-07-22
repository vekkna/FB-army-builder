param(
  [int]$DebugPort = 9222
)

$pages = Invoke-RestMethod -Uri "http://127.0.0.1:$DebugPort/json"
$page = $pages | Where-Object { $_.type -eq "page" -and $_.url -like "http://127.0.0.1:8765*" } | Select-Object -First 1
if (-not $page) {
  throw "Fantastic Battles Muster page was not found on Chrome debugging port $DebugPort."
}

$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$token = [System.Threading.CancellationToken]::None
[void]$socket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $token).GetAwaiter().GetResult()

try {
  $expression = @'
(() => {
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
  if (existing.units.length || existing.strategies.length || existing.armyName || existing.pointsLimit !== 1000) {
    const confirm = window.confirm;
    window.confirm = () => true;
    click('#new-button');
    window.confirm = confirm;
  }
  const cardsDisabledWhenEmpty = document.querySelector('#unit-cards-button').disabled;
  const rulesDisabledWhenEmpty = document.querySelector('#rules-button').disabled;

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

  const army = globalThis.__FB_MUSTER__.calculateArmy();
  const cardData = globalThis.__FB_MUSTER__.buildUnitCardData();
  const cardPdf = globalThis.__FB_MUSTER__.createUnitCardsPdf();
  const rulesData = globalThis.__FB_MUSTER__.buildArmyRules();
  const rulesPdf = globalThis.__FB_MUSTER__.createRulesPdf();
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
    cardsButtonEnabled: !document.querySelector('#unit-cards-button').disabled,
    rulesButtonEnabled: !document.querySelector('#rules-button').disabled,
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
      deploy: document.querySelector('#deployment-button').title,
    },
    rulesBetweenCardsAndDeploy: document.querySelector('#unit-cards-button').nextElementSibling?.id === 'rules-button' && document.querySelector('#rules-button').nextElementSibling?.id === 'deployment-button',
    spells: globalThis.__FB_MUSTER__.getState().units.flatMap((unit) => unit.spells || []),
    spellChips: Array.from(document.querySelectorAll('.upgrade-chip.is-spell')).map((chip) => chip.textContent.trim()),
    blinkTooltip: document.querySelector('[data-spell-name="Blink"]')?.title || '',
    tomeTooltip: document.querySelector('#unit-relic option[value="Mystical Tome of Revelation"]')?.title || '',
    tomeSpellCapacity,
    levelThreeIncreaseDisabled,
    cardSpellNames: cardData.flatMap((card) => card.abilities.filter((ability) => ability.kind === 'Spell').map((ability) => ability.name)),
    dragReordered: orderBeforeDrag[0] === orderAfterDrag[1] && orderBeforeDrag[1] === orderAfterDrag[0],
    dragHandles: document.querySelectorAll('[data-drag-handle]').length,
    directionButtons: document.querySelectorAll('[data-action="up"], [data-action="down"]').length,
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
  if ($result.cardCount -ne 2 -or $result.cardPdfType -ne "application/pdf" -or $result.cardPdfSize -lt 1000) { throw "Expected two generated cards in a non-empty PDF." }
  if ($result.downloadedCardFile -ne "fantastic-battles-army-unit-cards.pdf") { throw "Expected the Cards action to download the army-named PDF." }
  if ($result.rulesCount -ne 5 -or $result.rulesPdfType -ne "application/pdf" -or $result.rulesPdfSize -lt 1000) { throw "Expected five unique selected rules in a non-empty PDF." }
  if ($result.downloadedRulesFile -ne "fantastic-battles-army-rules-reference.pdf") { throw "Expected the Rules action to download the army-named PDF." }
  if ($result.strategyTooltip -like "*Add Agent*" -or $result.strategyTooltip -notlike "*Sowing discord*") { throw "Expected strategy tooltips to contain descriptions without add prompts." }
  if (-not $result.headerTooltipsPresent -or -not $result.rulesBetweenCardsAndDeploy) { throw "Expected descriptive header tooltips and Rules between Cards and Deploy." }
  if ($result.actionTooltips.cards -ne "Print and cut out unit cards for the battlefield." -or $result.actionTooltips.rules -ne "Print the rules your army uses." -or $result.actionTooltips.deploy -ne "Plan your army's deployment.") { throw "Expected the requested Cards, Rules, and Deploy tooltips." }
  if ($result.spells.Count -ne 2 -or $result.spells[0].name -ne "Bless" -or $result.spells[0].level -ne 3 -or $result.spells[1].name -ne "Bless" -or $result.spells[1].level -ne 1) { throw "Expected Bless at levels 3 and 1 on the Tome-bearing Mage-lord." }
  if (($result.spellChips | Where-Object { $_ -like "*Bless L3" }).Count -ne 1 -or ($result.spellChips | Where-Object { $_ -like "*Bless L1" }).Count -ne 1) { throw "Expected both Bless selections in the roster." }
  if ($result.tomeSpellCapacity -ne "4 / 4 levels" -or $result.tomeTooltip -notlike "*additional spell level*") { throw "Expected Mystical Tome to visibly grant a fourth spell level." }
  if (-not $result.levelThreeIncreaseDisabled) { throw "Expected individual spells to remain capped at level 3 with the Tome." }
  if ($result.blinkTooltip -notlike "*Roll needed: 5+ (errata)*") { throw "Expected the Blink errata in its tooltip." }
  if ($result.cardSpellNames -notcontains "Bless L3" -or $result.cardSpellNames -notcontains "Bless L1") { throw "Expected both Bless selections in unit-card data." }
  if (-not $result.dragReordered -or $result.dragHandles -ne 2 -or $result.directionButtons -ne 0) { throw "Expected drag handles to reorder units without Up/Down buttons." }

  $result | ConvertTo-Json -Compress
}
finally {
  if ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    [void]$socket.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $token).GetAwaiter().GetResult()
  }
  $socket.Dispose()
}
