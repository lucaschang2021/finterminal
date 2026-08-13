# Post-build cleanup of intermediate artifacts (keeps final exe + backend exe).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/cleanup-after-build.ps1
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot

function Remove-DirIfExists([string]$path, [string]$label) {
  if (Test-Path -LiteralPath $path) {
    try {
      [System.IO.Directory]::Delete($path, $true)
      Write-Host "[cleanup] removed $label : $path"
    } catch {
      Write-Host "[cleanup] skipped $label (in use?) : $path"
    }
  }
}

# 1. electron-builder intermediate win-unpacked (final deliverables are Setup/portable exe)
Remove-DirIfExists (Join-Path $root 'release\win-unpacked') 'electron-builder win-unpacked'

# 2. PyInstaller work dir (backend exe in build/backend is kept)
Remove-DirIfExists (Join-Path $root 'build\pyinstaller_work') 'PyInstaller work dir'

# 3. Temp leftovers: PyInstaller onefile (_MEI*) and electron-builder NSIS temp (nsd*.tmp)
$tmp = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
if ($tmp -and (Test-Path -LiteralPath $tmp)) {
  $patterns = @('_MEI*', 'nsd*.tmp')
  foreach ($pat in $patterns) {
    Get-ChildItem -LiteralPath $tmp -Directory -Force -Filter $pat -ErrorAction SilentlyContinue |
      ForEach-Object {
        $full = [System.IO.Path]::GetFullPath($_.FullName)
        if ($full.StartsWith($tmp + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
          Remove-DirIfExists $full "Temp leftover ($pat)"
        }
      }
  }
}

Write-Host "[cleanup] done"
