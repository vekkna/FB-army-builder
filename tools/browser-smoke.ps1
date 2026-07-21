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
  click('#add-spell-button');
  click('[data-spell-name="Blink"]');
  input('#unit-relic', 'Blade of Unsurpassable Power', 'change');
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
  let downloadedCardFile = '';
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { downloadedCardFile = this.download; };
  try {
    click('#unit-cards-button');
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
    cardsButtonEnabled: !document.querySelector('#unit-cards-button').disabled,
    cardCount: cardData.length,
    cardPdfType: cardPdf.type,
    cardPdfSize: cardPdf.size,
    downloadedCardFile,
    spells: globalThis.__FB_MUSTER__.getState().units.flatMap((unit) => unit.spells || []),
    spellChips: Array.from(document.querySelectorAll('.upgrade-chip.is-spell')).map((chip) => chip.textContent.trim()),
    blinkTooltip: document.querySelector('[data-spell-name="Blink"]')?.title || '',
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
  if ($result.total -ne 258 -or $result.displayedTotal -ne "258") { throw "Expected a 258-point army." }
  if ($result.breakPoint -ne 3) { throw "Expected break point 3." }
  if ($result.generals -ne 1 -or $result.issues -ne 0) { throw "Expected a legal army with one general." }
  if (-not $result.emptyStateHidden) { throw "Expected the empty roster message to disappear after adding a unit." }
  if ($result.hasPerBaseLabel) { throw "Expected points labels to omit '/ base'." }
  if (-not $result.cardsDisabledWhenEmpty -or -not $result.cardsButtonEnabled) { throw "Expected Cards to be disabled for an empty roster and enabled after adding units." }
  if ($result.cardCount -ne 2 -or $result.cardPdfType -ne "application/pdf" -or $result.cardPdfSize -lt 1000) { throw "Expected two generated cards in a non-empty PDF." }
  if ($result.downloadedCardFile -ne "fantastic-battles-army-unit-cards.pdf") { throw "Expected the Cards action to download the army-named PDF." }
  if ($result.spells.Count -ne 2 -or $result.spells[0].name -ne "Bless" -or $result.spells[0].level -ne 2 -or $result.spells[1].name -ne "Blink" -or $result.spells[1].level -ne 1) { throw "Expected a level-2 Bless and level-1 Blink on the Mage-lord." }
  if (-not ($result.spellChips | Where-Object { $_ -like "*Bless L2" }) -or -not ($result.spellChips | Where-Object { $_ -like "*Blink L1" })) { throw "Expected selected spells in the roster." }
  if ($result.blinkTooltip -notlike "*Roll needed: 5+ (errata)*") { throw "Expected the Blink errata in its tooltip." }
  if ($result.cardSpellNames -notcontains "Bless L2" -or $result.cardSpellNames -notcontains "Blink L1") { throw "Expected spell names and levels in unit-card data." }
  if (-not $result.dragReordered -or $result.dragHandles -ne 2 -or $result.directionButtons -ne 0) { throw "Expected drag handles to reorder units without Up/Down buttons." }

  $result | ConvertTo-Json -Compress
}
finally {
  if ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    [void]$socket.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $token).GetAwaiter().GetResult()
  }
  $socket.Dispose()
}
