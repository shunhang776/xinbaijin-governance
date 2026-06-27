# L4 Production Acceptance

## 1. 定位

本文档记录 L4 自动审查与返工闭环进入 Phase5 正式启用前的生产验收状态。

当前系统已经完成：

- ChatGPT 审查接入工程底座。
- Claude 返工 handoff / submission 闭环。
- Gate production decision 工程底座。
- L4 state machine / pipeline / run result。
- dry-run artifact。
- production gate draft workflow。

当前系统尚未启用真正的生产放行器。

## 2. 当前已完成阶段

当前已完成以下阶段：

1. 第 8 步：真实 ChatGPT 审查接入前工程底座。
2. 第 9 步：Claude 返工 handoff 接入。
3. 第 10 步：Gate 生产裁决工程底座。

相关收口文档包括：

- docs/CHATGPT-REVIEW-INTEGRATION-ACCEPTANCE.md
- docs/CLAUDE-REPAIR-LOOP-ACCEPTANCE.md
- docs/GATE-PRODUCTION-ACCEPTANCE.md
- docs/GATE-PRODUCTION-ENABLEMENT-BOUNDARY.md
- docs/L4-DRY-RUN-ACCEPTANCE.md

## 3. L4 总体闭环

当前已验证的完整 L4 闭环为：

code detected
-> checks started
-> checks passed
-> ChatGPT review
-> approved / changes_requested / blocked
-> Claude repair handoff
-> Claude repair submission
-> re-checks
-> re-review
-> Gate production decision
-> GATE_ALLOWED / GATE_DENIED
-> ACCEPTED / MANUAL_REQUIRED

## 4. ChatGPT 审查接入验收

ChatGPT 审查接入阶段已经完成：

- chatgpt-review-invocation schema。
- chatgpt-review-invocation builder。
- Codex Bridge CLI 输出 invocation。
- chatgpt-review-result schema。
- chatgpt-review-result builder。
- chatgpt-review-result 到 L4 event adapter。
- fake MCP review executor。
- dry-run 生成 chatgpt-review-result.json。
- MCP review execution boundary 文档。

当前仍未启用真实 MCP 自动审查执行。

当前仍未自动调用 submit_review。

当前仍未自动写 review.json。

## 5. Claude 返工闭环验收

Claude 返工闭环阶段已经完成：

- claude-repair-handoff schema。
- claude-repair-handoff builder。
- claude-repair-handoff 到 REPAIR_REQUESTED adapter。
- claude-repair-submission schema。
- claude-repair-submission builder。
- claude-repair-submission 到 REPAIR_SUBMITTED adapter。
- REPAIR_REQUESTED / REPAIR_SUBMITTED 接入 L4 pipeline。
- 返工后重新 checks / review / gate。
- repair_round / max_repair_round 保护。
- repeated finding 保护。

当前仍未自动调用真实 Claude Code 修复代码。

当前仍未自动提交修复 commit。

当前仍未自动 push 到 dev。

## 6. Gate 生产裁决验收

Gate 生产裁决阶段已经完成：

- gate-production-decision schema。
- gate-production-decision builder。
- Gate production rules engine。
- L4 run result + ChatGPT review result 到 Gate decision adapter。
- Gate decision 到 GATE_ALLOWED / GATE_DENIED adapter。
- Gate negative paths 测试。
- Gate decision 接入 dry-run artifact。
- Gate production draft workflow。
- Gate production enablement boundary 文档。

当前仍未启用真正 production enforcer。

当前 Gate production draft workflow 只能生成 gate-production-decision.json 草案。

## 7. 当前核心契约

当前核心契约包括：

- schemas/chatgpt-review-invocation.schema.json
- schemas/chatgpt-review-result.schema.json
- schemas/claude-repair-handoff.schema.json
- schemas/claude-repair-submission.schema.json
- schemas/gate-production-decision.schema.json
- schemas/l4-event.schema.json
- schemas/l4-run-result.schema.json
- schemas/l4-dry-run-artifact.schema.json
- schemas/l4-task-state.schema.json

## 8. 当前核心实现

当前核心实现包括：

- src/chatgpt/review-invocation.mjs
- src/chatgpt/review-result.mjs
- src/chatgpt/mcp-review-execution-port.mjs
- src/chatgpt/fake-mcp-review-executor.mjs
- src/claude/repair-handoff.mjs
- src/claude/repair-submission.mjs
- src/gate/production-decision.mjs
- src/gate/production-rules.mjs
- src/gate/gate-decision-adapter.mjs
- src/gate/gate-decision-l4-adapter.mjs
- src/l4/l4-machine.mjs
- src/l4/l4-codex-pipeline.mjs
- src/l4/l4-run-result.mjs
- src/l4/review-guard.mjs
- src/l4/repair-guard.mjs

## 9. 当前核心 workflow

当前核心 workflow 包括：

- .github/workflows/l4-pipeline-dry-run.yml
- .github/workflows/gate-production-draft.yml

其中：

- l4-pipeline-dry-run.yml 是 dry-run。
- gate-production-draft.yml 是手动触发的 production gate draft。
- 二者都不得作为真正 production enforcer 使用。

## 10. 当前 artifact

当前 dry-run artifact 应覆盖：

- l4-pipeline-input.json
- l4-pipeline-output.json
- l4-run-result.json
- l4-dry-run-artifact.json
- codex-bridge-result.json
- chatgpt-review-invocation.json
- chatgpt-review-result.json
- claude-repair-handoff.json，changes_requested 时存在
- claude-repair-submission.json，后续接入真实 Claude 修复后存在
- gate-production-decision.json

## 11. 当前强保护

当前系统已经覆盖以下保护：

- stale review protection。
- branch head changed protection。
- review readback verification。
- repair round exceeded protection。
- repeated finding protection。
- Gate allowed required conditions。
- Gate denied negative paths。
- no automatic write boundary。
- read-only draft workflow boundary。

## 12. 当前仍然禁止的行为

当前仍然禁止：

- 自动调用真实 MCP 审查。
- 自动调用 submit_review。
- 自动写 review.json。
- 自动调用真实 Claude Code。
- 自动修改业务代码。
- 自动提交修复 commit。
- 自动 push 到 main 或 dev。
- 自动 merge PR。
- 自动部署生产。
- 自动创建 release。
- 自动评论 PR。
- 自动绕过 ChatGPT review。
- 自动绕过 review guard。
- 自动绕过 repair guard。
- 自动绕过 Gate rules engine。
- Codex 代替 ChatGPT 审查代码。
- Codex 代替 Claude 修复代码。
- Gate workflow 使用写权限执行不可信代码。

## 13. 生产启用前置条件

进入 Phase5 正式启用前，至少还需要完成：

1. 明确真实 MCP 审查执行入口。
2. 明确真实 Claude repair execution 入口。
3. 明确 production Gate 的最终权限模型。
4. 明确 GitHub Rulesets。
5. 明确 required checks。
6. 明确 protected branch 策略。
7. 明确 artifact 来源可信度。
8. 明确 allowed 后的人工或自动执行者。
9. 明确 rollback 策略。
10. 明确审计日志保存策略。
11. 明确 manual_required 的人工处理流程。
12. 明确生产启用开关。

## 14. L4 生产验收结论

当前 L4 已完成生产启用前的工程化验收准备。

当前系统具备：

- 审查接入契约。
- 返工闭环契约。
- Gate 裁决契约。
- L4 状态机闭环。
- dry-run 产物闭环。
- 负例保护。
- 只读 workflow 草案。
- 生产启用边界。

但当前系统仍未正式启用生产自动放行。

因此，当前结论为：

L4 production acceptance ready for Phase5 enablement planning, but not yet production enforcing.

## 15. 下一步

下一步进入第 12 步：Phase5 正式启用。

第 12 步必须谨慎推进，重点不是继续堆功能，而是定义生产启用开关、权限边界、人工确认点、回滚策略和最终启用流程。
