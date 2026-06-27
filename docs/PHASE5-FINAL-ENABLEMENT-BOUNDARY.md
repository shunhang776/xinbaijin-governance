# Phase5 Final Enablement Boundary

## 1. 定位

本文档记录 Phase5 正式启用前的最终边界。

当前系统已经完成 ChatGPT 审查接入、Claude 返工闭环、Gate 生产裁决、L4 生产验收、Phase5 enablement、Phase5 readiness、manual approval draft workflow、rollback plan 和 audit log 契约。

当前阶段仍然不得直接启用 production_enforcer。

Phase5 最终启用必须是显式、人工确认、可审计、可回滚的生产动作。

## 2. 当前已完成基础

Phase5 启用前已经完成以下工程基础：

1. ChatGPT review integration acceptance。
2. Claude repair loop acceptance。
3. Gate production acceptance。
4. L4 production acceptance。
5. Phase5 enablement schema。
6. Phase5 enablement builder。
7. Phase5 readiness checker。
8. Phase5 enablement 到 Gate / L4 adapter。
9. Phase5 manual approval draft workflow。
10. Phase5 rollback plan schema。
11. Phase5 audit log schema。

## 3. Phase5 启用模式

Phase5 enablement 当前支持三种模式：

- draft
- manual_gate
- production_enforcer

draft 表示仅生成草案，不允许生产放行。

manual_gate 表示可进入人工 Gate 流程，但不自动生产放行。

production_enforcer 表示真正生产执行器模式，只有满足全部前置条件后才允许启用。

当前默认状态必须保持 draft 或 manual_gate。

## 4. production_enforcer 启用硬条件

启用 production_enforcer 必须同时满足：

1. production_enabled = true。
2. mode = production_enforcer。
3. ChatGPT review integration 已验收。
4. Claude repair loop 已验收。
5. Gate production decision 已验收。
6. L4 production acceptance 已验收。
7. rollback plan 已定义并 approved。
8. audit log 已定义并可生成。
9. protected branch rules 已定义。
10. manual_required 处理流程已定义。
11. owner approval = true。
12. gate owner approval = true。
13. rollback owner approval = true。

任一条件不满足时，不得启用 production_enforcer。

## 5. rollback 边界

Phase5 production_enforcer 启用前，rollback plan 必须满足：

- rollback_ready = true。
- mode = manual_ready。
- rollback_owner_approved = true。
- gate_owner_approved = true。
- repository_owner_approved = true。
- rollback_triggers 非空。
- rollback_steps 非空。
- verification_checks 非空。

如果 rollback plan 未 ready，Phase5 只能停留在 draft 或 manual_gate。

## 6. audit log 边界

Phase5 production_enforcer 启用前，audit log 必须可记录：

- phase5_enablement_created
- phase5_readiness_checked
- phase5_manual_approval_draft_created
- phase5_rollback_plan_created
- phase5_audit_log_created
- production_enforcer_enabled
- production_enforcer_disabled
- rollback_started
- rollback_completed
- manual_required_recorded
- policy_violation_recorded

production_enforcer_enabled 类型的审计记录必须满足：

- manual_confirmation = true。
- owner_approval = true。
- gate_owner_approval = true。
- rollback_owner_approval = true。
- artifacts_verified = true。
- sha256_available = true。
- utf8_valid = true。
- line_ending_recorded = true。

没有审计记录，不得生产启用。

## 7. GitHub Actions 权限边界

Phase5 最终启用前，所有 draft workflow 必须保持只读：

- permissions.contents = read。
- 不使用 pull_request_target。
- 不使用 contents: write。
- 不使用 pull-requests: write。
- 不使用 issues: write。
- 不执行 git push。
- 不执行 gh pr merge。
- 不执行 gh pr comment。
- 不调用 submit_review。
- 不写 review.json。

任何写权限 workflow 都必须单独设计、单独验收、单独记录审计日志。

## 8. ChatGPT 审查边界

Phase5 不能替代 ChatGPT 审查。

生产放行前必须存在可信的 chatgpt-review-result.json，并满足：

- verdict = approved。
- readback fully verified。
- reviewed_commit 匹配 candidate commit。
- based_on_branch_head 匹配当前分支头。
- findings 已回读验证。
- review_commit 存在。
- stale review 未触发。
- branch head changed 未触发。

Codex 不得生成真实 approved。

## 9. Claude 返工边界

当 ChatGPT verdict = changes_requested 时，必须进入 Claude repair loop。

必须经过：

- claude-repair-handoff.json
- REPAIR_REQUESTED
- claude-repair-submission.json
- REPAIR_SUBMITTED
- re-checks
- re-review
- Gate decision

不得跳过 Claude repair loop 直接 allowed。

## 10. Gate 裁决边界

Gate production decision 为 allowed 时必须满足：

- checks_passed = true。
- chatgpt_review_approved = true。
- review_readback_verified = true。
- l4_accepted = true。
- branch_head_unchanged = true。
- no_stale_review = true。
- no_repair_guard_block = true。
- artifacts_verified = true。
- policy_passed = true。
- reason_code = all_required_conditions_met。

denied 或 manual_required 不得降级为 allowed。

## 11. L4 状态边界

L4 只有在 REVIEW_APPROVED 状态收到 GATE_ALLOWED 后，才允许进入 ACCEPTED。

以下状态不得直接进入 ACCEPTED：

- WAIT_CODE
- CHECKS_RUNNING
- WAIT_REVIEW
- REVIEW_DENIED
- REPAIR_REQUESTED
- REPAIR_SUBMITTED
- MANUAL_REQUIRED

GATE_DENIED 必须进入 MANUAL_REQUIRED。

## 12. manual_required 边界

出现以下情况必须 manual_required：

- ChatGPT review blocked。
- ChatGPT review changes_requested 超出 repair round。
- repeated finding detected。
- stale review detected。
- branch head changed。
- review readback 未 verified。
- Gate decision denied。
- Gate decision manual_required。
- rollback plan 缺失。
- audit log 缺失。
- artifacts 不可信。
- workflow 权限不符合边界。

manual_required 必须由人工处理，不得自动吞掉。

## 13. 当前仍然禁止的行为

当前仍然禁止：

- 自动启用 production_enforcer。
- 自动 merge PR。
- 自动 push 到 main 或 dev。
- 自动部署生产。
- 自动创建 release。
- 自动评论 PR。
- 自动写 review.json。
- 自动调用 submit_review。
- 自动绕过 ChatGPT review。
- 自动绕过 Claude repair loop。
- 自动绕过 Gate rules engine。
- 自动绕过 rollback plan。
- 自动绕过 audit log。
- 自动绕过 protected branch rules。
- Codex 代替 ChatGPT 审查代码。
- Codex 代替 Claude 修复代码。
- draft workflow 使用写权限执行不可信代码。

## 14. 最终启用前检查清单

Phase5 production_enforcer 启用前，必须人工确认：

1. npm test 全绿。
2. governance-ci 全绿。
3. L4 pipeline dry-run 全绿。
4. ChatGPT review integration acceptance 已合并。
5. Claude repair loop acceptance 已合并。
6. Gate production acceptance 已合并。
7. L4 production acceptance 已合并。
8. Phase5 enablement schema 已合并。
9. Phase5 readiness checker 已合并。
10. Phase5 manual approval draft workflow 已合并。
11. rollback plan schema 已合并。
12. audit log schema 已合并。
13. rollback plan ready。
14. audit log 可生成。
15. protected branch rules 已确认。
16. manual_required 处理流程已确认。
17. owner / gate owner / rollback owner 三方确认。

## 15. 结论

Phase5 最终启用必须以安全边界优先。

当前系统可以继续推进 Phase5 dry-run 验收和最终收口，但不得直接进入 production_enforcer。

只有当 enablement、readiness、rollback、audit、Gate、L4 和人工审批全部满足后，才允许进入 production_enforcer 设计。

## 16. 下一步

下一步进入 12.9：Phase5 dry-run 验收。

12.9 需要验证：

- Phase5 enablement artifact。
- Phase5 readiness artifact。
- manual approval draft workflow。
- rollback plan fixture。
- audit log fixture。
- production_enforcer 未被自动启用。
