# Gate Production Enablement Boundary

## 1. 定位

本文档记录第 10 步 Gate 生产裁决阶段的生产启用边界。

当前系统已经具备 Gate production decision schema、builder、rules engine、adapter、L4 event adapter、negative paths 测试、dry-run artifact 接入，以及手动触发的 production gate draft workflow。

当前阶段仍未启用真正的生产放行。

Gate production draft workflow 只能生成 gate-production-decision.json 草案，不得执行 merge、push、PR comment、review.json 写入或任何生产写操作。

## 2. 当前已完成能力

第 10 步当前已完成以下能力：

1. Gate production decision schema。
2. Gate production decision fixtures 和 schema test。
3. Gate production decision builder。
4. Gate allow / deny / manual_required rules engine。
5. L4 run result + ChatGPT review result 到 Gate decision 的 adapter。
6. Gate decision 到 L4 GATE_ALLOWED / GATE_DENIED event adapter。
7. Gate negative paths 测试。
8. Gate production decision 接入 dry-run artifact。
9. 手动触发的 Gate production draft workflow 草案。

## 3. 当前 Gate 输入

Gate production decision 只能基于以下输入生成：

- l4-run-result.json
- chatgpt-review-result.json
- l4-dry-run-artifact.json
- gate-input.json，若存在

其中 chatgpt-review-result.json 必须来自 ChatGPT 白槿审查器，不得由 Codex 伪造。

## 4. 当前 Gate 输出

Gate 当前输出为：

- gate-production-decision.json

该文件只表示生产 Gate 裁决草案，不代表已经放行生产操作。

decision 字段可能为：

- allowed
- denied
- manual_required

reason_code 字段必须解释裁决原因。

## 5. allowed 的必要条件

Gate decision 为 allowed 时，必须同时满足：

1. checks_passed = true。
2. chatgpt_review_approved = true。
3. review_readback_verified = true。
4. l4_accepted = true。
5. branch_head_unchanged = true。
6. no_stale_review = true。
7. no_repair_guard_block = true。
8. artifacts_verified = true。
9. policy_passed = true。

同时：

- review_verdict 必须是 approved。
- l4_final_state 必须是 ACCEPTED。
- reason_code 必须是 all_required_conditions_met。

任一条件不满足时，不得 allowed。

## 6. denied 条件

以下情况必须 denied：

- ChatGPT review verdict 不是 approved。
- L4 final_state 不是 ACCEPTED。
- checks 未通过。
- review readback 未 fully verified。
- stale review detected。
- branch head changed。
- repair guard blocked。
- policy violation。

denied 必须映射为 L4 GATE_DENIED event。

## 7. manual_required 条件

以下情况必须 manual_required：

- 缺失必要 artifact。
- 人工 override required。
- 无法可靠判断生产裁决。
- 输入文件不可信。
- 输入文件不完整。
- Gate workflow 自身出现工具错误。

manual_required 不得自动降级为 allowed。

manual_required 在 L4 中也必须表现为阻断，不得放行生产操作。

## 8. 当前仍然禁止的行为

当前阶段仍然禁止：

- 自动 merge PR。
- 自动 push 到 main 或 dev。
- 自动创建 release。
- 自动部署生产。
- 自动评论 PR。
- 自动写 review.json。
- 自动调用 submit_review。
- 自动绕过 ChatGPT review。
- 自动绕过 stale review guard。
- 自动绕过 branch head guard。
- 自动绕过 repair guard。
- Codex 生成真实 approved。
- Codex 代替 ChatGPT 审查代码。
- Gate workflow 使用 pull_request_target 执行不可信代码。
- Gate workflow 使用 contents: write。
- Gate workflow 使用 pull-requests: write。
- Gate workflow 使用 issues: write。

## 9. GitHub Actions 权限边界

Gate production draft workflow 必须保持：

- workflow_dispatch 手动触发。
- permissions.contents = read。
- 不使用 pull_request_target。
- 不执行 git push。
- 不执行 gh pr merge。
- 不执行 gh pr comment。
- 不写 review.json。
- 不调用 submit_review。
- 只上传 gate-production-decision.json artifact。

在生产启用前，不得扩大权限。

## 10. 与 L4 的关系

Gate decision 可以映射为 L4 event：

- allowed -> GATE_ALLOWED
- denied -> GATE_DENIED
- manual_required -> GATE_DENIED

L4 只有在 REVIEW_APPROVED 状态收到 GATE_ALLOWED 后，才可以进入 ACCEPTED。

L4 收到 GATE_DENIED 必须进入 MANUAL_REQUIRED。

## 11. 与 ChatGPT 审查的关系

Gate 不能替代 ChatGPT 审查。

Gate 只能消费 ChatGPT review result，并检查：

- verdict 是否 approved。
- reviewed_commit 是否匹配。
- readback 是否 fully verified。
- findings 是否匹配。
- review_commit 是否存在。
- stale / branch head guard 是否未触发。

## 12. 与 Claude 返工的关系

Gate 不能替代 Claude 修复。

当 review result 为 changes_requested 时，必须走 Claude repair handoff / repair submission / re-check / re-review 流程。

Gate 不得在 changes_requested 场景下 allowed。

## 13. 生产启用前置条件

真正启用生产 Gate 前，至少还需要完成：

1. 明确生产 Gate 的触发入口。
2. 明确 production branch 与 protected branch 策略。
3. 明确 GitHub Rulesets。
4. 明确 required checks。
5. 明确 artifact 来源可信度。
6. 明确谁可以手动触发 Gate。
7. 明确 allowed 后由谁执行 merge / deploy。
8. 明确 rollback 入口。
9. 明确审计日志保存策略。
10. 明确失败后的 manual_required 处理流程。

## 14. 第 10 步当前结论

当前 Gate production draft 已经具备生产裁决前的工程化基础。

但当前阶段仍然只是 draft，不是 production enforcer。

第 10 步最后需要通过收口验收，确认 Gate 生产裁决的 schema、builder、rules、adapter、negative paths、artifact 和 workflow 边界全部稳定。

## 15. 下一步

下一步是第 10.10：第 10 步收口验收。

收口验收需要记录：

- Gate production decision 契约。
- Gate rules engine。
- Gate decision adapter。
- Gate L4 event adapter。
- Gate negative paths。
- dry-run artifact。
- production draft workflow。
- 当前仍未启用真实生产放行。
