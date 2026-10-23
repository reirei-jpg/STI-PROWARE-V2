<#
    Starts STI PROWARE for testing in one go:
    - the website (server, queue worker, scheduler and Vite) in a window named "PROWARE Website";
    - the phone app's bundler (Metro) in a window named "PROWARE Phone App";
    - the phone app on every phone or emulator plugged in by USB;
    - the website in the browser.
    Anything of PROWARE still running from before is closed first, so nothing runs twice.

    Start:  powershell -ExecutionPolicy Bypass -File C:\Project\STI-PROWARE-V2\start-proware.ps1
    Stop:   powershell -ExecutionPolicy Bypass -File C:\Project\STI-PROWARE-V2\start-proware.ps1 -Stop
#>
param([switch]$Stop)

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$marker = 'PROWARE-DEV-WINDOW'
$herdBin = Join-Path $env:USERPROFILE '.config\herd\bin'
$herdPhp = Join-Path $herdBin 'php84'
$adb = 'C:\Android\Sdk\platform-tools\adb.exe'
$appPackage = 'sti.proware.v2'
$appLink = 'exp+sti-proware-v2://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'
$ports = 8000, 5173, 8081

function Say([string]$text, [string]$color = 'Gray') { Write-Host $text -ForegroundColor $color }

function Stop-Tree([int]$processId) {
    # "Not found" only means it had already closed.
    & cmd.exe /c "taskkill /PID $processId /T /F >nul 2>&1"
}

function Stop-Proware {
    $all = @(Get-CimInstance Win32_Process)
    $rootPattern = [regex]::Escape($root)

    # The windows this script opened, with everything running inside them.
    $all | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -match $marker -and $_.ProcessId -ne $PID } |
        ForEach-Object { Stop-Tree $_.ProcessId }

    # Copies started by hand (composer run dev, npm run dev, expo start).
    $all | Where-Object {
        $_.ProcessId -ne $PID -and $_.CommandLine -and (
            ($_.CommandLine -match $rootPattern -and (
                $_.CommandLine -match 'concurrently' -or
                ($_.CommandLine -match 'vite' -and $_.CommandLine -match '\sdev("|\s|$)') -or
                $_.CommandLine -match 'expo[\\/]bin[\\/]cli"?\s+start|expo start'
            )) -or
            ($_.CommandLine -match 'concurrently' -and $_.CommandLine -match 'artisan serve')
        )
    } | ForEach-Object { Stop-Tree $_.ProcessId }

    # Workers left behind when their window was closed.
    $alive = @(Get-CimInstance Win32_Process)
    $ids = $alive | ForEach-Object { $_.ProcessId }
    $alive | Where-Object {
        $_.Name -eq 'php.exe' -and $_.CommandLine -match 'artisan (serve|queue:listen|queue:work|schedule:work)' -and $ids -notcontains $_.ParentProcessId
    } | ForEach-Object { Stop-Tree $_.ProcessId }

    # A PHP or Node server still holding a PROWARE port (other programs are only reported).
    foreach ($port in $ports) {
        Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
            Where-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName -in 'php', 'node' } |
            ForEach-Object { Stop-Tree $_.OwningProcess }
    }

    # Without Vite running, this file would make pages load without their design.
    Remove-Item (Join-Path $root 'public\hot') -ErrorAction SilentlyContinue
}

function Wait-Until([string]$what, [scriptblock]$test, [int]$seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        try { if (& $test) { Say "  $what is ready." 'Green'; return $true } } catch { }
        Start-Sleep -Seconds 2
    }
    Say "  $what did not start within $seconds seconds. Check its window for the error." 'Red'
    return $false
}

function Get-WifiAddress {
    $address = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.InterfaceAlias -notmatch 'vEthernet|Virtual|VMware|WSL|Loopback' } |
        Sort-Object { $_.InterfaceAlias -notmatch 'Wi-?Fi|WLAN' } |
        Select-Object -First 1
    if ($address) { $address.IPAddress }
}

Say 'Closing PROWARE windows and servers from before...'
Stop-Proware
Start-Sleep -Seconds 1

if ($Stop) {
    Say 'STI PROWARE has been stopped.' 'Green'
    return
}

$busy = foreach ($port in $ports) { Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue }
if ($busy) {
    Say ("Port(s) " + (($busy | ForEach-Object LocalPort | Sort-Object -Unique) -join ', ') + ' are still in use by another program. Close it and run this again.') 'Red'
    exit 1
}
if (-not (Test-Path (Join-Path $herdPhp 'php.exe'))) {
    Say "Herd's PHP was not found at $herdPhp. Open Herd once and run this again." 'Red'
    exit 1
}

# Herd's PHP first: the other PHP on this laptop lacks the zip and intl extensions.
$path = "`$env:Path = '$herdPhp;$herdBin;' + `$env:Path"

Say 'Starting the website (server, queue worker, scheduler, Vite)...'
Start-Process powershell.exe -WorkingDirectory $root -ArgumentList @(
    '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command',
    "`$window = '$marker'; `$Host.UI.RawUI.WindowTitle = 'PROWARE Website'; $path; composer run dev"
)

Say 'Starting the phone app bundler (Metro)...'
Start-Process powershell.exe -WorkingDirectory (Join-Path $root 'mobile') -ArgumentList @(
    '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command',
    "`$window = '$marker'; `$Host.UI.RawUI.WindowTitle = 'PROWARE Phone App'; $path; npx expo start --dev-client --port 8081"
)

Say 'Waiting for everything to be ready...'
$hot = Join-Path $root 'public\hot'
$webReady = Wait-Until 'Website server' { (Invoke-WebRequest 'http://127.0.0.1:8000/up' -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200 } 90
$viteReady = Wait-Until 'Vite (page design)' { Test-Path $hot } 90
$metroReady = Wait-Until 'Metro (phone app)' { (Invoke-WebRequest 'http://127.0.0.1:8081/status' -UseBasicParsing -TimeoutSec 5).RawContent -match 'packager-status:running' } 120

if ($metroReady -and (Test-Path $adb)) {
    & $adb start-server 2>$null | Out-Null
    $devices = @(& $adb devices 2>$null | Select-String '^(\S+)\s+(device|unauthorized|offline)$' | ForEach-Object {
        [pscustomobject]@{ Serial = $_.Matches[0].Groups[1].Value; State = $_.Matches[0].Groups[2].Value }
    })
    if (-not $devices) {
        Say '  No phone is plugged in. Plug it in by USB and run this again, or use Wi-Fi (see below).' 'Yellow'
    }
    foreach ($device in $devices) {
        if ($device.State -ne 'device') {
            Say "  $($device.Serial) is $($device.State). Unlock the phone, tap Allow on the USB debugging prompt, and run this again." 'Yellow'
            continue
        }
        & $adb -s $device.Serial reverse tcp:8081 tcp:8081 2>$null | Out-Null
        & $adb -s $device.Serial reverse tcp:8000 tcp:8000 2>$null | Out-Null
        if (-not (& $adb -s $device.Serial shell pm list packages $appPackage 2>$null)) {
            Say "  $($device.Serial): the PROWARE app is not installed on this device." 'Yellow'
            continue
        }
        & $adb -s $device.Serial shell am force-stop $appPackage 2>$null | Out-Null
        & $adb -s $device.Serial shell am start -a android.intent.action.VIEW -d "'$appLink'" $appPackage 2>$null | Out-Null
        Say "  The PROWARE app has been opened on $($device.Serial)." 'Green'
    }
}

$wifi = Get-WifiAddress
if ($webReady) { Start-Process 'http://127.0.0.1:8000' }

Say ''
Say 'STI PROWARE is running.' 'Green'
Say '  Website on this laptop:   http://127.0.0.1:8000'
if ($wifi) {
    Say "  Website on the same Wi-Fi: http://${wifi}:8000"
    Say "  Phone app over Wi-Fi:      Server Address ${wifi}:8000 on the login screen"
}
Say '  Phone app over USB:        Server Address localhost:8000 (already set up by this script)'
Say ''
Say 'Keep the two PROWARE windows open while testing. To stop everything:'
Say "  powershell -ExecutionPolicy Bypass -File `"$root\start-proware.ps1`" -Stop"
if (-not ($webReady -and $viteReady -and $metroReady)) { exit 1 }
