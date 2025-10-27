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
    Write-Host "Bumping version ($Bump) in package.json (no git commit/tag will be created)..."
    $pkgPath = Join-Path $PWD 'package.json'
    if (-not (Test-Path $pkgPath)) {
        Write-Error "package.json not found at $pkgPath"
        exit 1
    }
    $pkgText = Get-Content $pkgPath -Raw
    $pkg = $pkgText | ConvertFrom-Json
    $oldVersion = $pkg.version
    if (-not $oldVersion) {
        Write-Error "No version field found in package.json"
        exit 1
    }

    # Simple semver bump (ignore prerelease/build metadata)
    $parts = $oldVersion.Split('.')
    [int]$major = [int]$parts[0]
    [int]$minor = [int]$parts[1]
    [int]$patch = 0
    if ($parts.Length -ge 3) { $patch = [int]$parts[2] }

    switch ($Bump) {
        'patch' { $patch += 1 }
        'minor' { $minor += 1; $patch = 0 }
        'major' { $major += 1; $minor = 0; $patch = 0 }
    }

    $newVersion = "$major.$minor.$patch"
    $pkg.version = $newVersion
    # Write JSON preserving basic formatting
    # Write JSON without UTF-8 BOM so tooling that expects plain UTF-8 can parse it.
    $jsonOut = $pkg | ConvertTo-Json -Depth 10
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($pkgPath, $jsonOut, $utf8NoBom)
    Write-Host "Updated package.json version: $oldVersion -> $newVersion"
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
