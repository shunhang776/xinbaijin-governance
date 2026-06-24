# xinbaijin-governance 第一阶段候选包

这是白槿治理核心的独立候选仓库。它不运行长期服务，不保存业务代码，只保存唯一数据契约、最终政策、测试夹具和可复用工作流。

## 当前定位

- `review.schema.json`：`review.json` 的唯一跨组件契约。
- `gate-input.schema.json`：最终门禁全部证据的唯一契约。
- Ajv：结构、类型、格式和额外字段验证。
- OPA/Rego + Conftest：跨字段关系和最终放行政策。
- fast-check：不变量属性测试。
- Stryker：验证 JavaScript 胶水测试是否真的能发现逻辑变异。

旧版 `trusted-core.js` 不进入生产门禁，只能作为历史需求和反例参考。

## 安全语义

只有同时满足以下条件才允许通过：

1. 仓库 key 与完整仓库名严格匹配；
2. 分支为 `dev`；
3. 候选代码提交可从提交审查时的分支头到达；
4. `review_commit` 的唯一父提交等于提交审查时捕获的分支头；
5. `review_commit` 只修改 `review.json`；
6. 当前分支头仍等于 `review_commit`；
7. 所有 Required Checks 在候选代码提交上恰好出现一次并成功；
8. `reviewed_commit`、`based_on_branch_head`、仓库和分支全部一致；
9. verdict 为 `approved`，且不存在 critical/high/medium finding；
10. 回读内容已独立验证 UTF-8、LF、末尾换行、SHA-256、字节长度和 JSON 内容一致性；
11. 修复轮次不超过两轮。

任一证据缺失或不一致都拒绝。

## 本地运行

```bash
npm ci
npm run tools:install
npm run test:all
npm run mutation
```

`tools:install` 会下载 `versions.json` 固定的 OPA 与 Conftest 版本，并使用发布方提供的 SHA-256 清单校验二进制。该脚本面向 Linux/WSL 和 GitHub Hosted Runner。

## 合入顺序

1. 创建空仓库 `shunhang776/xinbaijin-governance`；
2. 将本目录作为初始提交；
3. 在仓库设置中保护 `main`；
4. 运行 `governance-ci`；
5. 完成独立代码审查；
6. 再以影子模式接入 `xinbaijin` 和 `xinbaijin-mcp`；
7. 在影子模式稳定前，不加入 Required Checks，不替换现有 Worker。

## 冻结约束

- 新增仓库必须修改 Schema、Rego、夹具和测试，并人工复核；
- 第三方 GitHub Action 使用完整 Commit SHA；
- 不允许在业务仓库复制 Schema 或 Rego；
- 文档字段表应由 Schema 生成，不再人工维护第二套契约；
- `GitHub AI review` 当前状态为 `DEFERRED`，不属于门禁证据。

## 跨仓库调用

业务仓库调用 `reusable-final-gate.yml` 时，必须同时：

- 在 `uses:` 中固定治理仓库完整 40 位 SHA；
- 将相同 SHA 作为 `governance_ref` 输入；
- 将生成的 `gate-input.json` 路径作为 `gate_input_path` 输入。

工作流会分别检出调用方仓库和固定版本的治理仓库，避免使用浮动分支。
