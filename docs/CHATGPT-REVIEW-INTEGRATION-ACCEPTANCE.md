# ChatGPT Review Integration Acceptance

## 1. 定位

本文档记录第 8 步真实 ChatGPT 审查接入阶段的工程化收口状态。

当前阶段已经完成 ChatGPT 审查接入前的 invocation、review result、fake MCP executor、L4 event adapter 和 dry-run artifact 链路。

当前阶段尚未接入真实 MCP，尚未真实调用 submit_review，尚未真实写入 review.json。

## 2. 已完成能力

第 8 步当前已完成以下能力：

1. ChatGPT review invocation schema。
2. ChatGPT review invocation fixtures 和 schema test。
3. ChatGPT review invocation builder。
4. Codex Bridge CLI 输出 chatgpt-review-invocation.json。
5. chatgpt-review-invocation.json 纳入 dry-run artifact。
6. ChatGPT review result schema。
7. ChatGPT review result builder / normalizer。
8. ChatGPT review result 到 L4 review guard / L4 events 的适配层。
9. fake MCP review executor。
10. dry-run 使用 fake MCP executor 生成 chatgpt-review-result.json。
11. dry-run artifact 记录 codex-bridge-result.json、chatgpt-review-invocation.json、chatgpt-review-result.json。
12. L4 pipeline 可以消费模拟 ChatGPT review result 并进入 REVIEW_APPROVED / REVIEW_DENIED / REVIEW_BLOCKED 或 guard 保护路径。

## 3. 当前产物链路

当前 dry-run 链路为：

codex review_bridge request
-> codex-bridge-result.json
-> chatgpt-review-invocation.json
-> fake MCP review executor
-> chatgpt-review-result.json
-> review guard
-> L4 events
-> L4 pipeline
-> l4-run-result.json
-> l4-dry-run-artifact.json

## 4. 当前 artifact 文件

dry-run artifact 当前应包含：

- artifacts/l4/l4-pipeline-input.json
- artifacts/l4/l4-pipeline-output.json
- artifacts/l4/l4-run-result.json
- artifacts/l4/l4-dry-run-artifact.json
- artifacts/l4/l4-pr-comment.md
- artifacts/l4/codex-bridge-result.json
- artifacts/l4/chatgpt-review-invocation.json
- artifacts/l4/chatgpt-review-result.json

## 5. 当前仍然禁止的行为

当前阶段仍然禁止：

- 自动调用真实 MCP。
- 自动调用 get_latest_handoff。
- 自动调用 get_patch。
- 自动调用 get_file_content。
- 自动调用 submit_review。
- 自动写 review.json。
- 自动评论 PR。
- 自动决定 approved。
- Codex 审查代码。
- Codex 写 review.json。
- Codex 绕过 ChatGPT 白槿审查器。
- Codex 绕过 gate。

## 6. ChatGPT 审查边界

真实审查者只能是 ChatGPT 白槿审查器。

Codex Bridge Adapter 只能生成 invocation、搬运上下文、保存 artifact 和驱动状态机。

Codex Bridge Adapter 不得成为审查者，不得生成真实 verdict，不得写 review.json，不得调用 submit_review。

## 7. review result 边界

chatgpt-review-result.json 必须符合 schemas/chatgpt-review-result.schema.json。

review result 必须包含 invocation_id、repository、branch、status、reviewed_commit、based_on_branch_head、review_commit、verdict、findings、readback。

当 status = review_submitted 时，readback 必须 fully verified。

## 8. L4 接入边界

ChatGPT review result 接入 L4 前必须经过 review guard。

当 reviewed_commit、based_on_branch_head、current_branch_head 不一致时，必须进入：

- STALE_REVIEW_DETECTED
- BRANCH_HEAD_CHANGED
- MANUAL_REQUIRED

不得绕过 review guard 直接进入 REVIEW_APPROVED。

## 9. fake MCP executor 状态

fake MCP review executor 已经覆盖：

- get_latest_handoff mock。
- get_patch mock。
- submit_review mock。
- get_file_content mock。
- only review.json changed 时跳过 submit_review。
- handoff repository mismatch。
- handoff branch mismatch。
- handoff commit mismatch。
- approved result。
- changes_requested result。

fake MCP executor 仅用于 dry-run 和测试，不代表真实 MCP 审查已经启用。

## 10. 第 8 步验收结论

当前第 8 步已经完成真实 ChatGPT 审查接入前的工程化准备：

- invocation 契约已固化。
- result 契约已固化。
- dry-run 已能产出 invocation 和 result。
- fake MCP executor 已能跑通完整模拟审查流程。
- review result 已可映射进 L4 pipeline。
- Codex 禁止边界仍然保持清晰。

因此，第 8 步可以进入下一阶段：真实 MCP review execution adapter 接入准备。

但在进入真实 MCP 前，仍必须保持：

- 不自动执行真实审查。
- 不自动 submit_review。
- 不自动写 review.json。

## 11. 下一步

下一步进入第 9 步前置：Claude 返工 handoff 接入。

或者继续细化第 8 步的真实 MCP adapter，实现受控的人工触发执行入口。

推荐顺序是先设计 Claude 返工 handoff 契约，再进行真实 MCP 试运行。
