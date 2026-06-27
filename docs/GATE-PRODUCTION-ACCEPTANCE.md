# Gate Production Acceptance

## 1. 定位

本文档记录第 10 步 Gate 生产裁决阶段的工程化收口状态。

当前阶段已经完成 Gate production decision 契约、builder、rules engine、adapter、L4 event adapter、negative paths、dry-run artifact 接入、production gate draft workflow 草案，以及生产启用边界文档。

当前阶段仍未启用真正的生产放行器。

Gate production draft workflow 仍然只是只读草案 workflow，不执行 merge、push、comment、review.json 写入、submit_review 或生产部署。

## 2. 已完成能力

第 10 步当前已完成以下能力：

1. Gate production decision schema。
2. Gate production decision fixtures 和 schema test。
3. Gate production decision builder。
4. Gate allow / deny / manual_required rules engine。
5. L4 run result + ChatGPT review result 到 Gate decision 的 adapter。
6. Gate decision 到 L4 GATE_ALLOWED / GATE_DENIED event adapter。
7. Gate negative paths 测试。
8. Gate production decision 接入 dry-run artifact。
9. GitHub Actions production-gate draft workflow 草案。
10. Gate 生产启用边界文档。

## 3. 当前 Gate 裁决链路

当前已验证的 Gate 裁决链路为：

l4-run-result.json
-> chatgpt-review-result.json
-> gate-production-decision.json
-> GATE_ALLOWED / GATE_DENIED
-> L4 ACCEPTED / MANUAL_REQUIRED

其中：

- allowed 映射为 GATE_ALLOWED。
- denied 映射为 GATE_DENIED。
- manual_required 映射为 GATE_DENIED。

## 4. 当前核心契约

第 10 步新增或接入的核心契约包括：

- schemas/gate-production-decision.schema.json
- schemas/l4-dry-run-artifact.schema.json
- schemas/l4-event.schema.json

Gate production decision 必须包含：

- decision_id
- task_id
- run_id
- repository
- branch
- candidate_commit
- reviewed_commit
- review_commit
- chatgpt_review_result_id
- l4_run_result_id
- review_verdict
- l4_final_state
- decision
- reason_code
- required_conditions
- source_artifacts
- created_at

## 5. 当前核心实现

第 10 步新增或接入的核心实现包括：

- src/gate/production-decision.mjs
- src/gate/production-rules.mjs
- src/gate/gate-decision-adapter.mjs
- src/gate/gate-decision-l4-adapter.mjs
- scripts/l4/build-dry-run-gate-decision.mjs
- scripts/l4/build-dry-run-artifact.mjs
- .github/workflows/gate-production-draft.yml

## 6. 当前核心测试

第 10 步核心测试包括：

- test/gate-production-decision-schema.test.js
- test/gate-production-decision-builder.test.js
- test/gate-production-rules.test.js
- test/gate-decision-adapter.test.js
- test/gate-decision-l4-adapter.test.js
- test/gate-production-negative-paths.test.js
- test/l4-dry-run-gate-decision-artifact.test.js
- test/github/gate-production-draft-workflow.test.js
- test/gate-production-enablement-boundary-doc.test.js

## 7. allowed 条件

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

## 8. denied / manual_required 条件

以下情况必须 denied 或 manual_required：

- ChatGPT review verdict 不是 approved。
- L4 final_state 不是 ACCEPTED。
- checks 未通过。
- review readback 未 fully verified。
- stale review detected。
- branch head changed。
- repair guard blocked。
- policy violation。
- 缺失必要 artifact。
- 人工 override required。
- 无法可靠判断生产裁决。

不得把 denied 或 manual_required 自动降级为 allowed。

## 9. 当前 production draft workflow 边界

Gate production draft workflow 当前必须保持：

- workflow_dispatch 手动触发。
- permissions.contents = read。
- 不使用 pull_request_target。
- 不执行 git push。
- 不执行 gh pr merge。
- 不执行 gh pr comment。
- 不写 review.json。
- 不调用 submit_review。
- 不自动生成 approved。
- 只生成 gate-production-decision.json artifact。

## 10. 当前仍然禁止的行为

当前阶段仍然禁止：

- 自动 merge PR。
- 自动 push 到 main 或 dev。
- 自动部署生产。
- 自动创建 release。
- 自动评论 PR。
- 自动写 review.json。
- 自动调用 submit_review。
- 自动绕过 ChatGPT review。
- 自动绕过 stale review guard。
- 自动绕过 branch head guard。
- 自动绕过 repair guard。
- 自动绕过 Gate rules engine。
- Codex 代替 ChatGPT 审查代码。
- Codex 生成真实 approved。
- Gate workflow 使用写权限执行不可信代码。

## 11. dry-run 验收状态

当前 dry-run / test 层已经可以验证：

- Gate production decision 可以由 l4-run-result.json 和 chatgpt-review-result.json 生成。
- allowed decision 可以映射为 GATE_ALLOWED。
- denied decision 可以映射为 GATE_DENIED。
- manual_required decision 可以映射为 GATE_DENIED。
- GATE_ALLOWED 可以驱动 L4 进入 ACCEPTED。
- GATE_DENIED 可以驱动 L4 进入 MANUAL_REQUIRED。
- Gate production decision 可以进入 dry-run artifact manifest。
- production gate draft workflow 只读且不执行生产写操作。

## 12. 第 10 步验收结论

第 10 步 Gate 生产裁决阶段已经完成工程化闭环准备。

当前系统已经具备 Gate production decision 的契约、生成、规则裁决、L4 event 映射、负例保护、dry-run artifact 接入和 draft workflow。

但当前系统仍未启用真正的 production enforcer。

第 10 步可以收口，并进入第 11 步：

L4 生产验收文档。

## 13. 下一步

下一步进入第 11 步：L4 生产验收文档。

第 11 步重点是从整体视角汇总：

- ChatGPT 审查接入。
- Claude 返工闭环。
- Gate 生产裁决。
- L4 pipeline。
- dry-run artifact。
- 生产启用前仍需人工确认的边界。
