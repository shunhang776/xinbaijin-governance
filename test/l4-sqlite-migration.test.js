import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSql() {
  return readFileSync(resolve('migrations/l4/001_init_l4_persistence.sql'), 'utf8').replace(/^\uFEFF/, '');
}

describe('L4 SQLite persistence migration', () => {
  it('creates the required L4 persistence tables', () => {
    const sql = readSql();

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS l4_task_states');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS l4_events');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS l4_run_results');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS l4_review_guards');
  });

  it('contains indexes for task, run, and guard lookups', () => {
    const sql = readSql();

    expect(sql).toContain('idx_l4_events_task_created');
    expect(sql).toContain('idx_l4_events_run_id');
    expect(sql).toContain('idx_l4_run_results_task_created');
    expect(sql).toContain('idx_l4_run_results_status');
    expect(sql).toContain('idx_l4_review_guards_task_created');
    expect(sql).toContain('idx_l4_review_guards_status');
  });

  it('captures stale review and branch head guard fields', () => {
    const sql = readSql();

    expect(sql).toContain('reviewed_commit');
    expect(sql).toContain('based_on_branch_head');
    expect(sql).toContain('current_branch_head');
    expect(sql).toContain('stale_review');
    expect(sql).toContain('branch_head_changed');
  });

  it('stores canonical JSON payload columns', () => {
    const sql = readSql();

    expect(sql).toContain('task_state_json TEXT NOT NULL CHECK (json_valid(task_state_json))');
    expect(sql).toContain('event_json TEXT NOT NULL CHECK (json_valid(event_json))');
    expect(sql).toContain('run_result_json TEXT NOT NULL CHECK (json_valid(run_result_json))');
  });

  it('does not contain destructive migration statements', () => {
    const sql = readSql();

    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
  });
});
