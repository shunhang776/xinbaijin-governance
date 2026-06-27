import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('Phase5 manual approval draft workflow', () => {
  it('is manually triggered and read-only', () => {
    const workflow = readText('.github/workflows/phase5-manual-approval-draft.yml');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('permissions:');
    expect(workflow).toContain('contents: read');

    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('pull-requests: write');
    expect(workflow).not.toContain('issues: write');
  });

  it('builds Phase5 enablement and readiness artifacts', () => {
    const workflow = readText('.github/workflows/phase5-manual-approval-draft.yml');

    expect(workflow).toContain('scripts/phase5/build-phase5-manual-approval.mjs');
    expect(workflow).toContain('phase5-enablement.json');
    expect(workflow).toContain('phase5-readiness.json');
    expect(workflow).toContain('phase5-manual-approval-draft');
  });

  it('does not perform production write actions', () => {
    const workflow = readText('.github/workflows/phase5-manual-approval-draft.yml');

    expect(workflow).not.toContain('git push');
    expect(workflow).not.toContain('gh pr merge');
    expect(workflow).not.toContain('gh pr comment');
    expect(workflow).not.toContain('submit_review');
    expect(workflow).not.toContain('review.json');
    expect(workflow).not.toContain('--production-enabled "true"');
  });
});
