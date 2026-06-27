# Phase5 Real Execution Integration

## 1. 定位

本文档定义 Phase5 从工程化收口进入真实执行接入的最短路径。

从本文档开始，不再继续拆分零散契约、builder、adapter。

真实执行接入包只做三件事：

1. 接入真实 MCP 审查。
2. 接入真实 Claude Code 返工。
3. 跑一次完整人工端到端演练。

当前默认模式仍然是 manual_gate。

production_enforcer 仍然保持关闭。

## 2. 当前完成基础

当前系统已经完成：

- ChatGPT review integration。
- Claude repair loop。
- Gate production decision。
- L4 production acceptance。
- Phase5 enablement。
- Phase5 readiness。
- Phase5 manual approval draft workflow。
- Phase5 rollback plan。
- Phase5 audit log。
- Phase5 dry-run acceptance。
- Phase5 final acceptance。
- Phase5 production cutover plan。

因此下一步不再补治理文档，而是进入真实执行接入。

## 3. 真实执行总链路

真实执行链路为：

code change
-> GitHub checks
-> ChatGPT real MCP review
-> review.json readback verify
-> chatgpt-review-result.json
-> approved / changes_requested / blocked
-> changes_requested 时 Claude Code 真实返工
-> claude-repair-handoff.json
-> Claude repair commit
-> claude-repair-submission.json
-> re-checks
-> re-review
-> gate-production-decision.json
-> audit log
-> manual confirmation
-> merge / deploy / rollback

## 4. 真实 MCP 审查接入

真实 MCP 审查只能由固定触发语进入：

- 审查 Claude 最新交接
- 审查 MCP 最新交接

不得由普通“审查”“看看代码”“检查一下”等表达触发完整闭环。

真实 MCP 审查必须执行：

1. get_latest_handoff。
2. get_patch。
3. 必要时 get_file_content。
4. submit_review。
5. get_file_content 回读 review.json。
6. readback verify。
7. 生成 chatgpt-review-result.json。
8. 写入 audit log。

所有工具调用必须显式传 repository。

repository 映射必须固定：

- 审查 Claude 最新交接 -> shunhang776/xinbaijin -> xinbaijin
- 审查 MCP 最新交接 -> shunhang776/xinbaijin-mcp -> xinbaijin-mcp

禁止跨仓库读取或写入。

## 5. review.json readback verify

submit_review 后必须回读 review.json，并验证：

- repository 正确。
- reviewed_commit 正确。
- based_on_branch_head 正确。
- verdict 正确。
- findings 已实际写入。
- UTF-8 合法。
- sha256 已返回。
- byte_length 已返回。
- line_ending 已返回。
- final_newline 已返回。

未通过 readback verify，不得进入 Gate allowed。

## 6. Claude Code 真实返工接入

当 ChatGPT verdict = changes_requested 时，必须进入 Claude repair loop。

Claude Code 只允许读取：

- claude-repair-handoff.json
- changed files
- test logs
- 必要上下文

Claude Code 禁止：

- 修改 review.json。
- 绕过 ChatGPT review。
- 绕过 Gate。
- 直接 push 到 dev。
- 自行生成 approved。
- 修改审查结果。
- 跳过 repair_round / repeated finding 保护。

Claude 修复完成后必须输出：

- repair commit。
- changed files。
- fix summary。
- resolved findings。
- claude-repair-submission.json。

## 7. Gate 真实裁决

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

任何条件不满足，必须 denied 或 manual_required。

denied / manual_required 不得降级为 allowed。

## 8. manual_gate 默认策略

真实执行接入后，默认仍然是：

- manual_gate = true
- production_enforcer = false

allowed 只代表可以进入人工确认后的 merge / deploy 流程。

allowed 不等于自动 merge。

allowed 不等于自动 deploy。

allowed 不等于自动 release。

## 9. audit log 落盘

真实执行必须产生 audit log。

初始落盘位置：

- artifacts/phase5/audit/*.jsonl
- artifacts/phase5/phase5-audit-log.json

audit log 至少记录：

- real_mcp_review_started
- real_mcp_review_completed
- review_json_readback_verified
- claude_repair_started
- claude_repair_completed
- gate_production_decision_created
- manual_required_recorded
- rollback_started
- rollback_completed

## 10. rollback 演练

真实执行接入包完成后，必须做一次 rollback 演练。

rollback 演练至少覆盖：

1. 停止 production_enforcer 入口。
2. 回退到 manual_gate。
3. 保留失败 artifact。
4. 保留 audit log。
5. 验证 workflow 权限仍是只读。
6. 验证 no auto merge。
7. 验证 no auto deploy。
8. 验证 manual_required 可人工接管。

## 11. 完整人工端到端演练

真实执行接入完成后，必须跑一次完整人工演练：

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
12. 人工确认是否允许进入 production_enforcer 设计。

## 12. 当前禁止行为

真实执行接入阶段仍然禁止：

- 自动启用 production_enforcer。
- 自动 merge PR。
- 自动 push 到 main 或 dev。
- 自动 deploy。
- 自动 release。
- 自动评论 PR。
- 自动绕过 ChatGPT review。
- 自动绕过 Claude repair loop。
- 自动绕过 Gate rules。
- 自动绕过 audit log。
- 自动绕过 rollback plan。
- Codex 代替 ChatGPT 审查。
- Codex 代替 Claude 修复。

## 13. 交付标准

真实执行接入包完成的标准是：

1. 真实 MCP 审查能人工触发。
2. review.json 能真实回写。
3. review.json 能 readback verify。
4. chatgpt-review-result.json 能生成。
5. Claude repair handoff 能生成。
6. Claude Code 能按 handoff 修复。
7. repair submission 能生成。
8. Gate decision 能生成。
9. audit log 能落盘。
10. manual_required 能人工处理。
11. rollback 能演练。
12. production_enforcer 仍保持关闭。

## 14. 下一步

本文档合并后，直接进入真实执行接入实现。

不再继续新增细碎治理契约。

真实执行接入实现以一次人工端到端演练为验收标准。
