import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('Phase5 final acceptance document', () => {
  it('documents completed Phase5 acceptance stages', () => {
    const doc = readText('docs/PHASE5-FINAL-ACCEPTANCE.md');

    expect(doc).toContain('ChatGPT review integration');
    expect(doc).toContain('Claude repair loop');
    expect(doc).toContain('Gate production decision');
    expect(doc).toContain('L4 production acceptance');
    expect(doc).toContain('Phase5 dry-run acceptance');
  });

  it('documents core contracts and implementation files', () => {
    const doc = readText('docs/PHASE5-FINAL-ACCEPTANCE.md');

    expect(doc).toContain('schemas/phase5-enablement.schema.json');
    expect(doc).toContain('schemas/phase5-rollback-plan.schema.json');
    expect(doc).toContain('schemas/phase5-audit-log.schema.json');
    expect(doc).toContain('src/phase5/enablement.mjs');
    expect(doc).toContain('src/phase5/readiness.mjs');
  });

  it('documents workflow and dry-run boundaries', () => {
    const doc = readText('docs/PHASE5-FINAL-ACCEPTANCE.md');

    expect(doc).toContain('.github/workflows/l4-pipeline-dry-run.yml');
    expect(doc).toContain('.github/workflows/gate-production-draft.yml');
    expect(doc).toContain('.github/workflows/phase5-manual-approval-draft.yml');
    expect(doc).toContain('production_enforcer 未被自动启用');
  });

  it('documents production enforcer hard conditions', () => {
    const doc = readText('docs/PHASE5-FINAL-ACCEPTANCE.md');

    expect(doc).toContain('production_enabled = true');
    expect(doc).toContain('mode = production_enforcer');
    expect(doc).toContain('rollback plan ready');
    expect(doc).toContain('audit log 可生成');
    expect(doc).toContain('owner approval = true');
  });

  it('documents forbidden behaviors and final conclusion', () => {
    const doc = readText('docs/PHASE5-FINAL-ACCEPTANCE.md');

    expect(doc).toContain('自动启用 production_enforcer');
    expect(doc).toContain('自动 merge PR');
    expect(doc).toContain('自动 push 到 main 或 dev');
    expect(doc).toContain('Production enforcement not enabled');
    expect(doc).toContain('Manual controlled enablement planning may begin');
  });
});
