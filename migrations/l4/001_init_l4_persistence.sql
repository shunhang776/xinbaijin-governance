PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS l4_task_states (
  task_id TEXT PRIMARY KEY,
  repository TEXT NOT NULL CHECK (repository IN (
    'shunhang776/xinbaijin',
    'shunhang776/xinbaijin-mcp',
    'shunhang776/xinbaijin-governance'
  )),
  branch TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'WAIT_CODE',
    'CODE_SUBMITTED',
    'CHECKS_RUNNING',
    'WAIT_REVIEW',
    'REVIEW_DENIED',
    'REPAIR_REQUESTED',
    'REPAIR_SUBMITTED',
    'REVIEW_APPROVED',
    'ACCEPTED',
    'MANUAL_REQUIRED'
  )),
  current_commit TEXT,
  repair_round INTEGER NOT NULL DEFAULT 0 CHECK (repair_round >= 0),
  max_repair_round INTEGER NOT NULL DEFAULT 2 CHECK (max_repair_round >= 0),
  task_state_json TEXT NOT NULL CHECK (json_valid(task_state_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (repair_round <= max_repair_round),
  CHECK (
    current_commit IS NULL OR (
      length(current_commit) = 40
      AND lower(current_commit) = current_commit
      AND current_commit NOT GLOB '*[^0-9a-f]*'
    )
  )
);

CREATE TABLE IF NOT EXISTS l4_events (
  event_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  run_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'CODE_DETECTED',
    'CHECKS_STARTED',
    'CHECKS_PASSED',
    'CHECKS_FAILED',
    'REVIEW_REQUESTED',
    'REVIEW_DENIED',
    'REVIEW_APPROVED',
    'REVIEW_BLOCKED',
    'REPAIR_REQUESTED',
    'REPAIR_SUBMITTED',
    'REPAIR_ROUND_EXCEEDED',
    'REPEATED_FINDING_DETECTED',
    'STALE_REVIEW_DETECTED',
    'BRANCH_HEAD_CHANGED',
    'GATE_ALLOWED',
    'GATE_DENIED',
    'TOOL_ERROR'
  )),
  actor TEXT NOT NULL CHECK (actor IN (
    'codex',
    'claude',
    'chatgpt-reviewer',
    'github-actions',
    'gate',
    'human',
    'system'
  )),
  repository TEXT NOT NULL,
  branch TEXT NOT NULL,
  commit_sha TEXT,
  event_json TEXT NOT NULL CHECK (json_valid(event_json)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES l4_task_states(task_id) ON DELETE CASCADE,
  CHECK (
    commit_sha IS NULL OR (
      length(commit_sha) = 40
      AND lower(commit_sha) = commit_sha
      AND commit_sha NOT GLOB '*[^0-9a-f]*'
    )
  )
);

CREATE TABLE IF NOT EXISTS l4_run_results (
  run_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  repository TEXT NOT NULL,
  branch TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'IN_PROGRESS',
    'COMPLETED',
    'MANUAL_REQUIRED',
    'FAILED'
  )),
  final_state TEXT NOT NULL CHECK (final_state IN (
    'WAIT_CODE',
    'CODE_SUBMITTED',
    'CHECKS_RUNNING',
    'WAIT_REVIEW',
    'REVIEW_DENIED',
    'REPAIR_REQUESTED',
    'REPAIR_SUBMITTED',
    'REVIEW_APPROVED',
    'ACCEPTED',
    'MANUAL_REQUIRED'
  )),
  run_result_json TEXT NOT NULL CHECK (json_valid(run_result_json)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES l4_task_states(task_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS l4_review_guards (
  guard_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  run_id TEXT,
  repository TEXT NOT NULL,
  branch TEXT NOT NULL,
  reviewed_commit TEXT NOT NULL,
  based_on_branch_head TEXT NOT NULL,
  current_branch_head TEXT NOT NULL,
  review_commit TEXT,
  verdict TEXT NOT NULL CHECK (verdict IN (
    'approved',
    'changes_requested',
    'blocked'
  )),
  guard_status TEXT NOT NULL CHECK (guard_status IN (
    'fresh',
    'stale_review',
    'branch_head_changed',
    'manual_required'
  )),
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES l4_task_states(task_id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES l4_run_results(run_id) ON DELETE SET NULL,
  CHECK (
    length(reviewed_commit) = 40
    AND lower(reviewed_commit) = reviewed_commit
    AND reviewed_commit NOT GLOB '*[^0-9a-f]*'
  ),
  CHECK (
    length(based_on_branch_head) = 40
    AND lower(based_on_branch_head) = based_on_branch_head
    AND based_on_branch_head NOT GLOB '*[^0-9a-f]*'
  ),
  CHECK (
    length(current_branch_head) = 40
    AND lower(current_branch_head) = current_branch_head
    AND current_branch_head NOT GLOB '*[^0-9a-f]*'
  ),
  CHECK (
    review_commit IS NULL OR (
      length(review_commit) = 40
      AND lower(review_commit) = review_commit
      AND review_commit NOT GLOB '*[^0-9a-f]*'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_l4_events_task_created
  ON l4_events(task_id, created_at);

CREATE INDEX IF NOT EXISTS idx_l4_events_run_id
  ON l4_events(run_id);

CREATE INDEX IF NOT EXISTS idx_l4_run_results_task_created
  ON l4_run_results(task_id, created_at);

CREATE INDEX IF NOT EXISTS idx_l4_run_results_status
  ON l4_run_results(status);

CREATE INDEX IF NOT EXISTS idx_l4_review_guards_task_created
  ON l4_review_guards(task_id, created_at);

CREATE INDEX IF NOT EXISTS idx_l4_review_guards_status
  ON l4_review_guards(guard_status);
