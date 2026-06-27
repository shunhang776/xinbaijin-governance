import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('Gate production acceptance document', () => {
  it('documents Gate production schema, builder, rules, and adapters', () => {
    const doc = readText('docs/GATE-PRODUCTION-ACCEPTANCE.md');

    expect(doc).toContain('Gate production decision schema');
    expect(doc).toContain('Gate production decision builder');
    expect(doc).toContain('rules engine');
    expect(doc).toContain('Gate decision 到 L4 GATE_ALLOWED / GATE_DENIED event adapter');
  });

  it('documents Gate decision chain and L4 outcomes', () => {
    const doc = readText('docs/GATE-PRODUCTION-ACCEPTANCE.md');

    expect(doc).toContain('gate-production-decision.json');
    expect(doc).toContain('GATE_ALLOWED');
    expect(doc).toContain('GATE_DENIED');
    expect(doc).toContain('ACCEPTED');
    expect(doc).toContain('MANUAL_REQUIRED');
  });

  it('documents allowed required conditions', () => {
    const doc = readText('docs/GATE-PRODUCTION-ACCEPTANCE.md');

    expect(doc).toContain('checks_passed = true');
    expect(doc).toContain('chatgpt_review_approved = true');
    expect(doc).toContain('review_readback_verified = true');
    expect(doc).toContain('l4_accepted = true');
    expect(doc).toContain('all_required_conditions_met');
  });

  it('documents negative paths and production forbidden actions', () => {
    const doc = readText('docs/GATE-PRODUCTION-ACCEPTANCE.md');

    expect(doc).toContain('stale review detected');
    expect(doc).toContain('branch head changed');
    expect(doc).toContain('repair guard blocked');
    expect(doc).toContain('自动 merge PR');
    expect(doc).toContain('自动 push 到 main 或 dev');
    expect(doc).toContain('自动调用 submit_review');
  });

  it('documents draft workflow permission boundary', () => {
    const doc = readText('docs/GATE-PRODUCTION-ACCEPTANCE.md');

    expect(doc).toContain('workflow_dispatch');
    expect(doc).toContain('permissions.contents = read');
    expect(doc).toContain('不使用 pull_request_target');
    expect(doc).toContain('不执行 git push');
    expect(doc).toContain('不执行 gh pr merge');
  });

  it('documents next step as L4 production acceptance document', () => {
    const doc = readText('docs/GATE-PRODUCTION-ACCEPTANCE.md');

    expect(doc).toContain('第 11 步');
    expect(doc).toContain('L4 生产验收文档');
  });
});
