# Phase 4-D：反向验证计划

> 状态：设计文档
> 依赖：Phase 4-A 设计、Phase 4-B dry-run workflow、Phase 4-C 对比接入
> 治理仓库稳定 SHA：`bf7199f7a6a048744b4b53ce6b287a642915d9f5`

## 一、当前状态

- `xinbaijin-mcp` 已通过 real-review-shadow + production-gate dry-run 正例（approved → allowed）；
- `xinbaijin` 已通过 real-review-shadow + production-gate dry-run 正例（approved → allowed）；
- Required Checks 未修改；
- 生产门禁未启用；
- GitHub App 只有只读权限。

## 二、Phase 4-D 目标

验证 `reusable-final-gate-dry-run.yml` 在异常场景下能正确输出 `denied` 或 `tool_error`，而不是误判为 `allowed`。

正向验证（Phase 4-B/4-C）证明 "该过的能过"。反向验证必须证明 "不该过的绝不放过"。

## 三、反向用例矩阵

每个用例包含：输入构造方式、预期 gate_result、预期 workflow 结果。

### 3.1 denied 用例

| # | 场景 | 输入构造 | gate_result | workflow |
|---|------|---------|-------------|----------|
| D1 | changes_requested | review.verdict 设为 changes_requested | denied | success |
| D2 | blocked | review.verdict 设为 blocked | denied | success |
| D3 | reviewed_commit 不匹配 | review.reviewed_commit 改为另一个 40 位 SHA | denied | success |
| D4 | based_on_branch_head 不匹配 | review.based_on_branch_head 改为另一个 40 位 SHA | denied | success |
| D5 | review.repository 不匹配 | review.repository 改为 "shunhang776/other" | denied | success |
| D6 | review.branch 不匹配 | review.branch 改为 "main" | denied | success |
| D7 | review_commit 修改了非 review.json | review_commit_changed_files 包含额外文件 | denied | success |
| D8 | readback 不完整（sha256 错） | readback.sha256 改为错误的哈希值 | denied 或 tool_error | success 或 failure |
| D9 | readback.byte_length 不匹配 | readback.byte_length 改为错误值 | denied 或 tool_error | success 或 failure |
| D10 | readback.line_ending 不匹配 | readback.line_ending 改为 "crlf" | denied | success |
| D11 | readback.has_trailing_newline=false | readback 去掉 trailing newline | denied | success |
| D12 | Required Check 未通过 | required_checks 中某 check conclusion="failure" | denied | success |
| D13 | Required Check 缺失 | required_check_names 中包含不存在于 required_checks 的名称 | denied | success |
| D14 | candidate 不可达 | candidate_reachable_from_submission_base=false | denied（schema 拒绝） | 取决于 validator |
| D15 | branch head 并发变化 | current_branch_head ≠ review_commit | denied | success |
| D16 | repair_round 越界 | repair_round 设为 3 | denied（schema 拒绝） | 取决于 validator |

### 3.2 tool_error 用例

| # | 场景 | 输入构造 | gate_result | workflow |
|---|------|---------|-------------|----------|
| T1 | malformed review.json | review.json 不是合法 JSON | tool_error | failure |
| T2 | 无效 UTF-8 | review.json content 包含非 UTF-8 字节 | tool_error | failure |
| T3 | gate-input 缺少必填字段 | gate-input.json 缺少 protocol 字段 | tool_error（schema 拒绝） | failure |
| T4 | repository_key 不在映射中 | repository_key 设为 "unknown" | tool_error | failure |
| T5 | governance_ref 不是 40 位 SHA | 传入短 SHA | tool_error | failure |
| T6 | artifact 缺失 | gate_input_artifact_name 指向不存在的 artifact | tool_error | failure |

## 四、dry-run 结果语义

| gate_result | workflow 结果 | 含义 |
|-------------|--------------|------|
| allowed | success | 所有策略通过，生产门禁启用后会放行 |
| denied | success | 策略拒绝，生产门禁启用后会阻止 |
| tool_error | failure | 无法完成评估，需人工介入 |

关键：denied 是**预期结果**，不是 workflow 故障。dry-run 的 `denied` → success 设计与 shadow gate 的 `expected_policy_result=denied` → success 一致。

## 五、执行顺序

### 第一阶段：xinbaijin-mcp 最小负例（3 个）

1. **D1**：构造 changes_requested review.json → push → 确认 dry-run 输出 denied
2. **D2**：构造 blocked review.json → push → 确认 dry-run 输出 denied
3. **D3**：构造 stale reviewed_commit review.json → push → 确认 dry-run 输出 denied

每个负例执行后：

- 检查 dry-run artifact `production-gate-dry-run-result.json`
- 确认 `gate_result=denied`
- 确认 `enforcement=NO`
- 确认 workflow run success

### 第二阶段：扩展到 xinbaijin

将第一阶段验证的用例复制到 `xinbaijin` 仓库执行。

### 第三阶段：完整矩阵

逐步覆盖 D4-D16 和 T1-T6。

## 六、禁止事项

- 不启用 Required Checks
- 不修改 branch protection
- 不启用生产门禁
- 不给 GitHub App 写权限
- 不使用浮动 governance 引用（`@main`、`@latest`）
- 不修改业务逻辑
- 不自动 merge
- 不删除或弱化 shadow gate

## 七、Phase 4-D 完成标准

- [ ] `xinbaijin-mcp`：approved → allowed 正例通过
- [ ] `xinbaijin-mcp`：至少 3 个 denied 负例通过
- [ ] `xinbaijin`：approved → allowed 正例通过
- [ ] `xinbaijin`：至少 3 个 denied 负例通过
- [ ] tool_error 场景有独立验证计划（T1-T6）
- [ ] 所有结果可从 GitHub Actions run 和 dry-run artifact 中复核
- [ ] 0 次误判 allowed

## 八、后续阶段

Phase 4-E：小范围启用生产门禁（单仓库，人工监控）
Phase 4-F：回滚演练
