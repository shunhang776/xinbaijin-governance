# Claude Repair Loop Acceptance

## 1. 定位

本文档记录第 9 步 Claude 返工 handoff 接入阶段的工程化收口状态。

当前阶段已经完成 Claude repair handoff、Claude repair submission、L4 REPAIR_REQUESTED / REPAIR_SUBMITTED 事件适配、返工后重新进入 checks / review / gate 的 pipeline 验证，以及 repair guard 保护。

当前阶段尚未接入真实 Claude Code 自动修复执行，尚未自动提交修复代码，尚未启用生产 Gate。

## 2. 已完成能力

第 9 步当前已完成以下能力：

1. Claude repair handoff schema。
2. Claude repair handoff builder。
3. Claude repair handoff 到 L4 REPAIR_REQUESTED event adapter。
4. REPAIR_REQUESTED 进入 L4 pipeline。
5. Claude repair submission schema。
6. Claude repair submission builder。
7. Claude repair submission 到 L4 REPAIR_SUBMITTED event adapter。
8. REPAIR_SUBMITTED 进入 L4 pipeline。
9. 返工后重新进入 checks。
10. 返工后重新进入 review。
11. review approved 后进入 gate。
12. gate allowed 后进入 ACCEPTED。
13. repair_round / max_repair_round 保护。
14. repeated finding 保护。
15. repair guard 保护事件进入 MANUAL_REQUIRED。

## 3. 当前返工闭环链路

当前已验证的返工闭环为：

changes_requested
-> chatgpt-review-result.json
-> claude-repair-handoff.json
-> REPAIR_REQUESTED
-> claude-repair-submission.json
-> REPAIR_SUBMITTED
-> CHECKS_STARTED
-> CHECKS_PASSED
-> REVIEW_APPROVED
-> GATE_ALLOWED
-> ACCEPTED

## 4. 当前核心契约

第 9 步新增或接入的核心契约包括：

- schemas/claude-repair-handoff.schema.json
- schemas/claude-repair-submission.schema.json
- schemas/l4-event.schema.json

其中 L4 event schema 已支持：

- REPAIR_REQUESTED
- REPAIR_SUBMITTED
- REPAIR_ROUND_EXCEEDED
- REPEATED_FINDING_DETECTED

## 5. 当前核心实现

第 9 步新增或接入的核心实现包括：

- src/claude/repair-handoff.mjs
- src/claude/repair-submission.mjs
- src/l4/claude-repair-handoff-adapter.mjs
- src/l4/claude-repair-submission-adapter.mjs
- src/l4/repair-guard.mjs

## 6. 当前核心测试

第 9 步核心测试包括：

- test/claude-repair-handoff-schema.test.js
- test/claude-repair-handoff-builder.test.js
- test/claude-repair-handoff-l4-adapter.test.js
- test/claude-repair-handoff-l4-pipeline.test.js
- test/claude-repair-submission-schema.test.js
- test/claude-repair-submission-builder.test.js
- test/claude-repair-submission-l4-adapter.test.js
- test/claude-repair-submission-l4-pipeline.test.js
- test/claude-repair-loop-l4-pipeline.test.js
- test/repair-guard.test.js

## 7. 当前保护边界

repair guard 已覆盖：

1. fresh repair handoff：允许继续生成 REPAIR_REQUESTED。
2. repair_round_exceeded：生成 REPAIR_ROUND_EXCEEDED，并进入 MANUAL_REQUIRED。
3. repeated_finding_detected：生成 REPEATED_FINDING_DETECTED，并进入 MANUAL_REQUIRED。

当 repair_round 已达到 max_repair_round 时，不得继续自动返工。

当同一 finding 在上一轮返工后重复出现时，不得继续自动返工。

## 8. 当前仍然禁止的行为

当前阶段仍然禁止：

- 自动调用真实 Claude Code。
- 自动修改业务代码。
- 自动提交修复 commit。
- 自动 push 到 dev。
- 自动绕过 ChatGPT review。
- 自动绕过 repair guard。
- 自动绕过 Gate。
- Codex 代替 Claude 修复代码。
- Codex 代替 ChatGPT 审查代码。
- Codex 直接写 review.json。
- Codex 直接决定 approved。

## 9. dry-run 验收状态

当前 dry-run / test 层已经可以验证：

- changes_requested review result 可以转成 Claude repair handoff。
- Claude repair handoff 可以转成 REPAIR_REQUESTED。
- Claude repair submission 可以转成 REPAIR_SUBMITTED。
- REPAIR_SUBMITTED 后可以重新进入 CHECKS_STARTED / CHECKS_PASSED。
- 重新 review approved 后可以进入 GATE_ALLOWED。
- Gate allowed 后最终进入 ACCEPTED。
- repair_round 超限会进入 MANUAL_REQUIRED。
- repeated finding 会进入 MANUAL_REQUIRED。

## 10. 第 9 步验收结论

第 9 步 Claude 返工 handoff 接入阶段已经完成工程化闭环准备。

当前系统已经具备从 ChatGPT changes_requested 到 Claude repair handoff，再到 Claude repair submission，并重新进入 L4 checks / review / gate 的完整模拟链路。

第 9 步可以收口，并进入第 10 步：

Gate 生产裁决。

## 11. 下一步

下一步进入第 10 步：Gate 生产裁决。

第 10 步重点是把当前 dry-run / test 级别的 gate allowed / gate denied 逻辑推进到生产裁决边界，明确哪些条件可以真正放行，哪些条件必须阻断。
