param(
  [Parameter(Mandatory = $true)]
  [string]$Repo,

  [Parameter(Mandatory = $true)]
  [string]$ReviewCommit,

  [string]$Workflow = "baijin/real-review-shadow",

  [string]$Branch = "dev",

  [string]$ArtifactName = "production-gate-dry-run-result",

  [string]$ExpectedDryRunResult = "denied",

  [string]$ExpectedGateResult = "denied",

  [int]$RunLookupAttempts = 36,

  [int]$ArtifactDownloadAttempts = 12
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

function Fail {
  param([string]$Message)
  Write-Host "PHASE4E_HARNESS_FAIL=$Message"
  throw $Message
}

function Require-Command {
  param([string]$Name)
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Fail "COMMAND_NOT_FOUND=$Name"
  }
}

Require-Command "gh"
Require-Command "git"

if ($ReviewCommit -notmatch "^[0-9a-f]{40}$") {
  Fail "INVALID_REVIEW_COMMIT=$ReviewCommit"
}

Write-Host "REPO=$Repo"
Write-Host "WORKFLOW=$Workflow"
Write-Host "BRANCH=$Branch"
Write-Host "REVIEW_COMMIT=$ReviewCommit"

$run = $null

for ($i = 0; $i -lt $RunLookupAttempts; $i++) {
  $runsRaw = gh run list `
    --repo $Repo `
    --workflow $Workflow `
    --branch $Branch `
    --limit 30 `
    --json databaseId,headSha,status,conclusion

  if ($LASTEXITCODE -ne 0) {
    Fail "GH_RUN_LIST_FAILED"
  }

  $runs = $runsRaw | ConvertFrom-Json
  $run = $runs | Where-Object { $_.headSha -eq $ReviewCommit } | Select-Object -First 1

  if ($run) {
    break
  }

  Start-Sleep -Seconds 5
}

if (-not $run) {
  gh run list --repo $Repo --workflow $Workflow --branch $Branch --limit 10
  Fail "REAL_REVIEW_RUN_NOT_FOUND=$ReviewCommit"
}

$runId = $run.databaseId
Write-Host "RUN_ID=$runId"

$watchOutput = gh run watch $runId --repo $Repo 2>&1
$watchOutput | ForEach-Object { Write-Host $_ }

gh run view $runId --repo $Repo

$artifactDir = ".phase4e-artifacts-$runId"

Remove-Item $artifactDir -Recurse -Force -ErrorAction SilentlyContinue

$downloadOk = $false

for ($i = 0; $i -lt $ArtifactDownloadAttempts; $i++) {
  $downloadOutput = gh run download $runId `
    --repo $Repo `
    --name $ArtifactName `
    --dir $artifactDir 2>&1

  $downloadOutput | ForEach-Object { Write-Host $_ }

  if ($LASTEXITCODE -eq 0) {
    $downloadOk = $true
    break
  }

  Start-Sleep -Seconds 5
}

if (-not $downloadOk) {
  Fail "ARTIFACT_DOWNLOAD_FAILED=$ArtifactName"
}

$resultFile = Get-ChildItem $artifactDir -Recurse -Filter "production-gate-dry-run-result.json" | Select-Object -First 1

if (-not $resultFile) {
  Fail "DRY_RUN_RESULT_JSON_NOT_FOUND"
}

$resultRaw = Get-Content $resultFile.FullName -Raw
$result = $resultRaw | ConvertFrom-Json

$resultRaw

if ($result.dry_run_result -ne $ExpectedDryRunResult) {
  Fail "DRY_RUN_RESULT_MISMATCH actual=$($result.dry_run_result) expected=$ExpectedDryRunResult"
}

if ($result.gate_result -ne $ExpectedGateResult) {
  Fail "GATE_RESULT_MISMATCH actual=$($result.gate_result) expected=$ExpectedGateResult"
}

if ($result.review_commit -ne $ReviewCommit) {
  Fail "REVIEW_COMMIT_MISMATCH actual=$($result.review_commit) expected=$ReviewCommit"
}

Write-Host "PHASE4E_DRY_RUN_ARTIFACT_VALIDATION_PASSED"
Write-Host "RUN_ID=$runId"
Write-Host "DRY_RUN_RESULT=$($result.dry_run_result)"
Write-Host "GATE_RESULT=$($result.gate_result)"
Write-Host "REVIEW_COMMIT=$($result.review_commit)"
