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

  click('[data-profile="Formed company"]');
  input('#unit-name', 'The Iron Guard', 'input');
  input('#unit-bases', '4', 'change');
  click('#racial-trait-button');
  click('[data-trait-name="Doughty"]');
  click('[data-trait-slot="0"]');
  click('[data-trait-name="Shieldwall"]');
  click('#save-unit-button');

  click('[data-profile="Warlord"]');
  input('#unit-name', 'Lady Rowan', 'input');
  input('#unit-relic', 'Blade of Unsurpassable Power', 'change');
  click('#save-unit-button');

  click('[data-strategy="Agent"]');

  const army = globalThis.__FB_MUSTER__.calculateArmy();
  return {
    units: globalThis.__FB_MUSTER__.getState().units.length,
    total: army.total,
    breakPoint: army.breakPoint,
    generals: army.roles.generals,
    issues: army.issues.length,
    displayedTotal: document.querySelector('#points-total').textContent,
    cards: document.querySelectorAll('.unit-card').length,
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
  if ($result.total -ne 243 -or $result.displayedTotal -ne "243") { throw "Expected a 243-point army." }
  if ($result.breakPoint -ne 3) { throw "Expected break point 3." }
  if ($result.generals -ne 1 -or $result.issues -ne 0) { throw "Expected a legal army with one general." }

  $result | ConvertTo-Json -Compress
}
finally {
  if ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    [void]$socket.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $token).GetAwaiter().GetResult()
  }
  $socket.Dispose()
}
