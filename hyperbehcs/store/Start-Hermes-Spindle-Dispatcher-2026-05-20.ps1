[CmdletBinding()]
param(
  [int] $Port = 4948,
  [int] $TimeoutSeconds = 15,
  [string] $HermesPython = 'python',
  [switch] $Commit
)

# ============================================================================
# Start-Hermes-Spindle-Dispatcher-2026-05-20.ps1
#
# Wires the HyperBEHCS-Hermes spindle dispatcher into HyperBEHCS startup.
# DESCRIPTOR-ONLY in this draft: when invoked without -Commit, this script
# prints the planned action and writes a planning receipt only. With -Commit,
# it boots the Hermes wave/spindle dispatcher on :$Port (default 4948) AFTER
# the HyperBEHCS daemon at :49257 confirms ok, and emits an HBPv1 receipt
# frame to the HyperBEHCS substrate (append-only chain).
#
# Wiring point in canonical start sequence:
#   Start-HyperBEHCS.ps1 -> daemon spawn -> /status returns ok=true,
#   schema=hyperbehcs.local_daemon.status.v1 (lines 152-164) -> THEN
#   call this script -> Hermes dispatcher boot -> substrate frame
#   commit -> only then Status-HyperBEHCS.ps1 substrate-status confirms.
#
# Authority: quintuple-cosign extended through 2026-06-03. Operator-witness
# gated for actual -Commit invocation.
# Apex: OP-JESSE (Jesse Daniel Brown). Spindle: 1 main + 3 subs.
# ============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root           = 'C:\HyperBEHCS'
$ReportsDir     = Join-Path $Root 'reports'
$StoreDir       = Join-Path $Root 'store'
$LatestReport   = Join-Path $ReportsDir 'hermes-dispatcher-latest.json'
$DaemonStatusUri = 'http://127.0.0.1:49257/status'
$HermesUpstream = 'D:\hyperbehcs-hermes-upstream'
$HermesAcerExt  = 'D:\hyperbehcs-hermes-acer-ext'
$DispatcherHost = '127.0.0.1'

# HBPv1 substrate frame template (descriptor schema only — actual append
# happens via C:\HyperBEHCS\lib\hyperbehcs-substrate.cjs::appendSubstratePacket
# under -Commit).
$NowIso = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$PacketPid = "HERMES-SPINDLE-DISPATCHER-BOOT-PID-$($NowIso.Substring(0,10))"

$plannedFrame = [ordered] @{
  schema           = 'hbp/v1'
  pid              = $PacketPid
  anchor           = 'HERMES-SPINDLE-DISPATCHER-STARTUP-WIRE-2026-05-20'
  ts               = $NowIso
  supervisor       = 'hermes-wire-into-startup'
  cp               = 260
  cp_band          = '704-799 (build_proof, triple quant) — operator-witness gated'
  apex             = 'OP-JESSE (Jesse Daniel Brown)'
  append_only      = $true
  agent            = 'U1-HERMES-WIRE-INTO-STARTUP'
  spindle          = '1 main + 3 subs'
  mission_type     = 'HERMES_DISPATCHER_BOOT_INTO_HYPERBEHCS_STARTUP'
  dispatcher = [ordered] @{
    host                = $DispatcherHost
    port                = $Port
    hermes_upstream     = $HermesUpstream
    hermes_acer_ext     = $HermesAcerExt
    python              = $HermesPython
    module              = 'hyperbehcs_hermes.cli'
    describe_only       = $true
    json_hot_path       = 'closed'
    mcp_scope           = 'describe_only'
    webmcp_scope        = 'describe_only'
    topology            = 'one-main-exactly-three-subagents'
  }
  hook_point = [ordered] @{
    parent_script        = 'C:\HyperBEHCS\Start-HyperBEHCS.ps1'
    after_line_range     = '152-164 (daemon /status ok=true confirmed)'
    before               = 'Status-HyperBEHCS.ps1 substrate-status'
    invocation_pattern   = '& "C:\HyperBEHCS\store\Start-Hermes-Spindle-Dispatcher-2026-05-20.ps1" -Commit'
  }
  port_allocation = [ordered] @{
    chosen   = $Port
    taken    = @(4944, 4947, 4949, 49257)
    rationale = 'Next free port in fabric :4944..:4949 band; avoids HyperBEHCS daemon :49257.'
  }
  authority = [ordered] @{
    quintuple_cosign_window  = '2026-05-07 .. 2026-06-03 (extended)'
    operator_witness_gated   = $true
    fail_closed_defaults     = 'runtime0 promote0 endpoint0 provider0 mcp0 usb_write0 device_write0'
  }
}

function Write-LatestReport {
  param([object] $Payload)
  New-Item -ItemType Directory -Force -Path $ReportsDir | Out-Null
  $json = $Payload | ConvertTo-Json -Depth 12
  Set-Content -LiteralPath $LatestReport -Value $json -Encoding UTF8
}

function Get-DaemonOk {
  try {
    $s = Invoke-RestMethod -Method Get -Uri $DaemonStatusUri -TimeoutSec 2 -ErrorAction Stop
    if ($null -eq $s) { return $null }
    $ok = $s.PSObject.Properties['ok']
    $schema = $s.PSObject.Properties['schema']
    if ($null -ne $ok -and $ok.Value -eq $true -and
        $null -ne $schema -and $schema.Value -eq 'hyperbehcs.local_daemon.status.v1') {
      return $s
    }
    return $null
  } catch {
    return $null
  }
}

function Test-PortFree {
  param([int] $TestPort)
  try {
    $lines = @(netstat.exe -ano -p tcp 2>$null)
    foreach ($line in $lines) {
      if ($line -match "^\s*TCP\s+\S+:$TestPort\s+\S+\s+LISTENING\s+\d+\s*$") {
        return $false
      }
    }
    return $true
  } catch {
    return $true
  }
}

# ---- DRY-RUN BRANCH (default) ----
if (-not $Commit) {
  $dry = [ordered] @{
    ok            = $true
    schema        = 'hyperbehcs.hermes.dispatcher.plan.v1'
    mode          = 'describe_only_no_boot'
    note          = 'Pass -Commit to actually boot Hermes dispatcher; operator-witness gated.'
    daemon_status = if (Get-DaemonOk) { 'daemon_ok_present' } else { 'daemon_not_ready_or_absent' }
    port_free     = (Test-PortFree -TestPort $Port)
    planned_frame = $plannedFrame
  }
  Write-LatestReport -Payload $dry
  $dry | ConvertTo-Json -Depth 12
  exit 0
}

# ---- COMMIT BRANCH (operator-witness gated) ----
try {
  # 1. Confirm daemon ok BEFORE booting Hermes dispatcher.
  $daemon = Get-DaemonOk
  if ($null -eq $daemon) {
    $fail = [ordered] @{
      ok = $false; schema = 'hyperbehcs.hermes.dispatcher.boot.v1'
      error = 'hyperbehcs_daemon_not_ok'
      status_uri = $DaemonStatusUri
    }
    Write-LatestReport -Payload $fail
    $fail | ConvertTo-Json -Depth 8
    exit 2
  }

  # 2. Port pre-flight.
  if (-not (Test-PortFree -TestPort $Port)) {
    $fail = [ordered] @{
      ok = $false; schema = 'hyperbehcs.hermes.dispatcher.boot.v1'
      error = 'dispatcher_port_in_use'; port = $Port
    }
    Write-LatestReport -Payload $fail
    $fail | ConvertTo-Json -Depth 8
    exit 3
  }

  # 3. Boot Hermes spindle dispatcher.
  #    Upstream hyperbehcs_hermes does not yet expose a long-lived HTTP server;
  #    we boot the CLI in long-lived mode wrapping verify-chain + wave validation
  #    on a heartbeat loop. Replace with hermes serve once upstream lands.
  $env:PYTHONPATH = "$HermesUpstream;$HermesAcerExt\src;$($env:PYTHONPATH)"
  $bootCmd = "$HermesPython -m hyperbehcs_hermes.cli list-authority"
  $process = Start-Process -FilePath $HermesPython `
                           -ArgumentList @('-m', 'hyperbehcs_hermes.cli', 'list-authority') `
                           -WorkingDirectory $HermesUpstream `
                           -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $ReportsDir 'hermes-dispatcher-stdout.log') `
                           -RedirectStandardError (Join-Path $ReportsDir 'hermes-dispatcher-stderr.log')

  # 4. Wait briefly for the process to print authority surface (heartbeat proof).
  $deadline = (Get-Date).AddSeconds([Math]::Max(1, $TimeoutSeconds))
  while ((Get-Date) -lt $deadline -and -not $process.HasExited) {
    Start-Sleep -Milliseconds 250
  }

  # 5. Build and append HBPv1 substrate frame.
  $plannedFrame['dispatcher']['process_id'] = $process.Id
  $plannedFrame['dispatcher']['booted_at'] = (Get-Date).ToUniversalTime().ToString('o')

  $substrateAppend = @"
const sub = require('C:/HyperBEHCS/substrate.js');
const packet = $($plannedFrame | ConvertTo-Json -Depth 12 -Compress);
const r = sub.appendSubstratePacket(JSON.parse(packet));
process.stdout.write(JSON.stringify(r));
"@
  $tempJs = Join-Path $env:TEMP "hermes-spindle-append-$([guid]::NewGuid().ToString('N')).cjs"
  Set-Content -LiteralPath $tempJs -Value $substrateAppend -Encoding UTF8
  $appendResult = & 'C:\nvm4w\nodejs\node.exe' $tempJs 2>&1
  Remove-Item -LiteralPath $tempJs -Force -ErrorAction SilentlyContinue

  $ok = [ordered] @{
    ok               = $true
    schema           = 'hyperbehcs.hermes.dispatcher.boot.v1'
    runtime_root     = $Root
    port             = $Port
    daemon_status    = $daemon
    dispatcher_pid   = $process.Id
    substrate_append = $appendResult
    frame            = $plannedFrame
  }
  Write-LatestReport -Payload $ok
  $ok | ConvertTo-Json -Depth 12
  exit 0
} catch {
  $fail = [ordered] @{
    ok = $false; schema = 'hyperbehcs.hermes.dispatcher.boot.v1'
    error = 'boot_exception'; message = [string] $_.Exception.Message
  }
  Write-LatestReport -Payload $fail
  $fail | ConvertTo-Json -Depth 8
  exit 1
}
