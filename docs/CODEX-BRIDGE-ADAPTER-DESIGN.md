# Codex Bridge Adapter 设计

## 一、定位

Codex Bridge Adapter 是白槿 L4 自动返工闭环中的桥接适配器。

它负责连接 GitHub、本地仓库、Claude Code、ChatGPT 白槿审查器、MCP、review.json、CI、PR 和 gate。

Codex Bridge Adapter 不是审查器，不是门禁，不是最终裁决者。

## 二、核心职责

Codex Bridge Adapter 负责：

1. 读取当前仓库状态。
2. 识别 repository、branch、candidate_commit、current_branch_head。
3. 读取 GitHub PR、checks、workflow 状态。
4. 判断当前流程状态。
5. 准备 ChatGPT 白槿审查所需上下文。
6. 桥接固定审查触发语。
7. 等待或读取 review.json。
8. 识别 verdict：approved、changes_requested、blocked。
9. 将 findings 桥接给 Claude Code。
10. 等待 Claude 提交修复 commit。
11. 触发下一轮审查。
12. 在 approved、blocked、stale review、repair_round 超限时停止。

## 三、禁止职责

Codex Bridge Adapter 禁止：

1. 自己判定 approved。
2. 伪造 review.json。
3. 修改 review.json 来制造通过状态。
4. 绕过 ChatGPT 白槿审查器。
5. 绕过 Ajv、OPA、Conftest、GitHub Rulesets。
6. 直接推送 dev。
7. 修改治理规则来让流程通过。
8. blocked 后继续自动推进。

## 四、输入

Codex Bridge Adapter 的输入包括：

1. repository。
2. branch。
3. candidate_commit。
4. GitHub checks 状态。
5. review.json。
6. gate_result。
7. repair_round。
8. 当前分支头 current_branch_head。
9. Claude Code 返工结果。

## 五、输出

Codex Bridge Adapter 的输出包括：

1. 审查触发请求。
2. 审查上下文。
3. 返工上下文。
4. findings 交接内容。
5. 状态机事件。
6. 人工介入请求。
7. 流程完成记录。

## 六、与 Claude 的关系

Claude 负责写代码和修复代码。

Codex Bridge Adapter 负责把 review.json 中的 findings 转换成 Claude 可以执行的返工上下文。

Claude 不允许修改 review.json。

## 七、与 ChatGPT 白槿审查器的关系

ChatGPT 白槿审查器负责权威审查。

Codex Bridge Adapter 只负责把需要审查的 commit、仓库状态和触发信息桥接给 ChatGPT 白槿审查器。

ChatGPT 通过 MCP 读取 patch、源码，并写回 review.json。

## 八、与 Gate 的关系

Gate 负责最终裁决。

Codex Bridge Adapter 只能读取 gate_result，不能绕过 gate。

approved 必须经过 Ajv、OPA、Conftest、GitHub Rulesets 验证后才算完成。

## 九、状态机集成

Codex Bridge Adapter 不直接用散乱 if 判断驱动全流程。

正式实现应接入 L4 状态机。

建议由 XState 管理状态转移，由 SQLite 保存状态快照和事件日志。

## 十、错误处理

出现以下情况必须停止并转人工：

1. blocked。
2. stale review。
3. 分支头变化。
4. required checks 未完成或失败。
5. repair_round 超过上限。
6. 同一 finding 重复出现。
7. review.json 无法验证。
8. ChatGPT 审查器或 MCP 工具异常。

## 十一、正式实现原则

Codex Bridge Adapter 应保持薄适配层。

复杂通用能力必须交给成熟组件：

1. GitHub API 使用 Octokit。
2. Schema 校验使用 Ajv。
3. 政策判断使用 OPA / Conftest。
4. 状态机使用 XState。
5. 状态存储使用 SQLite。

## 十二、最终结论

Codex Bridge Adapter 的核心价值是把 L3 自动审查推进为 L4 自动返工闭环。

Codex 是桥接器。
Claude 是代码执行与修复方。
ChatGPT 是权威审查方。
Gate 是最终裁决方。
