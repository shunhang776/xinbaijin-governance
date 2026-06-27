# L4 状态 Schema 与事件结构设计

## 一、定位

本文定义白槿 L4 自动返工闭环的状态数据和事件结构。

L4 状态机后续由 XState 驱动，SQLite 保存状态快照和事件日志。

Codex Bridge Adapter 只负责桥接事件，不直接绕过状态机。

## 二、核心状态枚举

允许状态：

- WAIT_CODE：等待 Claude 提交代码
- CODE_SUBMITTED：检测到 candidate commit
- CHECKS_RUNNING：GitHub Actions / Required Checks 正在运行
- WAIT_REVIEW：等待 ChatGPT 白槿审查
- REVIEW_APPROVED：review.json 为 approved
- REVIEW_DENIED：review.json 为 changes_requested
- REVIEW_BLOCKED：review.json 为 blocked
- REPAIR_REQUESTED：Codex 已桥接返工任务
- REPAIR_SUBMITTED：Claude 已提交修复 commit
- WAIT_RE_REVIEW：等待下一轮审查
- ACCEPTED：gate allowed，流程完成
- MANUAL_REQUIRED：需要人工介入

## 三、状态快照字段

每个 L4 任务必须保存以下字段：

- task_id
- repository
- branch
- state
- candidate_commit
- current_branch_head
- review_commit
- repair_commit
- verdict
- gate_result
- findings
- required_checks
- repair_round
- max_repair_round
- last_error
- created_at
- updated_at

## 四、事件类型

允许事件：

- CODE_DETECTED
- CHECKS_STARTED
- CHECKS_PASSED
- CHECKS_FAILED
- REVIEW_REQUESTED
- REVIEW_WRITTEN
- REVIEW_APPROVED
- REVIEW_DENIED
- REVIEW_BLOCKED
- REPAIR_REQUESTED
- REPAIR_SUBMITTED
- GATE_ALLOWED
- GATE_DENIED
- STALE_REVIEW_DETECTED
- BRANCH_HEAD_CHANGED
- REPAIR_ROUND_EXCEEDED
- REPEATED_FINDING_DETECTED
- TOOL_ERROR
- MANUAL_OVERRIDE_REQUESTED
- ACCEPTED

## 五、事件字段

每个事件必须保存：

- event_id
- task_id
- event_type
- repository
- branch
- actor
- commit
- review_commit
- repair_round
- payload
- created_at

actor 允许值：

- claude
- codex
- chatgpt-reviewer
- github-actions
- gate
- human
- system

## 六、关键转移规则

WAIT_CODE + CODE_DETECTED -> CODE_SUBMITTED

CODE_SUBMITTED + CHECKS_STARTED -> CHECKS_RUNNING

CHECKS_RUNNING + CHECKS_PASSED -> WAIT_REVIEW

WAIT_REVIEW + REVIEW_APPROVED -> REVIEW_APPROVED

WAIT_REVIEW + REVIEW_DENIED -> REVIEW_DENIED

WAIT_REVIEW + REVIEW_BLOCKED -> REVIEW_BLOCKED

REVIEW_APPROVED + GATE_ALLOWED -> ACCEPTED

REVIEW_DENIED + REPAIR_REQUESTED -> REPAIR_REQUESTED

REPAIR_REQUESTED + REPAIR_SUBMITTED -> REPAIR_SUBMITTED

REPAIR_SUBMITTED + CHECKS_STARTED -> CHECKS_RUNNING

REVIEW_BLOCKED -> MANUAL_REQUIRED

任意状态 + STALE_REVIEW_DETECTED -> MANUAL_REQUIRED

任意状态 + BRANCH_HEAD_CHANGED -> MANUAL_REQUIRED

任意状态 + REPAIR_ROUND_EXCEEDED -> MANUAL_REQUIRED

任意状态 + TOOL_ERROR -> MANUAL_REQUIRED

## 七、repair_round 规则

repair_round 初始值为 0。

每次 changes_requested 后进入返工，repair_round 加 1。

默认 max_repair_round = 2。

超过上限后进入 MANUAL_REQUIRED。

## 八、停止条件

以下情况必须停止自动推进：

- verdict = blocked
- stale review
- branch head changed
- required checks failed
- repair_round 超过上限
- 同一 finding 重复出现
- review.json 校验失败
- ChatGPT 审查器或 MCP 工具异常

## 九、禁止事项

- Codex 不允许直接修改 review.json
- Codex 不允许自己生成 approved
- Claude 不允许修改 review.json
- 任意执行器不允许绕过 gate
- 任意执行器不允许直接推送 dev

## 十、后续落地

下一步应基于本文继续定义：

- schemas/l4-task-state.schema.json
- schemas/l4-event.schema.json
- XState 状态机实现
- SQLite 事件表结构
- Codex Bridge Adapter 输入输出协议
