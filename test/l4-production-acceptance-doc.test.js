import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('L4 production acceptance document', () => {
  it('documents ChatGPT review, Claude repair, and Gate acceptance stages', () => {
    const doc = readText('docs/L4-PRODUCTION-ACCEPTANCE.md');

    expect(doc).toContain('ChatGPT 审查接入');
    expect(doc).toContain('Claude 返工');
    expect(doc).toContain('Gate 生产裁决');
    expect(doc).toContain('第 8 步');
    expect(doc).toContain('第 9 步');
    expect(doc).toContain('第 10 步');
  });

  it('documents core contracts and implementation files', () => {
    const doc = readText('docs/L4-PRODUCTION-ACCEPTANCE.md');

    expect(doc).toContain('schemas/chatgpt-review-result.schema.json');
    expect(doc).toContain('schemas/claude-repair-handoff.schema.json');
    expect(doc).toContain('schemas/claude-repair-submission.schema.json');
    expect(doc).toContain('schemas/gate-production-decision.schema.json');
    expect(doc).toContain('src/l4/l4-machine.mjs');
  });

  it('documents artifact and workflow boundaries', () => {
    const doc = readText('docs/L4-PRODUCTION-ACCEPTANCE.md');

    expect(doc).toContain('l4-dry-run-artifact.json');
    expect(doc).toContain('chatgpt-review-result.json');
    expect(doc).toContain('gate-production-decision.json');
    expect(doc).toContain('.github/workflows/l4-pipeline-dry-run.yml');
    expect(doc).toContain('.github/workflows/gate-production-draft.yml');
  });

  it('documents protections and forbidden production behaviors', () => {
    const doc = readText('docs/L4-PRODUCTION-ACCEPTANCE.md');

    expect(doc).toContain('stale review protection');
    expect(doc).toContain('branch head changed protection');
    expect(doc).toContain('repair round exceeded protection');
    expect(doc).toContain('自动 merge PR');
    expect(doc).toContain('自动 push 到 main 或 dev');
    expect(doc).toContain('自动调用 submit_review');
  });

  it('documents Phase5 enablement preconditions and next step', () => {
    const doc = readText('docs/L4-PRODUCTION-ACCEPTANCE.md');

    expect(doc).toContain('生产启用前置条件');
    expect(doc).toContain('Phase5 正式启用');
    expect(doc).toContain('生产启用开关');
    expect(doc).toContain('回滚策略');
  });
});
