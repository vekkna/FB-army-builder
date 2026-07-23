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
$nextId = 1

function Invoke-BrowserExpression {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Expression
  )

  $requestId = $script:nextId
  $script:nextId += 1
  $payload = @{
    id = $requestId
    method = "Runtime.evaluate"
    params = @{
      expression = $Expression
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
  } until ($message.id -eq $requestId)

  if ($message.result.exceptionDetails) {
    throw $message.result.exceptionDetails.exception.description
  }
  return $message.result.result.value
}

function Wait-ForBattleHook {
  param(
    [string]$ExpectedPayload = "",
    [string]$ExpectedArmyName = ""
  )
  for ($attempt = 0; $attempt -lt 50; $attempt += 1) {
    try {
      $readyExpression = if ($ExpectedPayload) {
        $expectedNameJson = $ExpectedArmyName | ConvertTo-Json -Compress
        "Boolean(globalThis.__FB_BATTLE__ && !globalThis.__FB_RELOAD_SENTINEL__ && location.hash === '#army=$ExpectedPayload' && globalThis.__FB_BATTLE__.getArmy().armyName === $expectedNameJson)"
      } else {
        "Boolean(globalThis.__FB_BATTLE__ && !globalThis.__FB_RELOAD_SENTINEL__)"
      }
      if (Invoke-BrowserExpression -Expression $readyExpression) {
        return
      }
    } catch {
      # Navigation can replace the JavaScript context between polls.
    }
    Start-Sleep -Milliseconds 100
  }
  $diagnostic = Invoke-BrowserExpression -Expression "JSON.stringify({ href: location.href, ready: document.readyState, hasHook: Boolean(globalThis.__FB_BATTLE__), armyName: globalThis.__FB_BATTLE__?.getArmy?.().armyName || '', title: document.querySelector('#battle-army-name')?.textContent || '' })"
  throw "Battle Cards did not finish loading. $diagnostic"
}

function Wait-ForMusterHook {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ExpectedArmyName
  )
  $expectedNameJson = $ExpectedArmyName | ConvertTo-Json -Compress
  for ($attempt = 0; $attempt -lt 50; $attempt += 1) {
    try {
      if (Invoke-BrowserExpression -Expression "Boolean(globalThis.__FB_MUSTER__ && globalThis.__FB_MUSTER__.getState().armyName === $expectedNameJson)") {
        return
      }
    } catch {
      # Navigation can replace the JavaScript context between polls.
    }
    Start-Sleep -Milliseconds 100
  }
  $diagnostic = Invoke-BrowserExpression -Expression "JSON.stringify({ href: location.href, ready: document.readyState, hasHook: Boolean(globalThis.__FB_MUSTER__), armyName: globalThis.__FB_MUSTER__?.getState?.().armyName || '' })"
  throw "The shared army did not return to the muster. $diagnostic"
}

try {
  $navigateExpression = @'
(async () => {
  const { encodeArmyPayload } = await import('./battle-state.js');
  localStorage.removeItem('fantastic-battles-muster:v1');
  const smokeName = `Battle Smoke Host ${Date.now()}`;
  const payload = await encodeArmyPayload({
    armyName: smokeName,
    pointsLimit: 1000,
    strategies: ['Agent'],
    units: [
      {
        id: 'guard',
        name: 'The Iron Guard',
        profile: 'Formed company',
        bases: 3,
        racialTrait: 'Fast',
        traits: ['Doughty'],
        relic: '',
        spells: [],
      },
      {
        id: 'mage',
        name: 'Lady Rowan',
        profile: 'Mage-lord',
        bases: 1,
        racialTrait: '',
        traits: [],
        relic: 'Mystical Tome of Revelation',
        spells: [{ name: 'Blink', level: 2 }],
      },
    ],
  });
  const target = new URL('battle.html', location.href);
  target.searchParams.set('smoke', String(Date.now()));
  target.hash = `army=${payload}`;
  location.href = target.href;
  return { payload, smokeName };
})()
'@
  $navigation = Invoke-BrowserExpression -Expression $navigateExpression
  $payload = $navigation.payload
  $smokeName = $navigation.smokeName
  if ($payload -notmatch "^fb2\.(gz|raw)\.") {
    throw "Expected a versioned Battle Cards payload."
  }

  Start-Sleep -Milliseconds 200
  Wait-ForBattleHook -ExpectedPayload $payload -ExpectedArmyName $smokeName

  $testExpression = @'
(async () => {
  const hook = globalThis.__FB_BATTLE__;
  const army = hook.getArmy();
  const calculated = hook.getCalculatedArmy();
  const initial = hook.getCurrentResolve();
  const maxima = Object.fromEntries(calculated.units.map(({ unit, stats }) => [
    unit.id,
    Math.max(0, Math.round(stats.resolve * stats.bases)),
  ]));
  const startsAtMaximum = army.units.every((unit) => initial[unit.id] === maxima[unit.id]);
  const firstUnit = army.units[0];
  const firstCard = document.querySelector(`[data-unit-id="${firstUnit.id}"]`);
  firstCard.querySelector('[data-resolve-action="decrease"]').click();
  const afterDecrease = hook.getCurrentResolve()[firstUnit.id];

  const ruleChecks = {};
  for (const type of ['trait', 'spell', 'relic', 'strategy']) {
    const button = document.querySelector(`[data-rule-type="${type}"]`);
    if (!button) {
      ruleChecks[type] = false;
      continue;
    }
    button.click();
    ruleChecks[type] = document.querySelector('#rule-dialog').open
      && document.querySelector('#rule-dialog-title').textContent.trim().length > 0
      && document.querySelector('#rule-dialog-copy').textContent.trim().length > 20;
    document.querySelector('#rule-dialog-close').click();
  }

  document.querySelector('#share-battle').click();
  for (let attempt = 0; attempt < 50 && !document.querySelector('#share-dialog').open; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const shareLink = document.querySelector('#share-link').value;
  const qrPresent = Boolean(document.querySelector('#share-qr svg'));
  const touchTargets = Array.from(document.querySelectorAll('.resolve-button'))
    .every((button) => button.getBoundingClientRect().height >= 44);
  const overflowElements = Array.from(document.querySelectorAll('body *'))
    .map((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        id: element.id,
        className: typeof element.className === 'string' ? element.className : '',
        left: Math.round(bounds.left),
        right: Math.round(bounds.right),
        width: Math.round(bounds.width),
      };
    })
    .filter(({ left, right }) => left < -1 || right > innerWidth + 1)
    .slice(0, 12);
  document.querySelector('#share-dialog-close').click();

  return {
    title: document.querySelector('#battle-army-name').textContent,
    cards: document.querySelectorAll('.battle-unit-card').length,
    strategyButtons: document.querySelectorAll('[data-rule-type="strategy"]').length,
    startsAtMaximum,
    firstUnitId: firstUnit.id,
    firstMaximum: maxima[firstUnit.id],
    afterDecrease,
    ruleChecks,
    shareLink,
    musterLink: document.querySelector('[data-muster-link]').href,
    qrPresent,
    touchTargets,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    barcodeDetectorSupported: 'BarcodeDetector' in globalThis,
    viewport: {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    },
    overflowElements,
  };
})()
'@

  $result = Invoke-BrowserExpression -Expression $testExpression
  if ($result.title -ne $smokeName -or $result.cards -ne 2) {
    throw "Expected the shared two-unit army in Battle Cards."
  }
  if (-not $result.startsAtMaximum -or $result.afterDecrease -ne ($result.firstMaximum - 1)) {
    throw "Expected Resolve to start at stat × bases and decrement by one."
  }
  if (-not $result.ruleChecks.trait -or -not $result.ruleChecks.spell -or -not $result.ruleChecks.relic -or -not $result.ruleChecks.strategy) {
    throw "Expected traits, spells, relics, and strategies to open full rule dialogs."
  }
  if ($result.strategyButtons -ne 1 -or $result.shareLink -notmatch "battle\.html#army=fb2\.(gz|raw)\.") {
    throw "Expected a self-contained share link with the selected strategy."
  }
  if ($result.musterLink -notmatch "index\.html#army=fb2\.(gz|raw)\.") {
    throw "Expected Back to Muster to carry the shared army."
  }
  if (-not $result.qrPresent -or -not $result.touchTargets) {
    throw "Expected a local QR code and touch-sized Resolve controls."
  }

  [void](Invoke-BrowserExpression -Expression "globalThis.__FB_RELOAD_SENTINEL__ = true; location.reload(); true")
  Wait-ForBattleHook
  $restoreExpression = @'
(() => {
  const hook = globalThis.__FB_BATTLE__;
  const army = hook.getArmy();
  const beforeReset = hook.getCurrentResolve();
  const firstUnit = army.units[0];
  const retained = beforeReset[firstUnit.id];
  const originalConfirm = window.confirm;
  window.confirm = () => true;
  document.querySelector('#reset-battle').click();
  window.confirm = originalConfirm;
  return {
    retained,
    reset: hook.getCurrentResolve()[firstUnit.id],
    maximum: hook.getCalculatedArmy().units[0].stats.resolve * hook.getCalculatedArmy().units[0].stats.bases,
  };
})()
'@
  $restored = Invoke-BrowserExpression -Expression $restoreExpression
  if ($restored.retained -ne $result.afterDecrease -or $restored.reset -ne $restored.maximum) {
    throw "Expected Resolve to survive reload and Reset Resolve to restore the maximum."
  }

  [void](Invoke-BrowserExpression -Expression "document.querySelector('[data-muster-link]').click(); true")
  Wait-ForMusterHook -ExpectedArmyName $smokeName
  $musterReturn = Invoke-BrowserExpression -Expression @'
(() => {
  const state = globalThis.__FB_MUSTER__.getState();
  const stored = JSON.parse(localStorage.getItem('fantastic-battles-muster:v1') || 'null');
  return {
    armyName: state.armyName,
    unitCount: state.units.length,
    storedArmyName: stored?.armyName || '',
    hashCleared: location.hash === '',
  };
})()
'@
  if ($musterReturn.armyName -ne $smokeName -or $musterReturn.unitCount -ne 2 -or $musterReturn.storedArmyName -ne $smokeName -or -not $musterReturn.hashCleared) {
    throw "Expected Back to Muster to restore and save the shared army on an empty device."
  }

  [pscustomobject]@{
    army = $result.title
    cards = $result.cards
    resolveMaximum = $result.firstMaximum
    resolveAfterDecrease = $result.afterDecrease
    resolveRetainedAfterReload = $restored.retained
    backToMusterRestored = $true
    qrPresent = $result.qrPresent
    rulePopups = $result.ruleChecks
    shareLinkLength = $result.shareLink.Length
    viewport = $result.viewport
    overflowElements = $result.overflowElements
    barcodeDetectorSupported = $result.barcodeDetectorSupported
  } | ConvertTo-Json -Compress -Depth 4
}
finally {
  if ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    [void]$socket.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $token).GetAwaiter().GetResult()
  }
  $socket.Dispose()
}
