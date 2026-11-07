# Proves the start-up message for a moved or redirected AppData folder (electron/data-folder.cjs) on the
# real app: points KAPEVAULT_DATA_DIR (unpacked only) under a Roaming junction whose target is gone,
# starts the unpacked app, finds the dialog it shows, captures it with capture-window.ps1, then closes
# everything and removes the junction. A dialog WILL appear on screen for a few seconds.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/proof-data-folder.ps1 [-Out shot.png]
# Pass: one window titled "Error" (Windows' own caption) whose capture reads "KAPEVault could not start",
# and "data folder created: False". 0.1.4 showed "A JavaScript error occurred in the main process".
param([string]$Out = (Join-Path $env:TEMP 'kapevault-data-folder-proof.png'))
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Add-Type @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class KvWins {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public static List<RECT> Of(HashSet<uint> pids) {
    var r = new List<RECT>();
    EnumWindows((h, l) => { uint pid; GetWindowThreadProcessId(h, out pid);
      if (pids.Contains(pid) && IsWindowVisible(h)) { RECT x; GetWindowRect(h, out x); r.Add(x); }
      return true; }, IntPtr.Zero);
    return r; } }
"@
[void][KvWins]::SetProcessDPIAware()
$work = Join-Path $env:TEMP ("kapevault-proof-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory $work | Out-Null
$roaming = Join-Path $work 'Roaming'
cmd /c mklink /J "$roaming" (Join-Path $work 'moved-away') | Out-Null
try {
  $env:KAPEVAULT_DATA_DIR = Join-Path $roaming 'KAPEVault'
  # A VS Code terminal exports this, and electron.exe would then boot as plain Node.
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  $app = Start-Process -FilePath (Join-Path $repo 'node_modules\electron\dist\electron.exe') -ArgumentList "`"$repo`"" -PassThru
  Start-Sleep -Seconds 8
  $pids = New-Object 'System.Collections.Generic.HashSet[uint32]'
  Get-Process electron -ErrorAction SilentlyContinue | ForEach-Object { [void]$pids.Add([uint32]$_.Id) }
  $wins = [KvWins]::Of($pids)
  "app still running (dialog open): " + (-not $app.HasExited)
  "visible windows: " + $wins.Count
  if ($wins.Count -gt 0) {
    $r = $wins[0]
    & (Join-Path $PSScriptRoot 'capture-window.ps1') -x $r.L -y $r.T -w ($r.R - $r.L) -h ($r.B - $r.T) -out $Out
    "capture: $Out"
  }
  "data folder created: " + (Test-Path $env:KAPEVAULT_DATA_DIR)
} finally {
  Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$repo*" } | Stop-Process -Force
  Start-Sleep -Seconds 1
  cmd /c rmdir "$roaming"
  Remove-Item $work -Recurse -Force
}
