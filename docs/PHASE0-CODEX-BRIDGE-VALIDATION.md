# Phase0 Codex 桥接器验证计划

## 一、定位

Codex 在白槿系统中的定位是桥接器。
Codex 不是最终审查器，不是最终门禁，也不是白槿治理系统本体。

Codex 负责连接 GitHub、本地仓库、Claude Code、ChatGPT 白槿审查器、MCP、review.json、CI、PR 和 gate。

## 二、Phase0 目标

Phase0 要验证的不是 Codex 能不能单纯写代码，而是 Codex 能不能稳定桥接 L4 自动返工闭环。

核心链路：

GitHub 最新提交 -> ChatGPT 白槿审查 -> review.json -> findings -> Claude 返工 -> 再提交 -> 再审查

## 三、Codex 必须验证的能力

1. 读取当前仓库状态。
2. 识别仓库名、分支、最新 commit。
3. 识别 GitHub PR、checks、workflow 状态。
4. 判断当前状态是等待审查、等待返工，还是已经完成。
5. 把待审查 commit 桥接给 ChatGPT 白槿审查器。
6. 等待或读取 review.json。
7. 识别 verdict：approved、changes_requested、blocked。
8. 把 changes_requested 的 findings 桥接给 Claude Code。
9. 在 Claude 修复后识别新的 candidate commit。
10. 再次触发审查流程。
11. approved 后停止。
12. blocked 后停止并转人工。
13. 超过 repair_round 上限后停止。
14. 分支头变化或 stale review 时停止。

## 四、Codex 禁止事项

1. 不允许自己判定 approved。
2. 不允许绕过 ChatGPT 白槿审查器。
3. 不允许绕过 Ajv、OPA、Conftest、GitHub Rulesets。
4. 不允许直接推送 dev。
5. 不允许伪造或手写 review.json。
6. 不允许修改 review.json 来制造通过状态。
7. 不允许修改治理规则来让自己通过。
8. 不允许在 blocked 状态下继续自动推进。

## 五、最小实验

实验 1：仓库状态识别。
验证 Codex 能识别 repository、branch、candidate_commit、current_branch_head、required_checks、workflow_status。

实验 2：审查桥接。
验证 Codex 能把最新 candidate commit 桥接到 ChatGPT 白槿审查器，并最终生成 review.json。

实验 3：返工桥接。
验证 Codex 能读取 changes_requested findings，并桥接给 Claude Code 修复。

实验 4：L4 闭环烟测。
验证 Claude 提交代码 -> Codex 桥接审查 -> ChatGPT 写 changes_requested -> gate denied -> Codex 桥接返工 -> Claude 修复 -> 再审查 -> approved -> gate allowed。

## 六、通过标准

Codex 能稳定桥接提交、审查、review.json、返工、再审查。
Codex 不越权、不伪造、不绕过门禁。
Codex 能把 L3 自动审查推进到 L4 自动返工闭环。

## 七、与 PowerShell repair 实验的关系

repair-validate、repair-prompt、repair-run、repair-submit、repair-watch 系列脚本属于 Phase5 L4 闭环自愈实验 harness。

它们不是 Codex Bridge Adapter 的最终实现，但可以作为风险清单和原型参考。

正式实现应优先采用 Codex Bridge Adapter、XState、SQLite、Octokit、Ajv、OPA / Conftest、GitHub Actions / Rulesets。

## 八、最终原则

Codex 是桥接器。
Claude 负责写代码和修复代码。
ChatGPT 白槿审查器负责权威审查。
Ajv、OPA、Conftest、GitHub Rulesets 负责最终门禁。
白槿目标是 L4 自动审查 + 自动返工闭环。
