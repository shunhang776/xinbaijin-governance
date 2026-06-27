import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('Gate production enablement boundary document', () => {
  it('documents Gate production decision inputs and outputs', () => {
    const doc = readText('docs/GATE-PRODUCTION-ENABLEMENT-BOUNDARY.md');

    expect(doc).toContain('l4-run-result.json');
    expect(doc).toContain('chatgpt-review-result.json');
    expect(doc).toContain('l4-dry-run-artifact.json');
    expect(doc).toContain('gate-production-decision.json');
  });

  it('documents allowed, denied, and manual_required boundaries', () => {
    const doc = readText('docs/GATE-PRODUCTION-ENABLEMENT-BOUNDARY.md');

    expect(doc).toContain('allowed');
    expect(doc).toContain('denied');
    expect(doc).toContain('manual_required');
    expect(doc).toContain('all_required_conditions_met');
    expect(doc).toContain('GATE_DENIED');
  });

  it('documents required allow conditions', () => {
    const doc = readText('docs/GATE-PRODUCTION-ENABLEMENT-BOUNDARY.md');

    expect(doc).toContain('checks_passed = true');
    expect(doc).toContain('chatgpt_review_approved = true');
    expect(doc).toContain('review_readback_verified = true');
    expect(doc).toContain('l4_accepted = true');
    expect(doc).toContain('branch_head_unchanged = true');
    expect(doc).toContain('no_stale_review = true');
  });

  it('documents forbidden production write actions', () => {
    const doc = readText('docs/GATE-PRODUCTION-ENABLEMENT-BOUNDARY.md');

    expect(doc).toContain('自动 merge PR');
    expect(doc).toContain('自动 push 到 main 或 dev');
    expect(doc).toContain('自动评论 PR');
    expect(doc).toContain('自动写 review.json');
    expect(doc).toContain('自动调用 submit_review');
  });

  it('documents GitHub Actions permission boundary', () => {
    const doc = readText('docs/GATE-PRODUCTION-ENABLEMENT-BOUNDARY.md');

    expect(doc).toContain('workflow_dispatch');
    expect(doc).toContain('permissions.contents = read');
    expect(doc).toContain('不使用 pull_request_target');
    expect(doc).toContain('不执行 git push');
    expect(doc).toContain('不执行 gh pr merge');
  });

  it('documents next step as Gate acceptance closure', () => {
    const doc = readText('docs/GATE-PRODUCTION-ENABLEMENT-BOUNDARY.md');

    expect(doc).toContain('第 10.10');
    expect(doc).toContain('第 10 步收口验收');
  });
});
