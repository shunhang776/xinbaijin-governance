import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('Claude repair loop acceptance document', () => {
  it('documents Claude repair handoff and submission contracts', () => {
    const doc = readText('docs/CLAUDE-REPAIR-LOOP-ACCEPTANCE.md');

    expect(doc).toContain('Claude repair handoff schema');
    expect(doc).toContain('Claude repair submission schema');
    expect(doc).toContain('schemas/claude-repair-handoff.schema.json');
    expect(doc).toContain('schemas/claude-repair-submission.schema.json');
  });

  it('documents L4 repair events and pipeline loop', () => {
    const doc = readText('docs/CLAUDE-REPAIR-LOOP-ACCEPTANCE.md');

    expect(doc).toContain('REPAIR_REQUESTED');
    expect(doc).toContain('REPAIR_SUBMITTED');
    expect(doc).toContain('CHECKS_STARTED');
    expect(doc).toContain('CHECKS_PASSED');
    expect(doc).toContain('REVIEW_APPROVED');
    expect(doc).toContain('GATE_ALLOWED');
    expect(doc).toContain('ACCEPTED');
  });

  it('documents repair guard protections', () => {
    const doc = readText('docs/CLAUDE-REPAIR-LOOP-ACCEPTANCE.md');

    expect(doc).toContain('REPAIR_ROUND_EXCEEDED');
    expect(doc).toContain('REPEATED_FINDING_DETECTED');
    expect(doc).toContain('repair_round');
    expect(doc).toContain('max_repair_round');
    expect(doc).toContain('MANUAL_REQUIRED');
  });

  it('documents forbidden production behaviors', () => {
    const doc = readText('docs/CLAUDE-REPAIR-LOOP-ACCEPTANCE.md');

    expect(doc).toContain('自动调用真实 Claude Code');
    expect(doc).toContain('自动修改业务代码');
    expect(doc).toContain('自动 push 到 dev');
    expect(doc).toContain('自动绕过 ChatGPT review');
    expect(doc).toContain('自动绕过 Gate');
  });

  it('documents next step as production Gate decision', () => {
    const doc = readText('docs/CLAUDE-REPAIR-LOOP-ACCEPTANCE.md');

    expect(doc).toContain('第 10 步');
    expect(doc).toContain('Gate 生产裁决');
  });
});
