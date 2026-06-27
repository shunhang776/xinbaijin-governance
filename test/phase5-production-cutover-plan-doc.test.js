import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
}

describe('Phase5 production cutover plan document', () => {
  it('documents production roles and trigger entries', () => {
    const doc = readText('docs/PHASE5-PRODUCTION-CUTOVER-PLAN.md');

    expect(doc).toContain('Owner');
    expect(doc).toContain('Gate Owner');
    expect(doc).toContain('Rollback Owner');
    expect(doc).toContain('Manual Gate Entry');
    expect(doc).toContain('Production Candidate Entry');
    expect(doc).toContain('Production Enforcer Entry');
  });

  it('documents protected branch, required checks, and workflow permission boundaries', () => {
    const doc = readText('docs/PHASE5-PRODUCTION-CUTOVER-PLAN.md');

    expect(doc).toContain('main');
    expect(doc).toContain('dev');
    expect(doc).toContain('governance-ci / governance');
    expect(doc).toContain('L4 Pipeline Dry Run / L4 pipeline dry-run');
    expect(doc).toContain('permissions.contents = read');
    expect(doc).toContain('不使用 pull_request_target');
  });

  it('documents real MCP review and Claude repair requirements', () => {
    const doc = readText('docs/PHASE5-PRODUCTION-CUTOVER-PLAN.md');

    expect(doc).toContain('真实 MCP 审查');
    expect(doc).toContain('get_latest_handoff');
    expect(doc).toContain('submit_review');
    expect(doc).toContain('claude-repair-handoff.json');
    expect(doc).toContain('claude-repair-submission.json');
  });

  it('documents Gate, manual_required, audit log, and rollback boundaries', () => {
    const doc = readText('docs/PHASE5-PRODUCTION-CUTOVER-PLAN.md');

    expect(doc).toContain('Gate allowed');
    expect(doc).toContain('manual_required');
    expect(doc).toContain('phase5-audit-log.json');
    expect(doc).toContain('rollback_started');
    expect(doc).toContain('rollback_completed');
  });

  it('documents production_enforcer conditions and manual rehearsal plan', () => {
    const doc = readText('docs/PHASE5-PRODUCTION-CUTOVER-PLAN.md');

    expect(doc).toContain('production_enforcer = true');
    expect(doc).toContain('owner approval = true');
    expect(doc).toContain('gate owner approval = true');
    expect(doc).toContain('rollback owner approval = true');
    expect(doc).toContain('端到端人工演练');
    expect(doc).toContain('真实执行接入包');
  });
});
