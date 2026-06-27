import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  applyL4SqliteMigrations,
  createSqliteL4PersistencePort
} from '../src/l4/l4-sqlite-persistence-adapter.mjs';
import { evaluateReviewGuard } from '../src/l4/review-guard.mjs';

const SHA_A = '1111111111111111111111111111111111111111';
const SHA_B = '2222222222222222222222222222222222222222';
const REVIEW_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function createTestPort() {
  const db = new Database(':memory:');
  applyL4SqliteMigrations(db);
  return {
    db,
    port: createSqliteL4PersistencePort(db)
  };
}

function makeTaskState(taskId = 'task-review-guard-sqlite-001') {
  return {
    ...readJson('fixtures/l4/task-state/valid-minimal.json'),
    task_id: taskId,
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    state: 'WAIT_CODE',
    repair_round: 0,
    max_repair_round: 2,
    created_at: '2026-06-27T00:00:00.000Z',
    updated_at: '2026-06-27T00:00:00.000Z'
  };
}

function makeGuardInput(taskId, overrides = {}) {
  return {
    task_id: taskId,
    run_id: null,
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    reviewed_commit: SHA_A,
    based_on_branch_head: SHA_A,
    current_branch_head: SHA_A,
    review_commit: REVIEW_SHA,
    verdict: 'approved',
    created_at: '2026-06-27T00:00:00.000Z',
    ...overrides
  };
}

describe('L4 review guard SQLite persistence', () => {
  it('appends a fresh review guard into SQLite', async () => {
    const { db, port } = createTestPort();
    const taskId = 'task-review-guard-sqlite-fresh-001';

    await port.saveTaskState(makeTaskState(taskId));

    const guard = evaluateReviewGuard(makeGuardInput(taskId, {
      guard_id: 'guard-review-guard-sqlite-fresh-001'
    }));

    await port.appendReviewGuard(guard);

    const row = db
      .prepare('SELECT guard_status, reviewed_commit, current_branch_head FROM l4_review_guards WHERE guard_id = ?')
      .get('guard-review-guard-sqlite-fresh-001');

    const guards = await port.listReviewGuards();

    expect(row.guard_status).toBe('fresh');
    expect(row.reviewed_commit).toBe(SHA_A);
    expect(row.current_branch_head).toBe(SHA_A);
    expect(guards).toHaveLength(1);
    expect(guards[0].guard_status).toBe('fresh');

    db.close();
  });

  it('appends stale_review and branch_head_changed guards into SQLite', async () => {
    const { db, port } = createTestPort();
    const taskId = 'task-review-guard-sqlite-negative-001';

    await port.saveTaskState(makeTaskState(taskId));

    const stale = evaluateReviewGuard(makeGuardInput(taskId, {
      guard_id: 'guard-review-guard-sqlite-stale-001',
      reviewed_commit: SHA_B,
      based_on_branch_head: SHA_A,
      current_branch_head: SHA_A,
      verdict: 'changes_requested'
    }));

    const changed = evaluateReviewGuard(makeGuardInput(taskId, {
      guard_id: 'guard-review-guard-sqlite-head-changed-001',
      reviewed_commit: SHA_B,
      based_on_branch_head: SHA_A,
      current_branch_head: SHA_B,
      verdict: 'changes_requested'
    }));

    await port.appendReviewGuard(stale);
    await port.appendReviewGuard(changed);

    const rows = db
      .prepare('SELECT guard_status FROM l4_review_guards WHERE task_id = ? ORDER BY guard_id')
      .all(taskId)
      .map((row) => row.guard_status);

    const guards = await port.listReviewGuards();

    expect(rows).toEqual([
      'branch_head_changed',
      'stale_review'
    ]);
    expect(guards).toHaveLength(2);
    expect(guards.map((guard) => guard.guard_status).sort()).toEqual([
      'branch_head_changed',
      'stale_review'
    ]);

    db.close();
  });

  it('rejects review guard for missing task state through foreign key', async () => {
    const { db, port } = createTestPort();

    const guard = evaluateReviewGuard(makeGuardInput('missing-task', {
      guard_id: 'guard-review-guard-sqlite-missing-task-001'
    }));

    await expect(port.appendReviewGuard(guard)).rejects.toThrow();

    db.close();
  });
});
