import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\\uFEFF/, '');
}

describe('L4 dry-run acceptance document', () => {
  it('documents dry-run outputs and artifacts', () => {
    const doc = readText('docs/L4-DRY-RUN-ACCEPTANCE.md');

    expect(doc).toContain('l4-pipeline-input.json');
    expect(doc).toContain('l4-pipeline-output.json');
    expect(doc).toContain('l4-run-result.json');
    expect(doc).toContain('l4-dry-run-artifact.json');
    expect(doc).toContain('l4-pr-comment.md');
  });

  it('documents the read-only permission boundary', () => {
    const doc = readText('docs/L4-DRY-RUN-ACCEPTANCE.md');

    expect(doc).toContain('contents: read');
    expect(doc).toContain('pull-requests: write');
    expect(doc).toContain('issues: write');
    expect(doc).toContain('pull_request_target');
    expect(doc).toContain('gh pr comment');
  });

  it('states that dry-run does not call ChatGPT or Claude', () => {
    const doc = readText('docs/L4-DRY-RUN-ACCEPTANCE.md');

    expect(doc).toContain('不调用 ChatGPT');
    expect(doc).toContain('不调用 Claude');
    expect(doc).toContain('不写 review.json');
    expect(doc).toContain('不自动评论 PR');
  });

  it('declares readiness for real ChatGPT review integration', () => {
    const doc = readText('docs/L4-DRY-RUN-ACCEPTANCE.md');

    expect(doc).toContain('第 8 步：真实 ChatGPT 审查接入');
    expect(doc).toContain('Codex 只作为桥接器');
  });
});
