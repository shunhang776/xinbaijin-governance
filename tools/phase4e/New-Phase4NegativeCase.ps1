param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("xinbaijin", "xinbaijin-mcp")]
  [string]$RepositoryKey,

  [Parameter(Mandatory = $true)]
  [ValidateSet("changes_requested", "blocked")]
  [string]$Case,

  [switch]$Push,

  [switch]$ValidateArtifact
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

if ($RepositoryKey -eq "xinbaijin") {
  $repoPath = "D:\google update\xinbaijin"
  $repoFull = "shunhang776/xinbaijin"
}

if ($RepositoryKey -eq "xinbaijin-mcp") {
  $repoPath = "D:\google update\xinbaijin-mcp"
  $repoFull = "shunhang776/xinbaijin-mcp"
}

if (-not $repoPath) {
  throw "UNKNOWN_REPOSITORY_KEY=$RepositoryKey"
}

if ($Case -eq "changes_requested") {
  $verdict = "changes_requested"
  $severity = "medium"
  $title = "Intentional changes_requested negative finding"
}

if ($Case -eq "blocked") {
  $verdict = "blocked"
  $severity = "high"
  $title = "Intentional blocked negative finding"
}

cd $repoPath

git fetch origin --prune
git switch dev
git pull origin dev

Remove-Item ".phase4d-artifacts" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".phase4e-artifacts-*" -Recurse -Force -ErrorAction SilentlyContinue

$dirty = git status --porcelain

if ($dirty) {
  $dirty | ForEach-Object { Write-Host $_ }
  throw "DIRTY_WORKTREE"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$candidateFile = "docs/PHASE4E-NEGATIVE-$($verdict.ToUpper())-$stamp.md"

$text = @(
  "# Phase 4-E Negative Case: $verdict",
  "",
  "This file creates a controlled non-review.json candidate commit.",
  "",
  "Expected result:",
  "",
  "- dry_run_result: denied",
  "- gate_result: denied",
  "- review_verdict: $verdict",
  "",
  "Timestamp: $stamp"
) -join "`n"

$absCandidate = Join-Path (Get-Location).Path $candidateFile
New-Item -ItemType Directory -Force (Split-Path $absCandidate -Parent) | Out-Null
[System.IO.File]::WriteAllText($absCandidate, $text + "`n", [System.Text.UTF8Encoding]::new($false))

git add $candidateFile
git commit -m "test(phase4e): create $verdict candidate"

if ($Push) {
  git push origin dev
}

$candidateSha = (git rev-parse HEAD | Select-Object -First 1).Trim()
$reviewedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")

$review = [ordered]@{
  protocol = "xinbaijin-review/1.0"
  repository = $repoFull
  branch = "dev"
  reviewed_commit = $candidateSha
  based_on_branch_head = $candidateSha
  verdict = $verdict
  summary = "Phase 4-E negative validation: intentionally $verdict to verify denied behavior."
  findings = @(
    [ordered]@{
      severity = $severity
      file = $candidateFile
      line = 1
      title = $title
      description = "This finding is intentionally created to verify denied behavior."
      recommendation = "No production action. This is a controlled Phase 4-E negative validation case."
    }
  )
  reviewer = "ChatGPT"
  reviewed_at = $reviewedAt
}

$json = ($review | ConvertTo-Json -Depth 20) + "`n"
[System.IO.File]::WriteAllText((Join-Path (Get-Location).Path "review.json"), $json, [System.Text.UTF8Encoding]::new($false))

git add review.json
git commit -m "test(phase4e): create $verdict review"

if ($Push) {
  git push origin dev
}

$reviewSha = (git rev-parse HEAD | Select-Object -First 1).Trim()

Write-Host "PHASE4E_NEGATIVE_CASE_CREATED"
Write-Host "REPOSITORY_KEY=$RepositoryKey"
Write-Host "REPOSITORY_FULL_NAME=$repoFull"
Write-Host "CASE=$Case"
Write-Host "CANDIDATE_COMMIT=$candidateSha"
Write-Host "REVIEW_COMMIT=$reviewSha"

if ($ValidateArtifact) {
  $validator = Join-Path $PSScriptRoot "Assert-Phase4DryRunArtifact.ps1"

  & $validator `
    -Repo $repoFull `
    -ReviewCommit $reviewSha `
    -ExpectedDryRunResult "denied" `
    -ExpectedGateResult "denied"
}
