import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('ChatGPT review integration acceptance document', () => {
  it('documents invocation, result, fake executor, and L4 adapter', () => {
    const doc = readText('docs/CHATGPT-REVIEW-INTEGRATION-ACCEPTANCE.md');

    expect(doc).toContain('ChatGPT review invocation schema');
    expect(doc).toContain('ChatGPT review result schema');
    expect(doc).toContain('fake MCP review executor');
    expect(doc).toContain('L4 review guard');
    expect(doc).toContain('L4 events');
  });

  it('documents dry-run artifacts for ChatGPT review integration', () => {
    const doc = readText('docs/CHATGPT-REVIEW-INTEGRATION-ACCEPTANCE.md');

    expect(doc).toContain('codex-bridge-result.json');
    expect(doc).toContain('chatgpt-review-invocation.json');
    expect(doc).toContain('chatgpt-review-result.json');
    expect(doc).toContain('l4-dry-run-artifact.json');
  });

  it('documents forbidden real-MCP and review.json actions', () => {
    const doc = readText('docs/CHATGPT-REVIEW-INTEGRATION-ACCEPTANCE.md');

    expect(doc).toContain('自动调用真实 MCP');
    expect(doc).toContain('自动调用 submit_review');
    expect(doc).toContain('自动写 review.json');
    expect(doc).toContain('Codex 审查代码');
    expect(doc).toContain('Codex 写 review.json');
  });

  it('documents that real MCP review is not yet enabled', () => {
    const doc = readText('docs/CHATGPT-REVIEW-INTEGRATION-ACCEPTANCE.md');

    expect(doc).toContain('尚未接入真实 MCP');
    expect(doc).toContain('尚未真实调用 submit_review');
    expect(doc).toContain('尚未真实写入 review.json');
  });
});
