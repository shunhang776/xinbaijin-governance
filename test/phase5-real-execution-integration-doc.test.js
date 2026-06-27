import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('Phase5 real execution integration document', () => {
  it('documents real MCP review and fixed trigger phrases', () => {
    const doc = readText('docs/PHASE5-REAL-EXECUTION-INTEGRATION.md');

    expect(doc).toContain('真实 MCP 审查');
    expect(doc).toContain('审查 Claude 最新交接');
    expect(doc).toContain('审查 MCP 最新交接');
    expect(doc).toContain('get_latest_handoff');
    expect(doc).toContain('submit_review');
  });

  it('documents review readback verification and repository mapping', () => {
    const doc = readText('docs/PHASE5-REAL-EXECUTION-INTEGRATION.md');

    expect(doc).toContain('review.json readback verify');
    expect(doc).toContain('reviewed_commit');
    expect(doc).toContain('based_on_branch_head');
    expect(doc).toContain('sha256');
    expect(doc).toContain('xinbaijin-mcp');
  });

  it('documents real Claude repair loop and Gate decision', () => {
    const doc = readText('docs/PHASE5-REAL-EXECUTION-INTEGRATION.md');

    expect(doc).toContain('Claude Code 真实返工');
    expect(doc).toContain('claude-repair-handoff.json');
    expect(doc).toContain('claude-repair-submission.json');
    expect(doc).toContain('Gate allowed');
    expect(doc).toContain('manual_required');
  });

  it('documents audit log, rollback, and manual rehearsal', () => {
    const doc = readText('docs/PHASE5-REAL-EXECUTION-INTEGRATION.md');

    expect(doc).toContain('audit log');
    expect(doc).toContain('rollback 演练');
    expect(doc).toContain('完整人工端到端演练');
    expect(doc).toContain('artifacts/phase5/audit/*.jsonl');
  });

  it('documents forbidden production actions and production enforcer boundary', () => {
    const doc = readText('docs/PHASE5-REAL-EXECUTION-INTEGRATION.md');

    expect(doc).toContain('production_enforcer = false');
    expect(doc).toContain('自动 merge PR');
    expect(doc).toContain('自动 push 到 main 或 dev');
    expect(doc).toContain('Codex 代替 ChatGPT 审查');
    expect(doc).toContain('不再继续新增细碎治理契约');
  });
});
