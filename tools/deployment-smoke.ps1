param(
  [int]$DebugPort = 9222,
  [string]$ScreenshotPath = "",
  [int]$ViewportWidth = 1440,
  [int]$ViewportHeight = 1000
)

$pages = Invoke-RestMethod -Uri "http://127.0.0.1:$DebugPort/json"
$page = $pages | Where-Object { $_.type -eq "page" -and $_.url -like "http://127.0.0.1:8765/deployment.html*" } | Select-Object -First 1
if (-not $page) {
  throw "Fantastic Battles deployment page was not found on Chrome debugging port $DebugPort."
}

$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$token = [System.Threading.CancellationToken]::None
[void]$socket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $token).GetAwaiter().GetResult()
$nextId = 0

function Invoke-CdpCommand {
  param([string]$Method, [hashtable]$Params)
  $script:nextId += 1
  $payload = @{ id = $script:nextId; method = $Method; params = $Params } | ConvertTo-Json -Compress -Depth 12
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $segment = [System.ArraySegment[byte]]::new($bytes)
  [void]$socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $token).GetAwaiter().GetResult()

  do {
    $builder = [System.Text.StringBuilder]::new()
    do {
      $buffer = [byte[]]::new(65536)
      $receiveSegment = [System.ArraySegment[byte]]::new($buffer)
      $received = $socket.ReceiveAsync($receiveSegment, $token).GetAwaiter().GetResult()
      [void]$builder.Append([System.Text.Encoding]::UTF8.GetString($buffer, 0, $received.Count))
    } until ($received.EndOfMessage)
    $message = $builder.ToString() | ConvertFrom-Json
  } until ($message.id -eq $script:nextId)

  if ($message.error) { throw $message.error.message }
  return $message.result
}

try {
  [void](Invoke-CdpCommand -Method "Emulation.setDeviceMetricsOverride" -Params @{
    width = $ViewportWidth
    height = $ViewportHeight
    deviceScaleFactor = 1
    mobile = $false
  })
  [void](Invoke-CdpCommand -Method "Page.reload" -Params @{ ignoreCache = $true })
  Start-Sleep -Milliseconds 200
  [void](Invoke-CdpCommand -Method "Runtime.evaluate" -Params @{
    expression = "new Promise((resolve, reject) => { const started = Date.now(); const timer = setInterval(() => { if (globalThis.__FB_DEPLOYMENT__) { clearInterval(timer); resolve(); } else if (Date.now() - started > 3000) { clearInterval(timer); reject(new Error('Deployment page did not initialise.')); } }, 30); })"
    awaitPromise = $true
  })
  $expression = @'
(async () => {
  if (!globalThis.__FB_DEPLOYMENT__) throw new Error('Deployment page did not initialise.');
  globalThis.__FB_DEPLOYMENT__.reset();
  const initial = globalThis.__FB_DEPLOYMENT__.getPlan();
  const zone = document.querySelector('#deployment-zone');
  const square = zone.querySelector('.deployment-piece.is-company');
  const circle = zone.querySelector('.deployment-piece.is-character');
  if (!square || !circle) throw new Error('Expected both company and character markers.');

  const pieceId = square.dataset.pieceId;
  const bounds = zone.getBoundingClientRect();
  const squareBounds = square.getBoundingClientRect();
  const squareLayer = Number(getComputedStyle(square).zIndex);
  const characterLayer = Number(getComputedStyle(circle).zIndex);
  square.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, cancelable: true, pointerId: 71, pointerType: 'mouse', button: 0,
    clientX: squareBounds.left + squareBounds.width / 2,
    clientY: squareBounds.top + squareBounds.height / 2,
  }));
  zone.dispatchEvent(new PointerEvent('pointermove', {
    bubbles: true, cancelable: true, pointerId: 71, pointerType: 'mouse', buttons: 1,
    clientX: bounds.right - 1, clientY: bounds.bottom - 1,
  }));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const liveTranslate = getComputedStyle(square).translate;
  const liveInlineTranslate = square.style.translate;
  const liveDraggingClass = square.classList.contains('is-dragging');
  const liveBounds = square.getBoundingClientRect();
  const liveVisualMoved = Math.abs(liveBounds.left - squareBounds.left) > 1 || Math.abs(liveBounds.top - squareBounds.top) > 1;
  const livePrintMatches = matchMedia('print').matches;
  const livePiece = globalThis.__FB_DEPLOYMENT__.getPlan().pieces.find(({ id }) => id === pieceId);
  const initialPiece = initial.pieces.find(({ id }) => id === pieceId);
  const liveModelUncommitted = livePiece.x === initialPiece.x && livePiece.y === initialPiece.y;
  zone.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, cancelable: true, pointerId: 71, pointerType: 'mouse', button: 0,
    clientX: bounds.right - 1, clientY: bounds.bottom - 1,
  }));

  const moved = globalThis.__FB_DEPLOYMENT__.getPlan().pieces.find(({ id }) => id === pieceId);
  const saved = JSON.parse(localStorage.getItem('fantastic-battles-deployment:v1'));

  globalThis.__FB_DEPLOYMENT__.reset();
  const resetZone = document.querySelector('#deployment-zone');
  const resetBounds = resetZone.getBoundingClientRect();
  resetZone.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, cancelable: true, pointerId: 72, pointerType: 'mouse', button: 0,
    clientX: resetBounds.left + 2, clientY: resetBounds.top + 2,
  }));
  resetZone.dispatchEvent(new PointerEvent('pointermove', {
    bubbles: true, cancelable: true, pointerId: 72, pointerType: 'mouse', buttons: 1,
    clientX: resetBounds.right - 2, clientY: resetBounds.bottom - 2,
  }));
  resetZone.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, cancelable: true, pointerId: 72, pointerType: 'mouse', button: 0,
    clientX: resetBounds.right - 2, clientY: resetBounds.bottom - 2,
  }));
  const groupSelection = globalThis.__FB_DEPLOYMENT__.getSelection();
  const beforeGroupMove = globalThis.__FB_DEPLOYMENT__.getPlan().pieces;
  const groupAnchor = resetZone.querySelector('.deployment-piece.is-character');
  const anchorBounds = groupAnchor.getBoundingClientRect();
  groupAnchor.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, cancelable: true, pointerId: 73, pointerType: 'mouse', button: 0,
    clientX: anchorBounds.left + anchorBounds.width / 2,
    clientY: anchorBounds.top + anchorBounds.height / 2,
  }));
  resetZone.dispatchEvent(new PointerEvent('pointermove', {
    bubbles: true, cancelable: true, pointerId: 73, pointerType: 'mouse', buttons: 1,
    clientX: anchorBounds.left + anchorBounds.width / 2 - 30,
    clientY: anchorBounds.top + anchorBounds.height / 2 - 10,
  }));
  resetZone.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, cancelable: true, pointerId: 73, pointerType: 'mouse', button: 0,
    clientX: anchorBounds.left + anchorBounds.width / 2 - 30,
    clientY: anchorBounds.top + anchorBounds.height / 2 - 10,
  }));
  const afterGroupMove = globalThis.__FB_DEPLOYMENT__.getPlan().pieces;
  const groupDeltas = afterGroupMove.map((piece, index) => ({
    x: piece.x - beforeGroupMove[index].x,
    y: piece.y - beforeGroupMove[index].y,
  }));
  const groupMovedTogether = groupDeltas.every((delta) =>
    Math.abs(delta.x - groupDeltas[0].x) < .002 && Math.abs(delta.y - groupDeltas[0].y) < .002)
    && (Math.abs(groupDeltas[0].x) > .01 || Math.abs(groupDeltas[0].y) > .01);
  return {
    pieces: initial.pieces.length,
    companies: initial.pieces.filter(({ kind }) => kind === 'company').length,
    characters: initial.pieces.filter(({ kind }) => kind === 'character').length,
    squares: zone.querySelectorAll('.deployment-piece.is-company').length,
    circles: zone.querySelectorAll('.deployment-piece.is-character').length,
    legendItems: document.querySelectorAll('#deployment-legend > li').length,
    legendText: document.querySelector('#deployment-legend').textContent,
    characterTooltip: circle.title,
    ratio: bounds.width / bounds.height,
    squareRatio: squareBounds.width / squareBounds.height,
    squareLayer,
    characterLayer,
    movedX: moved.x,
    movedY: moved.y,
    savedX: saved.positions[pieceId].x,
    savedY: saved.positions[pieceId].y,
    groupSelected: groupSelection.length,
    groupMovedTogether,
    liveTranslate,
    liveInlineTranslate,
    liveDraggingClass,
    liveVisualMoved,
    livePrintMatches,
    liveModelUncommitted,
    armyTitle: document.querySelector('#deployment-title').textContent,
    scrollClientWidth: document.querySelector('#deployment-scroll').clientWidth,
    scrollWidth: document.querySelector('#deployment-scroll').scrollWidth,
    scrollLeft: document.querySelector('#deployment-scroll').scrollLeft,
  };
})()
'@
  $result = Invoke-CdpCommand -Method "Runtime.evaluate" -Params @{ expression = $expression; returnByValue = $true; awaitPromise = $true }
  if ($result.exceptionDetails) { throw $result.exceptionDetails.exception.description }
  $value = $result.result.value

  if ($value.pieces -ne 5 -or $value.companies -ne 4 -or $value.characters -ne 1) { throw "Expected four company bases and one character." }
  if ($value.squares -ne 4 -or $value.circles -ne 1 -or $value.legendItems -ne 2) { throw "Deployment DOM markers or legend were incorrect." }
  if ($value.legendText -notlike "*Relic: Mystical Tome of Revelation*") { throw "Expected character relics in the deployment key." }
  if ($value.legendText -notlike "*Spells: Bless L2, Blink L1, Summon L1*") { throw "Expected character spells in the deployment key." }
  if ($value.characterTooltip -notlike "*relic: Mystical Tome of Revelation*") { throw "Expected character relics in marker tooltips." }
  if ([Math]::Abs($value.ratio - (13 / 3)) -gt .02 -or [Math]::Abs($value.squareRatio - 1) -gt .02) { throw "Deployment geometry was not proportional." }
  if ($value.characterLayer -le $value.squareLayer) { throw "Expected character markers to sit above company bases." }
  if ($value.movedX -ne 150 -or $value.movedY -ne 30 -or $value.savedX -ne 150 -or $value.savedY -ne 30) { throw "Drag did not clamp and persist at the zone boundary." }
  if (-not $value.liveVisualMoved -or $value.liveTranslate -eq "none" -or -not $value.liveInlineTranslate -or -not $value.liveDraggingClass -or -not $value.liveModelUncommitted) { throw "Expected compositor-only live dragging before coordinates commit on release (translate: $($value.liveTranslate); inline: $($value.liveInlineTranslate); visual: $($value.liveVisualMoved); class: $($value.liveDraggingClass); model: $($value.liveModelUncommitted); print: $($value.livePrintMatches))." }
  if ($value.groupSelected -ne 5 -or -not $value.groupMovedTogether) { throw "Expected marquee selection and group dragging to move all markers together." }

  [void](Invoke-CdpCommand -Method "Emulation.setEmulatedMedia" -Params @{ media = "print" })
  $printExpression = @'
(async () => {
  await new Promise((resolve) => setTimeout(resolve, 60));
  return ({
  printMatches: matchMedia('print').matches,
  headerDisplay: getComputedStyle(document.querySelector('.deployment-header')).display,
  pageBackground: getComputedStyle(document.body).backgroundColor,
  pieceBackground: getComputedStyle(document.querySelector('.deployment-piece')).backgroundColor,
  printRuleFound: [...document.styleSheets].some((sheet) => {
    try { return [...sheet.cssRules].some((rule) => rule.cssText.includes('@media print') && rule.cssText.includes('.deployment-piece')); }
    catch { return false; }
  }),
  });
})()
'@
  $printResult = Invoke-CdpCommand -Method "Runtime.evaluate" -Params @{ expression = $printExpression; returnByValue = $true; awaitPromise = $true }
  if ($printResult.exceptionDetails) { throw $printResult.exceptionDetails.exception.description }
  $printValue = $printResult.result.value
  if (-not $printValue.printMatches -or $printValue.headerDisplay -ne "none") { throw "Low-ink print mode did not activate." }
  if ($printValue.pageBackground -ne "rgb(255, 255, 255)" -or $printValue.pieceBackground -ne "rgb(255, 255, 255)") {
    throw "Print mode should use white backgrounds (page: $($printValue.pageBackground); piece: $($printValue.pieceBackground); rule: $($printValue.printRuleFound))."
  }

  $pdf = Invoke-CdpCommand -Method "Page.printToPDF" -Params @{ landscape = $true; printBackground = $true; preferCSSPageSize = $true }
  $pdfBytes = [Convert]::FromBase64String($pdf.data)
  $pdfText = [System.Text.Encoding]::ASCII.GetString($pdfBytes)
  $pageCount = [regex]::Matches($pdfText, "/Type\s*/Page(?!s)").Count
  if ($pdfBytes.Length -lt 1000 -or $pageCount -ne 1) { throw "Expected a non-empty, single-page deployment PDF." }

  [void](Invoke-CdpCommand -Method "Emulation.setEmulatedMedia" -Params @{ media = "screen" })
  [void](Invoke-CdpCommand -Method "Runtime.evaluate" -Params @{
    expression = "new Promise((resolve) => setTimeout(resolve, 160))"
    awaitPromise = $true
  })
  if ($ScreenshotPath) {
    [void](Invoke-CdpCommand -Method "Runtime.evaluate" -Params @{
      expression = "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
      awaitPromise = $true
    })
    $capture = Invoke-CdpCommand -Method "Page.captureScreenshot" -Params @{ format = "png"; fromSurface = $true }
    [System.IO.File]::WriteAllBytes($ScreenshotPath, [Convert]::FromBase64String($capture.data))
  }
  $value | ConvertTo-Json -Compress
}
finally {
  if ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    [void]$socket.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $token).GetAwaiter().GetResult()
  }
  $socket.Dispose()
}
