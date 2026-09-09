Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType = WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

$current = $mgr.GetCurrentSession()
Write-Host "=== GetCurrentSession() ==="
if ($null -ne $current) {
    $props = Await ($current.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $info = $current.GetPlaybackInfo()
    Write-Host "  AppId  : $($current.SourceAppUserModelId)"
    Write-Host "  Title  : $($props.Title)"
    Write-Host "  Artist : $($props.Artist)"
    Write-Host "  Status : $($info.PlaybackStatus)"
} else {
    Write-Host "  null"
}

$sessions = $mgr.GetSessions()
$total = $sessions.Count
Write-Host ""
Write-Host "=== GetSessions() $total total ==="
$idx = 0
foreach ($s in $sessions) {
    $props = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $info = $s.GetPlaybackInfo()
    Write-Host "  [$idx] AppId  : $($s.SourceAppUserModelId)"
    Write-Host "  [$idx] Title  : $($props.Title)"
    Write-Host "  [$idx] Artist : $($props.Artist)"
    Write-Host "  [$idx] Status : $($info.PlaybackStatus)"
    $idx++
}
