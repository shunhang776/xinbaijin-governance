# ChatGPT MCP Review Execution Boundary

## 1. 定位

本文档定义第 8 步真实 ChatGPT 审查接入时的执行边界。

本阶段的真实审查者只能是 ChatGPT 白槿审查器。

Codex Bridge Adapter 只负责生成 review invocation、搬运上下文、产出 artifact、记录状态，不审查代码，不写 review.json，不调用 submit_review，不决定 approved。

## 2. 固定触发语

只有以下两个精确触发语允许进入完整审查闭环：

- 审查 Claude 最新交接
- 审查 MCP 最新交接

其他包含“审查”“看看代码”“检查一下”等普通表达不得触发完整审查闭环。

## 3. 仓库映射

触发语“审查 Claude 最新交接”对应：

- repository = xinbaijin
- full repository = shunhang776/xinbaijin
- branch = dev

触发语“审查 MCP 最新交接”对应：

- repository = xinbaijin-mcp
- full repository = shunhang776/xinbaijin-mcp
- branch = dev

同一轮审查中，get_latest_handoff、get_patch、get_file_content、submit_review 必须显式传入完全相同的 repository。

禁止跨仓库读取提交、读取源码或写入 review.json。

## 4. ChatGPT 白槿审查器执行流程

真实 MCP 审查执行流程必须按以下顺序进行：

1. 调用 get_latest_handoff。
2. 验证返回 repository 与 invocation repository 一致。
3. 验证返回 branch 为 dev。
4. 读取完整 40 位 commit SHA。
5. 读取 commit message。
6. 读取 changed_files。
7. 如果最新提交只修改 review.json，停止，不调用 submit_review。
8. 如果存在代码提交，调用 get_patch。
9. 审查所有 changed_files，不得只审查第一个文件。
10. 如遇编码、JSON、Unicode、Base64、转义符、引号、文件末尾换行、LF、CRLF 或混合行尾问题，必须调用 get_file_content。
11. 根据代码证据形成 verdict。
12. 调用 submit_review 写回 review.json。
13. 使用 submit_review 返回的 review_commit 回读 review.json。
14. 执行 readback verify。
15. 产出 chatgpt-review-result.json。

## 5. get_file_content 强制条件

遇到以下问题时，必须调用 get_file_content：

- 转义符
- 引号
- Unicode
- Base64
- JSON
- 编码
- 文件末尾换行
- LF、CRLF 或混合行尾

调用 get_file_content 时必须显式传入：

- repository
- commit ref
- file path

必须根据原始源码、sha256、byte_length、line_ending、final_newline 判断相关问题。

未调用 get_file_content 时，不得把此类问题写入 finding。

## 6. verdict 规则

verdict 只能是：

- approved
- changes_requested
- blocked

没有阻塞问题时 verdict = approved。

存在需要修改的问题时 verdict = changes_requested。

无法可靠审查、仓库不一致、分支不一致、工具能力不足或存在严重阻塞时 verdict = blocked。

## 7. findings 规则

每个 finding 必须包含：

- severity
- file
- line
- title
- description
- recommendation

不得制造没有代码证据支持的问题。

## 8. submit_review 规则

调用 submit_review 时必须显式传入：

- repository
- commit
- verdict
- summary
- findings

commit 必须是本轮审查的完整 40 位代码提交 SHA。

summary 必须准确概括审查结果。

findings 必须来自真实代码证据。

## 9. readback verify 规则

submit_review 成功后，必须回读 review.json，并验证：

- repository 与本轮目标一致
- reviewed_commit 正确
- based_on_branch_head 正确
- verdict 正确
- findings 已实际写入
- 文件是合法 UTF-8
- sha256 已返回
- byte_length 已返回
- line_ending 已返回
- final_newline 已返回

readback verify 失败时，不得进入 approved 自动路径。

## 10. chatgpt-review-result 输出

真实审查完成后，必须输出 chatgpt-review-result.json。

该结果必须符合 schemas/chatgpt-review-result.schema.json。

chatgpt-review-result.json 必须包含：

- invocation_id
- repository
- branch
- status
- reviewed_commit
- based_on_branch_head
- review_commit
- verdict
- findings
- readback

## 11. L4 接入边界

ChatGPT review result 接入 L4 时，必须先经过 review guard。

如果 reviewed_commit、based_on_branch_head、current_branch_head 不一致，必须进入：

- STALE_REVIEW_DETECTED
- BRANCH_HEAD_CHANGED
- MANUAL_REQUIRED

不得绕过 review guard 直接进入 REVIEW_APPROVED。

## 12. 明确禁止

以下行为禁止：

- Codex 审查代码
- Codex 写 review.json
- Codex 调用 submit_review
- Codex 决定 approved
- Codex 绕过 ChatGPT 审查
- Codex 绕过 gate
- 当前 dry-run workflow 自动评论 PR
- 当前 dry-run workflow 申请 pull-requests: write
- 当前 dry-run workflow 使用 pull_request_target

## 13. 下一步

完成本文档后，下一步可以进入真实审查接入前的 MCP execution adapter 设计。

该 adapter 仍应先作为接口和测试存在，不应立即自动调用真实 MCP。
