# 白槿总路线 Phase0-Phase5

## 一、路线纠偏结论

白槿系统总路线只有 Phase0 到 Phase5。

Phase4-D、Phase4-E 只是 Phase4 内部子阶段，不是新的总阶段。

此前 repair-run / repair-submit 系列 PowerShell 脚本应归类为 Phase5 的 L4 闭环自愈实验 harness，不是新的 Phase6，也不是最终生产主控。

不得继续新增 Phase6、Phase7 作为总路线阶段。

## 二、总路线

| 阶段 | 名称 | 核心目标 |
|---|---|---|
| Phase0 | Codex / 执行器可行性验证 | 验证 Codex 能否作为白槿桥接器，稳定串联 GitHub、Claude、ChatGPT 审查器、MCP、review.json 和返工流程。 |
| Phase1 | 白槿治理底座 | 建立治理仓、业务仓、MCP 仓职责，冻结 review.json、handoff、gate-input 等基础协议。 |
| Phase2 | 影子门禁 Shadow Gate | 在不阻断合并的情况下模拟 allowed / denied 判断，验证策略逻辑。 |
| Phase3 | 真实 ChatGPT 审查闭环 | ChatGPT 通过 MCP 读取提交、patch、源码，真实审查并写回 review.json。 |
| Phase4 | 生产门禁 dry-run 与治理加固 | 生产级门禁干跑，覆盖 approved、changes_requested、blocked、stale review 等场景。 |
| Phase5 | 生产启用与 L4 闭环自愈 | 启用真实生产门禁，并形成自动审查 + 自动返工闭环。 |

## 三、L4 目标

白槿最终目标不是 L3 自动审查，而是 L4 自动审查 + 自动返工闭环。

L4 流程：

`	ext
Claude 写代码
→ GitHub 提交
→ Codex 桥接审查上下文
→ ChatGPT 白槿审查器审查
→ review.json
→ Ajv / OPA / Conftest / GitHub Rulesets 裁决
→ approved 则完成
→ changes_requested 则 Codex 桥接 findings 给 Claude
→ Claude 修复
→ 再提交
→ 再审查
→ 直到 approved / blocked / 达到返工上限
`",
",


### Claude

Claude 负责写代码和修复代码。

### Codex

Codex 是桥接器，负责串联 GitHub、本地仓库、Claude Code、ChatGPT 白槿审查器、MCP、review.json、CI、PR 和 gate。

Codex 不负责最终审查，不负责最终放行，不负责伪造 review.json，不直接绕过 gate。

### ChatGPT 白槿审查器

ChatGPT 白槿审查器负责权威代码审查，读取 patch 和必要源码，生成 approved / changes_requested / blocked，并写回 review.json。

### Ajv / OPA / Conftest / GitHub Rulesets

这些组件负责最终门禁裁决。Claude、Codex、普通脚本都不能绕过它们。

## 五、PowerShell repair 脚本归档

repair-validate.ps1、repair-prompt.ps1、repair-run.ps1、repair-submit.ps1、repair-watch.ps1 保留为 Phase5 L4 闭环自愈实验 harness。

它们证明了：

- review.json 可以驱动返工判断
- changes_requested 可以触发返工
- approved 不触发返工
- stale review 能阻止重复返工
- worktree 可以隔离修复
- 修复 PR 可以自动创建
- 合并后可以恢复 approved 状态

但它们不是最终生产编排器。正式编排应基于 Codex Bridge Adapter、XState、SQLite、Octokit、Ajv、OPA / Conftest。

## 六、后续原则

复杂、通用、易出错且自研收益不成正比的能力，优先采用成熟开源或 GitHub 托管能力。

白槿只自研不可替代的业务规则和适配器。
