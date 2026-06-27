import { runCodexResultL4Pipeline } from './l4-codex-pipeline.mjs';
import { buildL4RunResult } from './l4-run-result.mjs';
import {
  appendEvent,
  appendRunResult,
  assertL4PersistencePort,
  loadTaskState,
  saveTaskState
} from './l4-persistence-port.mjs';

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(name + ' must be a non-empty string');
  }

  return value;
}

async function resolveBaseTaskState(input) {
  if (input.baseTaskState) {
    return input.baseTaskState;
  }

  const taskId = requireNonEmptyString(input.task_id, 'task_id');
  const loaded = await loadTaskState(input.persistence, taskId);

  if (!loaded) {
    throw new Error('task_state not found: ' + taskId);
  }

  return loaded;
}

async function persistReviewGuards(persistence, reviewGuards, options) {
  if (!Array.isArray(reviewGuards)) {
    throw new TypeError('reviewGuards must be an array');
  }

  if (reviewGuards.length === 0) {
    return [];
  }

  if (typeof persistence.appendReviewGuard !== 'function') {
    throw new TypeError('persistence port missing optional method: appendReviewGuard');
  }

  const taskId = requireNonEmptyString(options.task_id, 'task_id');
  const runId = requireNonEmptyString(options.run_id, 'run_id');
  const persisted = [];

  for (const guard of reviewGuards) {
    persisted.push(await persistence.appendReviewGuard({
      ...guard,
      task_id: taskId,
      run_id: runId
    }));
  }

  return persisted;
}

export async function runPipelineAndPersist(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }

  const persistence = assertL4PersistencePort(input.persistence);
  const taskId = requireNonEmptyString(input.task_id, 'task_id');
  const runId = requireNonEmptyString(input.run_id, 'run_id');
  const repository = requireNonEmptyString(input.repository, 'repository');
  const branch = requireNonEmptyString(input.branch, 'branch');
  const reviewGuards = input.reviewGuards || [];

  const baseTaskState = await resolveBaseTaskState({
    ...input,
    persistence
  });

  const pipelineOutput = runCodexResultL4Pipeline({
    baseTaskState,
    initialEvents: input.initialEvents || [],
    codexResults: input.codexResults || [],
    reviewGuards,
    tailEvents: input.tailEvents || [],
    eventTemplate: input.eventTemplate,
    validateEvent: input.validateEvent,
    snapshotOptions: input.snapshotOptions || {}
  });

  const runResult = buildL4RunResult(pipelineOutput, {
    run_id: runId,
    task_id: taskId,
    repository,
    branch,
    created_at: input.created_at,
    errors: input.errors || []
  });

  const savedTaskState = await saveTaskState(persistence, runResult.task_state);
  const savedRunResult = await appendRunResult(persistence, runResult);

  const savedReviewGuards = await persistReviewGuards(persistence, reviewGuards, {
    task_id: taskId,
    run_id: runId
  });

  for (const event of pipelineOutput.events) {
    await appendEvent(persistence, event);
  }

  return {
    pipeline_output: pipelineOutput,
    run_result: runResult,
    persisted: {
      event_count: pipelineOutput.events.length,
      review_guard_count: savedReviewGuards.length,
      task_state_saved: true,
      run_result_saved: true,
      saved_review_guards: savedReviewGuards,
      saved_task_state: savedTaskState,
      saved_run_result: savedRunResult
    }
  };
}
