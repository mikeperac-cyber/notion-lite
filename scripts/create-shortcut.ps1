param(
    [Parameter(Mandatory = $true)]
    [string]$ExecutablePath
)

$resolvedExe = (Resolve-Path -LiteralPath $ExecutablePath -ErrorAction Stop).Path
if ([IO.Path]::GetFileName($resolvedExe) -ne 'Notion Lite.exe') {
    throw 'Expected the installed Notion Lite.exe.'
}
$workingDirectory = Split-Path -Parent $resolvedExe
$candidateDesktopDirs = @(
    (Join-Path $env:USERPROFILE 'OneDrive\Desktop'),
    [Environment]::GetFolderPath('DesktopDirectory')
) | Select-Object -Unique
$shell = New-Object -ComObject WScript.Shell
foreach ($desktopDir in $candidateDesktopDirs) {
    if (-not (Test-Path -LiteralPath $desktopDir)) { continue }
    $shortcutPath = Join-Path $desktopDir 'Notion Lite.lnk'
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $resolvedExe
    $shortcut.Arguments = ''
    $shortcut.WorkingDirectory = $workingDirectory
    $shortcut.IconLocation = "$resolvedExe,0"
    $shortcut.Description = 'Open Notion Lite'
    $shortcut.Save()
    Write-Host "Updated $shortcutPath"
}
