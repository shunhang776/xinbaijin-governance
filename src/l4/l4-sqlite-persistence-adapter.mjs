import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findL4StateField } from './task-state-snapshot.mjs';

const DEFAULT_MIGRATION_PATH = 'migrations/l4/001_init_l4_persistence.sql';

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(name + ' must be a non-empty string');
  }

  return value;
}

function getTaskId(taskState) {
  const taskId = taskState.task_id || taskState.taskId || taskState.id;
  return requireNonEmptyString(taskId, 'task_id');
}

function getRepository(value) {
  return requireNonEmptyString(value.repository, 'repository');
}

function getBranch(value) {
  return requireNonEmptyString(value.branch, 'branch');
}

function normalizeCommit(value, name) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    throw new Error(name + ' must be a lowercase 40-char commit sha');
  }

  return value;
}

function getCreatedAt(value) {
  return value.created_at || new Date().toISOString();
}

function getUpdatedAt(value) {
  return value.updated_at || value.last_updated_at || getCreatedAt(value);
}

function getRepairRound(taskState) {
  return Number.isInteger(taskState.repair_round) ? taskState.repair_round : 0;
}

function getMaxRepairRound(taskState) {
  return Number.isInteger(taskState.max_repair_round) ? taskState.max_repair_round : 2;
}

export function applyL4SqliteMigrations(db, migrationPath = DEFAULT_MIGRATION_PATH) {
  if (!db || typeof db.exec !== 'function') {
    throw new TypeError('db must expose exec(sql)');
  }

  const sql = readFileSync(resolve(migrationPath), 'utf8').replace(/^\uFEFF/, '');
  db.exec(sql);
  return true;
}

export function createSqliteL4PersistencePort(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('db must expose prepare(sql)');
  }

  db.pragma?.('foreign_keys = ON');

  return {
    async loadTaskState(taskId) {
      requireNonEmptyString(taskId, 'task_id');

      const row = db
        .prepare('SELECT task_state_json FROM l4_task_states WHERE task_id = ?')
        .get(taskId);

      return row ? JSON.parse(row.task_state_json) : null;
    },

    async saveTaskState(taskState) {
      if (!taskState || typeof taskState !== 'object') {
        throw new TypeError('taskState must be an object');
      }

      const stored = cloneJson(taskState);
      const taskId = getTaskId(stored);
      const stateField = findL4StateField(stored);
      const state = requireNonEmptyString(stored[stateField], 'state');
      const repository = getRepository(stored);
      const branch = getBranch(stored);
      const repairRound = getRepairRound(stored);
      const maxRepairRound = getMaxRepairRound(stored);

      db.prepare(`
        INSERT INTO l4_task_states (
          task_id,
          repository,
          branch,
          state,
          current_commit,
          repair_round,
          max_repair_round,
          task_state_json,
          created_at,
          updated_at
        )
        VALUES (
          @task_id,
          @repository,
          @branch,
          @state,
          @current_commit,
          @repair_round,
          @max_repair_round,
          @task_state_json,
          @created_at,
          @updated_at
        )
        ON CONFLICT(task_id) DO UPDATE SET
          repository = excluded.repository,
          branch = excluded.branch,
          state = excluded.state,
          current_commit = excluded.current_commit,
          repair_round = excluded.repair_round,
          max_repair_round = excluded.max_repair_round,
          task_state_json = excluded.task_state_json,
          updated_at = excluded.updated_at
      `).run({
        task_id: taskId,
        repository,
        branch,
        state,
        current_commit: normalizeCommit(stored.current_commit || stored.commit || null, 'current_commit'),
        repair_round: repairRound,
        max_repair_round: maxRepairRound,
        task_state_json: JSON.stringify(stored),
        created_at: stored.created_at || new Date().toISOString(),
        updated_at: getUpdatedAt(stored)
      });

      return cloneJson(stored);
    },

    async appendRunResult(runResult) {
      if (!runResult || typeof runResult !== 'object') {
        throw new TypeError('runResult must be an object');
      }

      const stored = cloneJson(runResult);

      db.prepare(`
        INSERT INTO l4_run_results (
          run_id,
          task_id,
          repository,
          branch,
          status,
          final_state,
          run_result_json,
          created_at
        )
        VALUES (
          @run_id,
          @task_id,
          @repository,
          @branch,
          @status,
          @final_state,
          @run_result_json,
          @created_at
        )
      `).run({
        run_id: requireNonEmptyString(stored.run_id, 'run_id'),
        task_id: requireNonEmptyString(stored.task_id, 'task_id'),
        repository: getRepository(stored),
        branch: getBranch(stored),
        status: requireNonEmptyString(stored.status, 'status'),
        final_state: requireNonEmptyString(stored.final_state, 'final_state'),
        run_result_json: JSON.stringify(stored),
        created_at: getCreatedAt(stored)
      });

      return cloneJson(stored);
    },

    async appendEvent(event) {
      if (!event || typeof event !== 'object') {
        throw new TypeError('event must be an object');
      }

      const stored = cloneJson(event);
      const taskId = requireNonEmptyString(stored.task_id || stored.taskId, 'task_id');

      const taskRow = db
        .prepare('SELECT repository, branch FROM l4_task_states WHERE task_id = ?')
        .get(taskId);

      if (!taskRow) {
        throw new Error('task_state not found for event task_id: ' + taskId);
      }

      db.prepare(`
        INSERT INTO l4_events (
          event_id,
          task_id,
          run_id,
          event_type,
          actor,
          repository,
          branch,
          commit_sha,
          event_json,
          created_at
        )
        VALUES (
          @event_id,
          @task_id,
          @run_id,
          @event_type,
          @actor,
          @repository,
          @branch,
          @commit_sha,
          @event_json,
          @created_at
        )
      `).run({
        event_id: requireNonEmptyString(stored.event_id, 'event_id'),
        task_id: taskId,
        run_id: stored.run_id || null,
        event_type: requireNonEmptyString(stored.event_type, 'event_type'),
        actor: stored.actor || 'system',
        repository: stored.repository || taskRow.repository,
        branch: stored.branch || taskRow.branch,
        commit_sha: normalizeCommit(stored.commit_sha || stored.commit || null, 'commit_sha'),
        event_json: JSON.stringify(stored),
        created_at: getCreatedAt(stored)
      });

      return cloneJson(stored);
    },

    async listRunResults() {
      const rows = db
        .prepare('SELECT run_result_json FROM l4_run_results ORDER BY created_at, run_id')
        .all();

      return rows.map((row) => JSON.parse(row.run_result_json));
    },

    async listEvents() {
      const rows = db
        .prepare('SELECT event_json FROM l4_events ORDER BY created_at, event_id')
        .all();

      return rows.map((row) => JSON.parse(row.event_json));
    }
  };
}
