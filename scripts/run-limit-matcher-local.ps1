param(
    [ValidateRange(10, 3600)]
    [int]$IntervalSeconds = 30
)

$ErrorActionPreference = "Stop"

# Resolve the Sunrovo project directory.
$projectRoot = Split-Path -Parent $PSScriptRoot

$envPath = Join-Path $projectRoot ".env"

$featureFlagPath = Join-Path $projectRoot "lib\feature-flags.ts"

$matcherUrl = "http://127.0.0.1:3000/api/internal/crypto/match-limit-orders"

# Verify configuration files exist.
if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Missing .env file."
}

if (-not (Test-Path -LiteralPath $featureFlagPath)) {
    throw "Missing feature-flags.ts file."
}

# Read the matcher secret from .env
$secretLine = Get-Content -LiteralPath $envPath |
    Where-Object {
        $_ -match '^\s*CRYPTO_MATCHER_SECRET\s*='
    } |
    Select-Object -Last 1

if (-not $secretLine) {
    throw "CRYPTO_MATCHER_SECRET is not configured."
}

$secret = (
    $secretLine -replace '^\s*CRYPTO_MATCHER_SECRET\s*=\s*', ''
).Trim().Trim('"').Trim("'")

if ($secret.Length -lt 32) {
    throw "Matcher secret must contain at least 32 characters."
}

# Prepare authenticated request.
$headers = @{
    Authorization = "Bearer $secret"
}

Write-Host ""
Write-Host "Sunrovo Finance - Local Limit Order Scheduler"
Write-Host "---------------------------------------------"
Write-Host "Interval: $IntervalSeconds seconds"
Write-Host "Mode: Safety verification only"
Write-Host "Press Ctrl+C to stop."
Write-Host ""

while ($true) {

    # Safety: this local verification script must never
    # invoke the matcher with trading enabled.
    $flagSource = Get-Content `
        -LiteralPath $featureFlagPath `
        -Raw

    if (
        $flagSource -notmatch
        'export\s+const\s+CRYPTO_TRADING_ENABLED\s*=\s*false\s*;'
    ) {
        throw "SAFETY: Trading flag is not explicitly disabled. Scheduler stopped."
    }

    try {

        $result = Invoke-RestMethod `
            -Uri $matcherUrl `
            -Method POST `
            -Headers $headers `
            -TimeoutSec 20

    }
    catch {

        Write-Warning "Matcher request failed: $($_.Exception.Message)"

        Start-Sleep -Seconds $IntervalSeconds

        continue
    }

    # A successful response must confirm trading is disabled.
    if ($result.disabled -ne $true) {
        throw "SAFETY: Unexpected matcher response. Scheduler stopped."
    }

    $timestamp = Get-Date -Format "HH:mm:ss"

    Write-Host "[$timestamp] Matcher connected successfully."

    Write-Host "  Trading disabled: $($result.disabled)"
    Write-Host "  Orders scanned:   $($result.scanned)"
    Write-Host "  Orders filled:    $($result.filled)"

    Write-Host ""

    Start-Sleep -Seconds $IntervalSeconds
}