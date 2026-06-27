import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('L4 pipeline dry-run workflow', () => {
  it('defines a pull_request and workflow_dispatch dry-run workflow', () => {
    const workflow = readText('.github/workflows/l4-pipeline-dry-run.yml');

    expect(workflow).toContain('name: L4 Pipeline Dry Run');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('l4-pipeline-dry-run:');
  });

  it('runs tests and L4 pipeline CLI before uploading artifacts', () => {
    const workflow = readText('.github/workflows/l4-pipeline-dry-run.yml');

    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('scripts/l4/build-dry-run-input.mjs');
    expect(workflow).toContain('src/l4/l4-pipeline-cli.mjs');
    expect(workflow).toContain('artifacts/l4/l4-run-result.json');
    expect(workflow).toContain('scripts/l4/write-dry-run-summary.mjs');
    expect(workflow).toContain('GITHUB_STEP_SUMMARY');
    expect(workflow).toContain('scripts/l4/write-dry-run-pr-comment.mjs');
    expect(workflow).toContain('artifacts/l4/l4-pr-comment.md');
    expect(workflow).toContain('actions/upload-artifact@v4');
  });

  it('does not use privileged pull_request_target or write operations', () => {
    const workflow = readText('.github/workflows/l4-pipeline-dry-run.yml');

    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('git push');
    expect(workflow).not.toContain('gh pr merge');
    expect(workflow).not.toContain('pull-requests: write');
    expect(workflow).not.toContain('gh pr comment');
    expect(workflow).not.toContain('submit_review');
  });
});
