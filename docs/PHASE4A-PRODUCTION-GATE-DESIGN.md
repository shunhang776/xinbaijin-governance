# Phase 4-A：生产门禁设计

> 状态：设计文档
> 依赖：Phase 1-3 已验证通过
> 治理仓库稳定 SHA：`d640c388e7fcdf96b6e750d14994950fc7be50dc`

## 一、当前状态

Phase 1-3 已完成以下验证：

- 治理核心（Schema + Rego + Conftest + Ajv）稳定；
- `xinbaijin-mcp` 与 `xinbaijin` 均已接入 shadow final-gate；
- 真实 ChatGPT `review.json` → real-review-shadow → governance 评估闭环通过；
- 预期 deny / 预期 allow 场景均已正确识别。

当前仍是 **shadow-only**：

- 不阻塞 PR 合并；
- 不加入 Required Checks；
- 不修改 branch protection；
- 不自动写业务仓库源码；
- 只观察 governance 的判断结果（Check Run 信息性展示）。

---

## 二、生产 final-gate 的目标

生产 final-gate 启用后，必须保证：

1. 没有可信 `approved` review → 不允许合入 `dev`；
2. `changes_requested` → 不允许合入；
3. `blocked` → 不允许合入；
4. stale review → 不允许合入；
5. `review.json` 回读校验不完整 → 不允许合入；
6. Required Checks 未通过 → 不允许合入；
7. 分支头发生并发变化 → 不允许合入；
8. 非 fast-forward 风险 → 不允许合入。

---

## 三、allowed 条件

以下条件**全部**满足时，门禁输出 allowed：

| # | 条件 | 来源 | 校验方式 |
|---|------|------|---------|
| 1 | `review.verdict === "approved"` | review.json | OPA Rego 字段比较 |
| 2 | `review.repository` 与目标仓库一致 | review.json ↔ gate-input.json | OPA Rego 字段比较 |
| 3 | `review.branch === "dev"` | review.json | OPA Rego const 比较 |
| 4 | `review.reviewed_commit === candidate_commit` | review.json ↔ gate-input.json | OPA Rego 字段比较 |
| 5 | `review.based_on_branch_head === submission_base_head` | review.json ↔ gate-input.json | OPA Rego 字段比较 |
| 6 | `readback.parsed_review` 深度等于 `review` | readback ↔ gate-input.json | OPA Rego 深度相等 |
| 7 | `readback.sha256` 非空且匹配内容 | readback | verifyReadbackIntegrity.js |
| 8 | `readback.byte_length` 一致 | readback | verifyReadbackIntegrity.js |
| 9 | `readback.line_ending === "lf"` | readback | OPA Rego const 比较 |
| 10 | `readback.has_trailing_newline === true` | readback | OPA Rego const 比较 |
| 11 | `readback.encoding === "utf-8"` | readback | OPA Rego const 比较 |
| 12 | `readback.integrity_verified === true` | readback | verifyReadbackIntegrity.js 派生 |
| 13 | `review_commit_changed_files === ["review.json"]` | gate-input.json | OPA Rego 严格数组比较 |
| 14 | `candidate_reachable_from_submission_base === true` | gate-input.json | Git merge-base 验证 |
| 15 | 所有 Required Checks 通过（status=completed，conclusion=success） | gate-input.json | OPA Rego 逐个校验 |
| 16 | `current_branch_head === review_commit` | gate-input.json | OPA Rego 字段比较 |
| 17 | `repository_key` 在允许列表内 | gate-input.json | REPOSITORY_MAP + OPA Rego |
| 18 | governance ref 固定 40 位 SHA | workflow input | workflow 第一步校验 |

---

## 四、denied 条件

以下任一条件触发，门禁输出 denied：

| # | 条件 |
|---|------|
| 1 | `review.verdict === "changes_requested"` |
| 2 | `review.verdict === "blocked"` |
| 3 | `review.findings` 包含 `severity: "critical"` / `"high"` / `"medium"` |
| 4 | Required Check 缺失（`required_check_names` 中任一名称在 `required_checks` 中不出现或出现多次） |
| 5 | Required Check 非 `status: "completed"` |
| 6 | Required Check `conclusion !== "success"` |
| 7 | `reviewed_commit !== candidate_commit` |
| 8 | `based_on_branch_head !== submission_base_head` |
| 9 | `review.branch !== "dev"` |
| 10 | `review_commit_changed_files !== ["review.json"]` |
| 11 | `readback.repository !== repository_full_name` |
| 12 | `readback.ref !== review_commit` |
| 13 | `readback.path !== "review.json"` |
| 14 | `readback.parsed_review !== review`（深度比较） |
| 15 | `readback.encoding !== "utf-8"` |
| 16 | `readback.line_ending !== "lf"` |
| 17 | `readback.has_trailing_newline !== true` |
| 18 | `readback.integrity_verified !== true` |
| 19 | `current_branch_head !== review_commit`（分支头已变化） |
| 20 | `candidate_reachable_from_submission_base !== true` |
| 21 | `repair_round` 超出 0-2 范围 |

---

## 五、blocked 条件

blocked 与 denied 的区别：

- **denied** = 审查完成，但结论是不允许合入；
- **blocked** = 无法完成可靠审查，门禁本身无法给出结论。

blocked 用于以下场景：

| # | 场景 |
|---|------|
| 1 | 无法确认 review.json 原始内容（readback 缺失或损坏） |
| 2 | 无法确认当前分支头（git 操作失败） |
| 3 | governance 输入不完整（gate-input.json 缺失必填字段） |
| 4 | Schema 校验失败（gate-input.json 结构不合规） |
| 5 | 仓库 key 不在 REPOSITORY_MAP 中 |
| 6 | 仓库 full_name 与 key 映射不匹配 |
| 7 | GitHub App token 生成失败（权限不足） |
| 8 | 治理仓库 checkout 失败（SHA 不存在或网络错误） |
| 9 | OPA/Conftest 工具缺失或执行异常 |
| 10 | 发现跨仓库读写风险（review 声称审查 repo A，但提交在 repo B） |
| 11 | required_check_names 为空 |
| 12 | required_checks 为空且无可用的 fallback |

blocked 在 workflow 层面表现为 **job failure**（非 0 退出码），与 denied（预期结果比较）区分。

---

## 六、stale review 保护

review 的有效性取决于以下一致性链条：

```
reviewed_commit === candidate_commit
based_on_branch_head === submission_base_head
review_commit_parent_sha === submission_base_head
current_branch_head === review_commit
```

如果 dev 分支头在审查提交之后、门禁判定之前发生了变化：

- `current_branch_head !== review_commit` → denied（分支已推进，review 过期）；
- 需要重新生成 review.json 并重新提交 review commit。

生产门禁**不会**自动 rebase 或合并审查结果。

---

## 七、并发与 fast-forward 保护

不允许以下场景：

1. **基于过期 dev head 的 review 直接放行** — 因为 `current_branch_head !== review_commit` 会被 deny；
2. **非预期 merge base** — 因为 `based_on_branch_head` 与 `submission_base_head` 不一致会被 deny；
3. **review_commit 建立在错误父提交上** — 因为 `review_commit_parent_sha !== submission_base_head` 会被 deny；
4. **多个 review.json 覆盖造成误放行** — 每次 push review.json 都会触发独立的 real-review-shadow，取最新一次的结果。

并发场景：

- 如果开发者 A 和 B 同时提交 review.json，两个 workflow run 各自评估；
- 先完成的 run 可能因为 `current_branch_head` 已变化而被 deny（因为对方先合入了）；
- 后完成的 run 使用最新的分支头评估。

---

## 八、Required Checks 策略

初期策略（Phase 4-B 起）：

- 只读取 check-runs（不修改 branch protection）；
- 只接受 `status: "completed"` 且 `conclusion: "success"`；
- check 名称必须来自明确的 `REQUIRED_CHECK_NAMES` allowlist（按仓库配置）；
- 不使用 wildcard 匹配；
- 不信任任意第三方 check 名称；
- 避免 self-approval check（即 governance 自身的 check run 不能作为 Required Check）；
- 不在 Phase 4-A 阶段修改 GitHub branch protection。

`REQUIRED_CHECK_NAMES` 示例：

```json
{
  "xinbaijin": ["baijin/build-test", "baijin/lint", "baijin/security"],
  "xinbaijin-mcp": ["baijin/build-test", "baijin/lint"]
}
```

---

## 九、Dry-run 计划

分阶段灰度启用：

| 阶段 | 内容 | 是否阻塞合并 |
|------|------|-------------|
| Phase 4-A | 本设计文档 | 否 |
| Phase 4-B | 新增 `reusable-production-gate-dry-run.yml`，内部逻辑与生产最终一致，但 Check Run 输出 neutral | 否 |
| Phase 4-C | 在 PR 上同时运行 shadow gate 与 production-gate dry-run，对比两者输出 | 否 |
| Phase 4-D | 连续 10+ 轮真实审查（含 approved 和 changes_requested）稳定后评估 | 否 |
| Phase 4-E | 小范围启用生产门禁（单仓库，人工监控） | 是（单仓库） |
| Phase 4-F | 回滚演练 | — |

Phase 4-E 启用条件：

- Dry-run ≥ 2 周无意外 deny 误判；
- 至少 5 轮真实 `approved` review 正确放行；
- 至少 5 轮真实 `changes_requested` review 正确拒绝；
- 0 次 blocked（工具故障）；
- 人工确认。

---

## 十、回滚策略

如生产门禁出现误判或工具故障：

1. **移除 Required Check**：在仓库 Settings → Branch Protection 中取消勾选；
2. **禁用 workflow**：将 `reusable-production-gate.yml` 的 trigger 注释掉或删除调用；
3. **回滚 workflow commit**：`git revert <commit>` 并推送；
4. **保留 shadow workflow**：shadow gate 始终独立运行，不受生产门禁影响；
5. **Reader App 不给写权限**：即使生产门禁启用，Reader App 依然只有 `contents: read`，无法写代码；
6. **生产 gate 故障时不得阻断 emergency manual recovery**：Repository admin 始终可以 bypass branch protection。

---

## 十一、明确禁止事项

Phase 4-A 阶段：

- 不启用生产门禁；
- 不修改 branch protection；
- 不修改 Required Checks；
- 不给 GitHub App 写权限；
- 不自动 merge；
- 不自动写源码；
- 不使用浮动治理引用（`@main`、`@latest`）；
- 不删除 shadow gate；
- 不修改 `reusable-final-gate.yml` 的强制门禁语义（shadow 与生产分离）。
