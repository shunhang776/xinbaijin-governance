import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('Gate production draft workflow', () => {
  it('is manually triggered and uses read-only permissions', () => {
    const workflow = readText('.github/workflows/gate-production-draft.yml');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('permissions:');
    expect(workflow).toContain('contents: read');

    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('pull-requests: write');
    expect(workflow).not.toContain('issues: write');
  });

  it('builds a Gate production decision draft from L4 and ChatGPT review results', () => {
    const workflow = readText('.github/workflows/gate-production-draft.yml');

    expect(workflow).toContain('run_result_path');
    expect(workflow).toContain('review_result_path');
    expect(workflow).toContain('decision_out');
    expect(workflow).toContain('scripts/l4/build-dry-run-gate-decision.mjs');
    expect(workflow).toContain('gate-production-decision-draft');
  });

  it('does not perform production write actions', () => {
    const workflow = readText('.github/workflows/gate-production-draft.yml');

    expect(workflow).not.toContain('git push');
    expect(workflow).not.toContain('gh pr merge');
    expect(workflow).not.toContain('gh pr comment');
    expect(workflow).not.toContain('submit_review');
    expect(workflow).not.toContain('review.json');
    expect(workflow).not.toContain('GATE_ALLOWED');
  });
});
