import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('Phase5 final enablement boundary document', () => {
  it('documents Phase5 modes and production enforcer hard conditions', () => {
    const doc = readText('docs/PHASE5-FINAL-ENABLEMENT-BOUNDARY.md');

    expect(doc).toContain('draft');
    expect(doc).toContain('manual_gate');
    expect(doc).toContain('production_enforcer');
    expect(doc).toContain('production_enabled = true');
    expect(doc).toContain('mode = production_enforcer');
  });

  it('documents rollback and audit log boundaries', () => {
    const doc = readText('docs/PHASE5-FINAL-ENABLEMENT-BOUNDARY.md');

    expect(doc).toContain('rollback_ready = true');
    expect(doc).toContain('rollback_owner_approved = true');
    expect(doc).toContain('phase5_audit_log_created');
    expect(doc).toContain('production_enforcer_enabled');
    expect(doc).toContain('manual_confirmation = true');
  });

  it('documents GitHub Actions permission boundary', () => {
    const doc = readText('docs/PHASE5-FINAL-ENABLEMENT-BOUNDARY.md');

    expect(doc).toContain('permissions.contents = read');
    expect(doc).toContain('不使用 pull_request_target');
    expect(doc).toContain('不使用 contents: write');
    expect(doc).toContain('不执行 git push');
    expect(doc).toContain('不调用 submit_review');
  });

  it('documents ChatGPT, Claude, Gate, and L4 boundaries', () => {
    const doc = readText('docs/PHASE5-FINAL-ENABLEMENT-BOUNDARY.md');

    expect(doc).toContain('chatgpt-review-result.json');
    expect(doc).toContain('claude-repair-handoff.json');
    expect(doc).toContain('claude-repair-submission.json');
    expect(doc).toContain('Gate production decision');
    expect(doc).toContain('GATE_ALLOWED');
    expect(doc).toContain('GATE_DENIED');
  });

  it('documents forbidden actions and final checklist', () => {
    const doc = readText('docs/PHASE5-FINAL-ENABLEMENT-BOUNDARY.md');

    expect(doc).toContain('自动启用 production_enforcer');
    expect(doc).toContain('自动 merge PR');
    expect(doc).toContain('自动 push 到 main 或 dev');
    expect(doc).toContain('最终启用前检查清单');
    expect(doc).toContain('Phase5 dry-run 验收');
  });
});
