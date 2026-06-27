# Phase5 Production Cutover Plan

## 1. 定位

本文档是 Phase5 从工程化收口进入受控生产运行前的总切换方案。

本文档一次性定义：

- 谁触发。
- 谁审查。
- 谁修复。
- 谁批准。
- 谁合并。
- 谁回滚。
- 哪些 checks 必须通过。
- 哪些情况必须 manual_required。
- audit log 存放位置。
- rollback 如何执行。
- 什么时候允许 production_enforcer = true。

当前文档不启用 production_enforcer，不修改 GitHub Rulesets，不修改分支保护，不执行真实部署。

## 2. 当前状态

当前系统已经完成：

- ChatGPT review integration。
- Claude repair loop。
- Gate production decision。
- L4 production acceptance。
- Phase5 enablement。
- Phase5 readiness。
- Phase5 manual approval draft workflow。
- Phase5 rollback plan contract。
- Phase5 audit log contract。
- Phase5 dry-run acceptance。
- Phase5 final acceptance。

当前状态是：

Phase5 engineering acceptance complete.
Production enforcement not enabled.
Manual controlled production cutover planning may begin.

## 3. 生产角色

Phase5 生产运行至少包含以下角色：

1. Owner

负责最终启用 production_enforcer，确认是否允许从 manual_gate 进入 production_enforcer。

2. Gate Owner

负责确认 Gate production decision 是否可信，确认 allowed / denied / manual_required 结果。

3. Rollback Owner

负责 rollback plan、rollback 演练和回滚执行确认。

4. ChatGPT Reviewer

负责真实代码审查，只有 ChatGPT 白槿审查器可以产生真实 review verdict。

5. Claude Repair Actor

负责根据 changes_requested 执行真实代码返工。

6. Repository Operator

负责 GitHub branch protection、Rulesets、required checks、merge / release / deploy 操作边界。

## 4. 生产触发入口

Phase5 生产化后允许的入口分为三类。

1. Manual Gate Entry

人工触发，用于受控试运行。

允许：

- 生成 phase5-enablement.json。
- 生成 phase5-readiness.json。
- 生成 gate-production-decision.json。
- 生成 audit log。
- 上传 artifact。

禁止：

- 自动 merge。
- 自动 push。
- 自动 deploy。
- 自动启用 production_enforcer。

2. Production Candidate Entry

生产候选执行入口。

允许在人工确认后执行：

- 真实 MCP 审查。
- 真实 ChatGPT review result。
- 真实 review.json readback verify。
- 真实 Claude repair handoff / submission。
- Gate production decision。
- audit log 落盘。

默认仍禁止：

- 自动 merge。
- 自动 deploy。
- 自动 release。

3. Production Enforcer Entry

最终生产执行入口。

只有满足全部启用条件后才允许打开。

## 5. 标准流水线

生产级标准流水线为：

code detected
-> checks started
-> checks passed
-> real ChatGPT MCP review
-> chatgpt-review-result.json
-> review.json readback verify
-> approved 或 changes_requested 或 blocked
-> changes_requested 时进入 Claude repair loop
-> claude-repair-handoff.json
-> Claude repair
-> claude-repair-submission.json
-> re-checks
-> re-review
-> gate-production-decision.json
-> GATE_ALLOWED 或 GATE_DENIED
-> ACCEPTED 或 MANUAL_REQUIRED
-> audit log
-> merge / deploy / rollback 人工或受控执行

## 6. GitHub protected branch / Rulesets

必须保护：

- main
- dev

必须禁止：

- direct push。
- force push。
- delete protected branch。
- bypass required checks。
- bypass review。
- bypass Gate。
- bypass manual_required。
- bypass rollback process。

## 7. Required Checks

进入生产前，至少必须强制以下 checks：

- governance-ci / governance
- L4 Pipeline Dry Run / L4 pipeline dry-run

后续如果新增 production gate workflow，必须先以 draft / read-only 模式运行，通过人工验收后才能加入 required checks。

## 8. Workflow 权限边界

当前所有 draft workflow 必须保持：

- permissions.contents = read。
- 不使用 pull_request_target。
- 不使用 contents: write。
- 不使用 pull-requests: write。
- 不使用 issues: write。

禁止在未单独验收前加入：

- git push
- gh pr merge
- gh pr comment
- submit_review
- 写 review.json
- 自动 deploy
- 自动 release

任何写权限 workflow 都必须单独设计、单独审查、单独验收、单独审计。

## 9. 真实 MCP 审查接入要求

真实 MCP 审查接入生产前，必须满足：

- 只能由固定触发语触发。
- repository 映射必须正确。
- branch 必须是 dev。
- commit 必须是完整 40 位 SHA。
- get_latest_handoff 必须显式传 repository。
- get_patch 必须显式传 repository 和完整 commit。
- 所有 changed_files 必须审查。
- 遇到 JSON、Unicode、Base64、编码、引号、转义符、LF、CRLF、混合行尾、文件末尾换行问题，必须调用 get_file_content。
- submit_review 前必须完成 stale review guard。
- submit_review 后必须 readback verify review.json。
- 不得跨仓库读取。
- 不得跨仓库写入。
- 不得把 Codex 作为审查者。

## 10. 真实 Claude 返工接入要求

真实 Claude Code 返工接入生产前，必须满足：

- 只处理 ChatGPT changes_requested。
- 只读取 claude-repair-handoff.json。
- 不得修改 review.json。
- 不得绕过 ChatGPT review。
- 不得绕过 Gate。
- 不得直接 push 到 dev。
- 修复完成后必须生成 claude-repair-submission.json。
- 修复后必须重新 checks。
- 修复后必须重新 ChatGPT review。
- repeated finding 必须进入 manual_required。
- repair_round 超限必须进入 manual_required。

## 11. Gate 生产裁决要求

Gate allowed 必须同时满足：

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

任一条件不满足，必须 denied 或 manual_required。

denied / manual_required 不得降级为 allowed。

## 12. Manual Required 流程

以下情况必须进入 manual_required：

- ChatGPT review blocked。
- ChatGPT review changes_requested 且 repair_round 超限。
- repeated finding detected。
- stale review detected。
- branch head changed。
- review readback 未 verified。
- Gate decision denied。
- Gate decision manual_required。
- rollback plan 缺失。
- audit log 缺失。
- artifact 不可信。
- workflow 权限不符合边界。
- 真实 MCP 工具调用失败。
- 真实 Claude 修复失败。

manual_required 必须由人工处理，不得自动吞掉。

## 13. Merge / Deploy / Release 责任边界

allowed 后仍不得默认自动 merge / deploy / release。

必须明确：

- 谁可以 merge。
- merge 到哪个分支。
- 是否需要二次确认。
- deploy 是否自动。
- release 是否自动。
- rollback owner 是否已在线。
- audit log 是否已写入。
- Gate decision 是否可追溯。

默认策略：

allowed 只代表可以进入人工确认后的 merge / deploy 流程。
allowed 不等于自动 merge。

## 14. Audit Log 落盘策略

audit log 必须记录：

- phase5_enablement_created。
- phase5_readiness_checked。
- phase5_manual_approval_draft_created。
- phase5_rollback_plan_created。
- phase5_audit_log_created。
- gate_production_decision_created。
- production_enforcer_enabled。
- production_enforcer_disabled。
- rollback_started。
- rollback_completed。
- manual_required_recorded。
- policy_violation_recorded。

建议初始落盘位置：

- artifacts/phase5/phase5-audit-log.json
- artifacts/phase5/audit/*.jsonl

后续生产化后可迁移到：

- GitHub artifact。
- SQLite。
- Cloudflare D1。
- 外部对象存储。

## 15. Rollback 操作手册

触发 rollback 的条件包括：

- production gate misfire。
- unexpected auto merge。
- wrong review commit。
- stale review bypassed。
- branch head guard bypassed。
- repair guard bypassed。
- manual_required not respected。
- artifact integrity failure。
- workflow permission violation。
- operator requested。

最小 rollback 步骤：

1. 停止 production_enforcer 入口。
2. 切回 manual_gate。
3. 禁用所有写权限 workflow。
4. 保留 audit log。
5. 固定当前失败 artifact。
6. 回退错误 merge 或部署。
7. 重新运行 dry-run。
8. 人工复盘。
9. 重新确认 required checks。
10. 重新确认 owner / gate owner / rollback owner。

## 16. Production Enforcer 启用条件

允许 production_enforcer = true 前，必须满足：

- Phase5 final acceptance 已合并。
- protected branch / required checks 已配置。
- GitHub Rulesets 已确认。
- 真实 MCP 审查已人工演练。
- 真实 Claude repair 已人工演练。
- Gate production decision 已人工演练。
- manual_required 已人工演练。
- rollback 已人工演练。
- audit log 已落盘。
- owner approval = true。
- gate owner approval = true。
- rollback owner approval = true。
- npm test 全绿。
- governance-ci 全绿。
- L4 pipeline dry-run 全绿。

## 17. 受控人工演练计划

正式启用前必须完成一次端到端人工演练：

1. 创建测试提交。
2. 触发真实 MCP 审查。
3. 生成真实 chatgpt-review-result.json。
4. 如果 approved，进入 Gate。
5. 如果 changes_requested，进入 Claude repair。
6. Claude repair 后重新 checks。
7. 重新 ChatGPT review。
8. 生成 Gate decision。
9. 生成 audit log。
10. 验证 rollback plan。
11. 验证 manual_required。
12. 人工确认是否允许进入 production_enforcer。

## 18. 当前结论

完成本文档后，Phase5 可以进入真实执行接入包。

但在真实执行接入包完成前，不得启用 production_enforcer。

下一步建议一次性做真实执行接入包，而不是继续拆小契约。
