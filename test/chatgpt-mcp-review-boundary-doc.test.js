import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('ChatGPT MCP review execution boundary document', () => {
  it('documents exact trigger phrases and repository mapping', () => {
    const doc = readText('docs/CHATGPT-MCP-REVIEW-EXECUTION-BOUNDARY.md');

    expect(doc).toContain('审查 Claude 最新交接');
    expect(doc).toContain('审查 MCP 最新交接');
    expect(doc).toContain('shunhang776/xinbaijin');
    expect(doc).toContain('shunhang776/xinbaijin-mcp');
    expect(doc).toContain('branch = dev');
  });

  it('documents required MCP tools and readback verification', () => {
    const doc = readText('docs/CHATGPT-MCP-REVIEW-EXECUTION-BOUNDARY.md');

    expect(doc).toContain('get_latest_handoff');
    expect(doc).toContain('get_patch');
    expect(doc).toContain('get_file_content');
    expect(doc).toContain('submit_review');
    expect(doc).toContain('readback verify');
  });

  it('documents get_file_content mandatory cases', () => {
    const doc = readText('docs/CHATGPT-MCP-REVIEW-EXECUTION-BOUNDARY.md');

    expect(doc).toContain('Unicode');
    expect(doc).toContain('Base64');
    expect(doc).toContain('JSON');
    expect(doc).toContain('LF、CRLF 或混合行尾');
    expect(doc).toContain('sha256');
    expect(doc).toContain('byte_length');
    expect(doc).toContain('line_ending');
    expect(doc).toContain('final_newline');
  });

  it('documents Codex forbidden actions', () => {
    const doc = readText('docs/CHATGPT-MCP-REVIEW-EXECUTION-BOUNDARY.md');

    expect(doc).toContain('Codex 审查代码');
    expect(doc).toContain('Codex 写 review.json');
    expect(doc).toContain('Codex 调用 submit_review');
    expect(doc).toContain('Codex 决定 approved');
  });
});
