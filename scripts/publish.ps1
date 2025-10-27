# Helper script to bump, compile, package and optionally publish this VS Code extension.
# Usage examples:
#   .\scripts\publish.ps1 -Bump patch -Publish
#   .\scripts\publish.ps1 -Bump none -PackageOnly

param(
    [ValidateSet('patch','minor','major','none')]
    [string]$Bump = 'patch',
    [switch]$Publish,
    [switch]$PackageOnly,
    [switch]$Install,
    [string]$PAT
)

Set-StrictMode -Version Latest

try {
    # Change to repository root (parent of the scripts directory). When running a script,
    # $PSScriptRoot points to the folder containing this script. We want the repo root
    # which is the parent of that folder.
    $repoRoot = Resolve-Path -Path (Join-Path $PSScriptRoot '..')
    Set-Location $repoRoot
} catch {
    Write-Error "Failed to set location to repository root: $_"
}

Write-Host "Working directory: $PWD"

if ($Bump -ne 'none') {
    Write-Host "Bumping version ($Bump)..."
    npm version $Bump -m "chore(release): %s [skip ci]" 2>&1 | Write-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "npm version returned exit code $LASTEXITCODE. Continuing anyway."
    }
}

Write-Host "Compiling TypeScript..."
npm run compile
if ($LASTEXITCODE -ne 0) {
    Write-Error "TypeScript compile failed (exit code $LASTEXITCODE). Aborting."
    exit $LASTEXITCODE
}

Write-Host "Packaging extension (.vsix)..."
npx vsce package
if ($LASTEXITCODE -ne 0) {
    Write-Error "vsce package failed (exit code $LASTEXITCODE). Aborting."
    exit $LASTEXITCODE
}

$vsix = Get-ChildItem -Path $PWD -Filter "*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $vsix) {
    Write-Error "No .vsix file found in $PWD"
    exit 1
}

Write-Host "Created package: $($vsix.Name)"

if ($Install) {
    Write-Host "Installing $($vsix.Name) locally..."
    code --install-extension $vsix.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "code --install-extension returned exit code $LASTEXITCODE"
    }
}

if ($PackageOnly -and -not $Publish) {
    Write-Host "Package created; exiting because -PackageOnly was specified."
    exit 0
}

if ($Publish) {
    if (-not $PAT) {
        Write-Host "Publish requested but no PAT provided. You will be prompted to paste it (input hidden)."
        $secure = Read-Host -AsSecureString "Paste VSCE PAT"
        $PAT = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    }

    if (-not $PAT) {
        Write-Error "No PAT provided; cannot publish."
        exit 1
    }

    Write-Host "Publishing via vsce..."
    $env:VSCE_PAT = $PAT
    npx vsce publish
    $rc = $LASTEXITCODE
    Remove-Item Env:VSCE_PAT -ErrorAction SilentlyContinue
    if ($rc -ne 0) {
        Write-Error "vsce publish failed (exit code $rc)"
        exit $rc
    }
    Write-Host "Publish complete."
}

Write-Host "All done."
