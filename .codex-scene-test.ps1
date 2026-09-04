param(
  [int]$Port = 9226,
  [string]$Expression = '({guard:window.__andreaUniverseInitialized, scenes:document.querySelectorAll("[data-scene-index]").length, active:document.querySelector(".scene.is-active")?.dataset.sceneIndex, errors:window.__testErrors||[]})',
  [string]$Screenshot = '',
  [switch]$Reload,
  [switch]$ClearSession,
  [switch]$ReducedMotion,
  [int]$Width = 0,
  [int]$Height = 0,
  [int]$CpuRate = 0
)

$ErrorActionPreference = 'Stop'
$script:CdpId = 0
$script:Socket = $null

function Connect-Cdp {
  $targets = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/json/list" -f $Port) -TimeoutSec 3
  $target = $targets | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
  if (-not $target) { throw 'No page target.' }
  $script:Socket = [System.Net.WebSockets.ClientWebSocket]::new()
  $script:Socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
}

function Invoke-Cdp {
  param([Parameter(Mandatory)][string]$Method, [hashtable]$Params = @{})
  $script:CdpId += 1
  $requestId = $script:CdpId
  $payload = @{ id = $requestId; method = $Method; params = $Params } | ConvertTo-Json -Depth 60 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $segment = [ArraySegment[byte]]::new($bytes)
  $script:Socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null

  while ($true) {
    $stream = [IO.MemoryStream]::new()
    do {
      $buffer = New-Object byte[] 65536
      $chunk = [ArraySegment[byte]]::new($buffer)
      $received = $script:Socket.ReceiveAsync($chunk, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
      if ($received.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { throw 'CDP socket closed.' }
      $stream.Write($buffer, 0, $received.Count)
    } until ($received.EndOfMessage)
    $message = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
    if ($message.id -eq $requestId) {
      if ($message.error) { throw ($message.error | ConvertTo-Json -Compress) }
      return $message.result
    }
  }
}

function Eval-Js {
  param([Parameter(Mandatory)][string]$Code)
  $response = Invoke-Cdp -Method 'Runtime.evaluate' -Params @{ expression = $Code; returnByValue = $true; awaitPromise = $true; userGesture = $true }
  if ($response.exceptionDetails) { throw ($response.exceptionDetails | ConvertTo-Json -Depth 20 -Compress) }
  return $response.result.value
}

Connect-Cdp
Invoke-Cdp -Method 'Runtime.enable' | Out-Null
Invoke-Cdp -Method 'Page.enable' | Out-Null
Invoke-Cdp -Method 'Log.enable' | Out-Null
Invoke-Cdp -Method 'Page.addScriptToEvaluateOnNewDocument' -Params @{ source = 'window.__testErrors=[];addEventListener("error",e=>__testErrors.push(String(e.message||e.error)));addEventListener("unhandledrejection",e=>__testErrors.push(String(e.reason)));' } | Out-Null
$clearSessionScript = $null
if ($ClearSession) {
  $registration = Invoke-Cdp -Method 'Page.addScriptToEvaluateOnNewDocument' -Params @{ source = 'sessionStorage.clear();' }
  $clearSessionScript = $registration.identifier
}

if ($ReducedMotion) {
  Invoke-Cdp -Method 'Emulation.setEmulatedMedia' -Params @{ features = @(@{ name = 'prefers-reduced-motion'; value = 'reduce' }) } | Out-Null
} else {
  Invoke-Cdp -Method 'Emulation.setEmulatedMedia' -Params @{ features = @(@{ name = 'prefers-reduced-motion'; value = 'no-preference' }) } | Out-Null
}

if ($Width -gt 0 -and $Height -gt 0) {
  Invoke-Cdp -Method 'Emulation.setDeviceMetricsOverride' -Params @{ width = $Width; height = $Height; deviceScaleFactor = 1; mobile = $true; screenWidth = $Width; screenHeight = $Height } | Out-Null
}

if ($CpuRate -gt 0) {
  Invoke-Cdp -Method 'Emulation.setCPUThrottlingRate' -Params @{ rate = $CpuRate } | Out-Null
}

if ($Reload -or $ClearSession) {
  Invoke-Cdp -Method 'Page.reload' -Params @{ ignoreCache = $true } | Out-Null
  Start-Sleep -Milliseconds 1200
}

if ($clearSessionScript) {
  Invoke-Cdp -Method 'Page.removeScriptToEvaluateOnNewDocument' -Params @{ identifier = $clearSessionScript } | Out-Null
}

$value = Eval-Js -Code $Expression
$value | ConvertTo-Json -Depth 30

if ($Screenshot) {
  $capture = Invoke-Cdp -Method 'Page.captureScreenshot' -Params @{ format = 'png'; fromSurface = $true; captureBeyondViewport = $false }
  [IO.File]::WriteAllBytes($Screenshot, [Convert]::FromBase64String($capture.data))
}

$script:Socket.Dispose()
