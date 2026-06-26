# Phase 4-E: Test Harness Hardening

## Goal

Solidify Phase 4 dry-run validation into repository-owned scripts instead of manual PowerShell blocks.

## Current baseline

Phase 4-D negative dry-run validation is stable on both repositories.

- xinbaijin: xinbaijin-phase4d-negative-dry-run-validation-stable
- xinbaijin-mcp: xinbaijin-mcp-phase4d-negative-dry-run-validation-stable

## Problems observed

- Manual PowerShell blocks are error-prone.
- GitHub Actions run selection must be restricted to baijin/real-review-shadow.
- Artifact download must retry and validate exact artifact content.
- Temporary files and local artifact directories must be safely cleaned.
- JSON parsing should avoid unstable displayTitle fields.
- Stale-base validation may intentionally fail the shadow comparison while dry-run artifact remains authoritative.

## Required deliverables

1. Standard reusable local test harness.
2. Explicit repo configuration for xinbaijin and xinbaijin-mcp.
3. Deterministic run selection by workflow and review commit.
4. Deterministic artifact validation.
5. Clear PASS / FAIL markers.
6. No production enforcement changes.
7. No Required Checks changes.

## Enforcement status

Production enforcement remains disabled during Phase 4-E.
