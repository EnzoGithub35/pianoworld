#!/usr/bin/env pwsh
# =====================================================================
# PianoWorld - Setup Supabase local pour E2E Playwright
# =====================================================================
# Sprint 11 - boot Supabase local + apply schema.sql + apply seed.sql.
#
# Prerequis :
#   - Docker Desktop running
#   - Supabase CLI installe (scoop install supabase OU npm i -g supabase)
#
# Usage :
#   ./scripts/setup-e2e-db.ps1
#
# Pour reset entre 2 runs :
#   supabase db reset (efface tout, ne re-applique pas schema)
#   puis re-run ce script.
# =====================================================================

$ErrorActionPreference = "Continue"

# Resolve Supabase CLI
$sb = (Get-Command supabase -ErrorAction SilentlyContinue).Source
if (-not $sb) {
  $sb = Join-Path $env:USERPROFILE 'scoop\shims\supabase.exe'
  if (-not (Test-Path $sb)) {
    Write-Error "[FAIL] Supabase CLI introuvable. Installe via 'scoop install supabase' ou 'npm i -g supabase'."
    exit 1
  }
}

Write-Host "[1/4] Boot Supabase local stack (Docker)..." -ForegroundColor Cyan
& $sb start
if ($LASTEXITCODE -ne 0) {
  Write-Host "[INFO] Stack deja running ou warning - on continue." -ForegroundColor Yellow
}

$dbUrl = "postgresql://postgres:postgres@localhost:54322/postgres"

Write-Host "[2/4] Apply schema.sql..." -ForegroundColor Cyan
& $sb db reset --linked=false 2>&1 | Out-Null
psql $dbUrl -f supabase/schema.sql -v ON_ERROR_STOP=1 -q
if ($LASTEXITCODE -ne 0) {
  Write-Error "[FAIL] schema.sql apply failed."
  exit 1
}

Write-Host "[3/4] Apply e2e/fixtures/seed.sql..." -ForegroundColor Cyan
psql $dbUrl -f e2e/fixtures/seed.sql -v ON_ERROR_STOP=1 -q
if ($LASTEXITCODE -ne 0) {
  Write-Error "[FAIL] seed.sql apply failed."
  exit 1
}

Write-Host "[4/4] Verifie fixtures..." -ForegroundColor Cyan
$count = (psql $dbUrl -t -c "select count(*) from public.profiles where pseudo in ('alice_e2e','bob_e2e');" | Out-String).Trim()
if ($count -ne "2") {
  Write-Error "[FAIL] Fixtures manquantes (attendu 2 profiles, trouve $count)."
  exit 1
}

Write-Host ""
Write-Host "[OK] Setup E2E pret." -ForegroundColor Green
Write-Host "     API URL  : http://localhost:54321"
Write-Host "     DB URL   : $dbUrl"
Write-Host "     Studio   : http://localhost:54323"
Write-Host ""
Write-Host "Lance les tests :"
Write-Host "  npm run test:e2e"
