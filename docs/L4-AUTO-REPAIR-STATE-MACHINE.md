# L4 自动返工闭环状态机设计

## 一、定位

L4 是白槿 Phase5 的最终目标。

L4 不是单次自动审查，而是自动审查加自动返工闭环。

Codex 在 L4 中是桥接器，负责串联 GitHub、Claude、ChatGPT 白槿审查器、MCP、review.json、CI、PR 和 gate。

Claude 负责写代码和修复代码。

ChatGPT 白槿审查器负责权威审查。

Ajv、OPA、Conftest、GitHub Rulesets 负责最终门禁。

## 二、核心状态

建议状态机包含以下状态：

1. WAIT_CODE：等待 Claude 提交代码。
2. CODE_SUBMITTED：检测到 candidate commit。
3. CHECKS_RUNNING：等待 GitHub Actions / Required Checks 完成。
4. WAIT_REVIEW：Codex 桥接审查上下文，等待 ChatGPT 审查。
5. REVIEW_APPROVED：review.json verdict 为 approved。
6. REVIEW_DENIED：review.json verdict 为 changes_requested。
7. REVIEW_BLOCKED：review.json verdict 为 blocked。
8. REPAIR_REQUESTED：Codex 将 findings 桥接给 Claude。
9. REPAIR_SUBMITTED：Claude 提交修复 commit。
10. WAIT_RE_REVIEW：等待下一轮 ChatGPT 审查。
11. ACCEPTED：gate allowed，流程完成。
12. MANUAL_REQUIRED：需要人工介入。

## 三、主要状态转移

WAIT_CODE -> CODE_SUBMITTED：出现新的 candidate commit。

CODE_SUBMITTED -> CHECKS_RUNNING：GitHub Actions 开始运行。

CHECKS_RUNNING -> WAIT_REVIEW：required checks 完成且可进入审查。

WAIT_REVIEW -> REVIEW_APPROVED：ChatGPT 写入 approved review.json。

WAIT_REVIEW -> REVIEW_DENIED：ChatGPT 写入 changes_requested review.json。

WAIT_REVIEW -> REVIEW_BLOCKED：ChatGPT 写入 blocked review.json。

REVIEW_APPROVED -> ACCEPTED：Ajv、OPA、Conftest、GitHub Rulesets 判断 allowed。

REVIEW_DENIED -> REPAIR_REQUESTED：Codex 读取 findings 并桥接给 Claude。

REPAIR_REQUESTED -> REPAIR_SUBMITTED：Claude 完成修复并提交新 commit。

REPAIR_SUBMITTED -> CHECKS_RUNNING：重新运行 GitHub Actions。

REVIEW_BLOCKED -> MANUAL_REQUIRED：blocked 不允许自动继续。

任意状态 -> MANUAL_REQUIRED：出现并发变更、stale review、工具错误、超过返工上限或重复 finding。

## 四、必须保护的条件

1. review.json 只能由 ChatGPT 白槿审查器写入。
2. Codex 不允许伪造 approved。
3. Claude 不允许修改 review.json。
4. Codex 不允许绕过 gate。
5. blocked 必须停止并转人工。
6. stale review 必须停止。
7. 分支头变化必须停止。
8. required checks 未完成不得进入审查完成状态。
9. repair_round 超过上限必须停止。
10. 同一 finding 多次重复出现必须停止。

## 五、repair_round 规则

repair_round 从 0 开始。

每发生一次 changes_requested 后的返工，repair_round 加 1。

建议默认最大值为 2。

超过最大值后进入 MANUAL_REQUIRED。

## 六、状态记录

每一轮必须记录：

1. repository
2. branch
3. candidate_commit
4. review_commit
5. repair_commit
6. verdict
7. findings
8. gate_result
9. required_checks
10. repair_round
11. current_branch_head
12. created_at
13. updated_at

## 七、正式实现建议

正式实现不应继续扩大 PowerShell 脚本。

建议使用：

1. XState 管理状态机。
2. SQLite 保存状态快照、事件日志和人工介入记录。
3. Octokit 访问 GitHub。
4. Ajv 校验 JSON Schema。
5. OPA / Conftest 做政策判断。
6. Codex Bridge Adapter 负责桥接上下文和操作。

## 八、验收标准

L4 状态机通过标准：

1. approved 能进入 ACCEPTED。
2. changes_requested 能进入 REPAIR_REQUESTED。
3. 修复提交后能重新进入审查。
4. blocked 能进入 MANUAL_REQUIRED。
5. stale review 能进入 MANUAL_REQUIRED。
6. repair_round 超限能进入 MANUAL_REQUIRED。
7. 所有状态转移可追溯。

## 九、最终结论

L4 自动返工闭环必须由状态机驱动。

Codex 是桥接器，不是裁判。

ChatGPT 是审查者。

Gate 是最终裁决者。
