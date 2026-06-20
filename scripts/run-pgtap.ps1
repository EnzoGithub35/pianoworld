#!/usr/bin/env pwsh
# =====================================================================
# PianoWorld - Runner pgTAP RLS tests
# =====================================================================
# Execute tous les tests pgTAP de supabase/tests/ contre la DB linkee.
# Parse les resultats pgTAP (plan(N) vs ok N / not ok N) et resume.
#
# Usage :
#   ./scripts/run-pgtap.ps1              # tous les tests
#   ./scripts/run-pgtap.ps1 -Setup       # re-install pgtap_helpers
#   ./scripts/run-pgtap.ps1 -Verbose     # output complet par test
#
# Prerequis :
#   - supabase CLI installee (scoop install supabase ou equivalent)
#   - supabase login + supabase link --project-ref <ref>
#   - extension pgtap installee sur la DB (one-time)
#
# Exit code : 0 si tous les tests passent, 1 si au moins un fail.

param(
  [switch]$Setup,
  [switch]$Verbose
)

# Ne PAS Stop sur stderr : supabase CLI ecrit "Initialising login role..." sur
# stderr a chaque call, qui n'est pas une erreur. On parse explicitement le
# output pour detecter les vraies erreurs SQL.
$ErrorActionPreference = "Continue"
$sb = "$env:USERPROFILE\scoop\shims\supabase.exe"

if (-not (Test-Path $sb)) {
  Write-Host "[ERROR] supabase CLI introuvable a $sb" -ForegroundColor Red
  Write-Host "        Installe via : scoop install supabase" -ForegroundColor Yellow
  exit 1
}

$testsDir = Join-Path $PSScriptRoot "..\supabase\tests"
if (-not (Test-Path $testsDir)) {
  Write-Host "[ERROR] Dossier supabase/tests/ introuvable" -ForegroundColor Red
  exit 1
}

# (Re-)Install helpers si demande
if ($Setup) {
  Write-Host "[SETUP] Re-installing pgtap_helpers schema..." -ForegroundColor Cyan
  $setupFile = Join-Path $testsDir "_setup.sql"
  & $sb db query --file $setupFile --linked 2>&1 | Out-Null
  Write-Host "        helpers installes." -ForegroundColor Green
}

# Recupere la liste des tests (prefixe NN_)
$testFiles = Get-ChildItem -Path $testsDir -Filter "*.sql" |
  Where-Object { $_.Name -match '^\d+_' } |
  Sort-Object Name

if ($testFiles.Count -eq 0) {
  Write-Host "[ERROR] Aucun test trouve dans $testsDir" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Running $($testFiles.Count) pgTAP test files..." -ForegroundColor Cyan
Write-Host ""

$totalRan = 0
$totalFailed = 0
$fileResults = @()

foreach ($test in $testFiles) {
  $name = $test.BaseName
  Write-Host -NoNewline "  $name ... "

  # Run le test et capture output
  $output = & $sb db query --file $test.FullName --linked 2>&1 | Out-String

  $errorMatch = ($output -match "unexpected status \d+") -or ($output -match "ERROR:")
  $planMismatchMatch = $output -match "planned (\d+) tests but ran (\d+)"
  $notOkMatch = $output -match "not ok"

  if ($errorMatch -and -not $planMismatchMatch) {
    $errMsg = if ($output -match "ERROR:\s*(.+?)(?:\\n|\r|$)") {
      $matches[1].Trim()
    } else {
      "(erreur SQL inconnue)"
    }
    Write-Host "[FAIL] SQL ERROR" -ForegroundColor Red
    Write-Host "       $errMsg" -ForegroundColor DarkRed
    $totalFailed += 1
    $fileResults += @{ name = $name; status = "SQL ERROR"; msg = $errMsg }
    if ($Verbose) { Write-Host $output -ForegroundColor DarkGray }
    continue
  }

  if ($notOkMatch) {
    Write-Host "[FAIL] ASSERTION FAILED" -ForegroundColor Red
    if ($output -match "not ok \d+ - (.+?)(?:\\n|\r|$)") {
      Write-Host "       $($matches[1].Trim())" -ForegroundColor DarkRed
    }
    $totalFailed += 1
    $fileResults += @{ name = $name; status = "FAIL" }
    if ($Verbose) { Write-Host $output -ForegroundColor DarkGray }
    continue
  }

  if ($planMismatchMatch) {
    $plannedN = [int]$matches[1]
    $ranN = [int]$matches[2]
    Write-Host "[WARN] PLAN MISMATCH ($plannedN planned, $ranN ran)" -ForegroundColor Yellow
    $totalFailed += 1
    $fileResults += @{ name = $name; status = "PLAN MISMATCH" }
    continue
  }

  # Recupere le dernier "ok N" pour avoir le compte
  $okCount = 0
  if ($output -match 'ok (\d+) -') {
    $okCount = [int]$matches[1]
  }

  Write-Host "[OK] $okCount assertions" -ForegroundColor Green
  $totalRan += $okCount
  $fileResults += @{ name = $name; status = "OK"; ran = $okCount }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($totalFailed -eq 0) {
  Write-Host "[SUCCESS] All $($testFiles.Count) test files pass ($totalRan assertions)" -ForegroundColor Green
  exit 0
} else {
  Write-Host "[FAILURE] $totalFailed file(s) failed of $($testFiles.Count)" -ForegroundColor Red
  foreach ($r in $fileResults | Where-Object { $_.status -ne "OK" }) {
    Write-Host "  - $($r.name): $($r.status)" -ForegroundColor Red
  }
  exit 1
}
