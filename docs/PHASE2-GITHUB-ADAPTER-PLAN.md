# Phase 2：GitHub 适配层设计

> 状态：草案
> 依赖：Phase 1 稳定 SHA `c2621235c60c56997915452585b4073d52b54ad0`
> 原则：只设计，不实现。不修改生产仓库。不启用影子模式。

## 一、目标

将 Phase 1 的治理核心（Schema + Rego + Conftest）与 GitHub 平台连接，使：

- GitHub PR 事件 → 自动收集证据 → 生成 `gate-input.json`
- `reusable-final-gate.yml` 可被业务仓库安全调用
- 所有 GitHub API 调用通过 Octokit，消除手写 REST URL
- GitHub App 权限最小化，不持有写权限

## 二、Octokit 适配层

### 2.1 架构

```
GitHub Event (PR opened/synchronize)
       │
       ▼
┌──────────────────────┐
│  @octokit/webhooks   │  ← 替代手写 Webhook 解析
│  (verifyAndReceive)  │
└──────┬───────────────┘
       │ typed payload
       ▼
┌──────────────────────┐
│  Evidence Collector  │  ← Octokit REST client
│  (octokit.rest.*)    │
└──────┬───────────────┘
       │ raw evidence
       ▼
┌──────────────────────┐
│  buildGateInput()    │  ← Phase 1 已有
│  (evidence → JSON)   │
└──────┬───────────────┘
       │ gate-input.json
       ▼
┌──────────────────────┐
│  Conftest / OPA      │  ← Phase 1 已有
│  final-gate.rego     │
└──────┬───────────────┘
       │ allow / deny
       ▼
  GitHub Check Run
  (neutral for shadow, failure for production)
```

### 2.2 模块划分

```
src/
  github/
    client.mjs          # Octokit 实例工厂，统一鉴权
    collector.mjs       # 证据收集器，所有 REST 调用的唯一入口
    event-bridge.mjs    # Webhook 事件 → 内部事件类型转换
    check-run.mjs       # 创建/更新 GitHub Check Run（影子输出）
    errors.mjs          # 自定义错误类型（RetryableError, FatalError 等）
```

### 2.3 client.mjs 接口规划

```js
// 工厂函数，从环境变量/GitHub App 安装 token 创建
import { Octokit } from "octokit";

export function createOctokit({ auth, githubApiUrl }) {
  return new Octokit({
    auth,
    baseUrl: githubApiUrl ?? "https://api.github.com",
    throttle: { enabled: true },   // Octokit 内置限流
    retry: { enabled: false },     // 由 collector 显式重试
  });
}
```

### 2.4 collector.mjs 证据收集方法

每个方法对应 gate-input.json 中的一个或一组字段：

| 方法 | GitHub API | 收集证据 |
|------|-----------|---------|
| `getPullRequest` | `octokit.rest.pulls.get` | branch, base.sha |
| `listCommits` | `octokit.rest.pulls.listCommits` | candidate_commit |
| `isReachable` | `octokit.rest.repos.compareCommits` | candidate_reachable_from_submission_base |
| `getCommit` | `octokit.rest.repos.getCommit` | review_commit, review_commit_parent_sha, review_commit_changed_files |
| `getBranchHead` | `octokit.rest.repos.getBranch` | current_branch_head |
| `listCheckRuns` | `octokit.rest.checks.listForRef` | required_checks |
| `getContents` | `octokit.rest.repos.getContent` | readback (content, sha, byte_length) |

每个方法：
- 返回结构化对象，不返回原始 HTTP response
- 网络错误显式抛出 `RetryableError`
- 业务错误（404、403）显式抛出 `FatalError`

### 2.5 重试策略

```text
RetryableError：5xx、连接重置、超时
  → 3 次指数退避，1s / 2s / 4s
  → 3 次失败后 FatalError

FatalError：4xx（除 429）、证据不完整、数据格式异常
  → 不重试，直接标记 check run 为 failure
```

## 三、@octokit/webhooks 替代手写 Webhook

### 3.1 现状

Phase 1 不做 Webhook。Phase 2 引入事件驱动触发。

### 3.2 方案

```js
import { Webhooks } from "@octokit/webhooks";

const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET,
});

webhooks.on("pull_request.opened", async ({ payload }) => {
  await handlePullRequestEvent(payload);
});

webhooks.on("pull_request.synchronize", async ({ payload }) => {
  await handlePullRequestEvent(payload);
});

// event-bridge.mjs 内部
export function normalizePREvent(payload) {
  return {
    action: payload.action,
    repository: payload.repository.full_name,
    owner: payload.repository.owner.login,
    pullNumber: payload.pull_request.number,
    headSha: payload.pull_request.head.sha,
    baseSha: payload.pull_request.base.sha,
    baseRef: payload.pull_request.base.ref,
    headRef: payload.pull_request.head.ref,
    htmlUrl: payload.pull_request.html_url,
  };
}
```

### 3.3 优势

- 替代手写 `JSON.parse(event.payload)` + 字段验证
- `@octokit/webhooks` 自带签名验证（HMAC-SHA256），防伪造事件
- 类型定义自带字段校验，减少证据缺失风险
- 与 Octokit REST client 共享鉴权模型

## 四、GitHub App 最小权限

### 4.1 权限矩阵

| 权限 | 级别 | 用途 | 是否必需 |
|------|------|------|---------|
| `metadata` | read | 所有 App 默认拥有 | 强制 |
| `pull_requests` | read | 读取 PR 信息、commits 列表 | 必需 |
| `checks` | write | 创建影子 Check Run，输出 allow/deny | 必需 |
| `contents` | read | 读取 review.json 内容做回读完整性验证 | 必需 |
| `actions` | read | 读取 Workflow Run 和 Check Run 状态 | 必需 |

不需要的权限：

| 权限 | 原因 |
|------|------|
| `contents: write` | 治理核心不写代码 |
| `pull_requests: write` | 不修改 PR 状态（Check Run 用 checks 权限） |
| `administration` | 不修改仓库设置 |
| `deployments` | 无部署操作 |
| `secrets` | 不读密钥 |
| `statuses` | 使用 Check Run 替代 Commit Status |

### 4.2 App 安装范围

第一阶段仅安装到：

- `shunhang776/xinbaijin-governance`（自托管治理仓库）
- 影子模式稳定后扩展到 `shunhang776/xinbaijin`、`shunhang776/xinbaijin-mcp`

### 4.3 Webhook 订阅

只订阅触发治理评估的事件：

```
pull_request.opened
pull_request.synchronize
pull_request.reopened
```

不订阅 push、issue、discussion、deployment 等无关事件。

## 五、GitHub 证据到 gate-input.json 的转换

### 5.1 字段映射表

Phase 2 新增 `src/github/transform.mjs`：

```text
gate-input.json 字段               GitHub 证据来源
─────────────────────────────────  ──────────────────────────────
protocol                           const: "xinbaijin-gate-input/1.0"
repository_key                     event-bridge → repository → 查 REPOSITORY_MAP
repository_full_name               event-bridge → repository
branch                             event-bridge → baseRef
candidate_commit                   collector.listCommits → 最后一条 commit.sha
submission_base_head               event-bridge → baseSha
candidate_reachable_from_submission_base  collector.isReachable → status === "identical" || "ahead"
review_commit                      由编排器提交（MCP 写入 review.json 的 commit）
review_commit_parent_sha           collector.getCommit(review_commit) → parents[0].sha
review_commit_changed_files        collector.getCommit(review_commit) → files[*].filename
current_branch_head                collector.getBranchHead → commit.sha
required_check_names               [const 数组，来自仓库 Required Checks 配置]
required_checks                    collector.listCheckRuns(candidate_commit) → 过滤匹配 check_names 的 run
review                             由 ChatGPT MCP 生成，经 Ajv 验证后传入
readback                           collector.getContents → 原始 UTF-8 content + git blob SHA
                                   → verifyReadbackIntegrity() 计算 sha256 / byte_length / parsed_review
repair_round                       编排器维护的全局计数，初始 0，每次 AI 返工 +1
```

### 5.2 transform.mjs 接口

```js
import { REPOSITORY_MAP, buildGateInput } from "../build-gate-input.mjs";
import { verifyReadbackIntegrity } from "../readback-integrity.mjs";

export async function assembleEvidence({ collector, event, review, reviewCommit, repairRound }) {
  // 1. 从事件提取基础信息
  const repoFullName = event.repository;
  const repoKey = findRepoKey(repoFullName);  // 查 REPOSITORY_MAP 反查

  // 2. 并行收集证据（独立项可并发）
  const [candidateCommit, branchHead, allCheckRuns] = await Promise.all([
    collector.getLatestCommitSha(event),
    collector.getBranchHeadSha(event),
    collector.listCheckRunsForRef(event.headSha),
  ]);

  // 3. review-only 提交验证
  const reviewCommitInfo = await collector.getCommit(reviewCommit);
  const reachable = await collector.isReachable(event.baseSha, candidateCommit);

  // 4. readback 完整性验证（在 collector 外部做，不信任 GitHub 返回值）
  const rawContent = await collector.getReviewJsonContent(reviewCommit);
  const verifiedReadback = verifyReadbackIntegrity({
    readback: { content: rawContent.content, ... },
    expectedReview: review,
    expectedRepository: repoFullName,
    reviewCommit,
  });

  // 5. 组装
  return buildGateInput({
    repository_key: repoKey,
    branch: event.baseRef,
    candidate_commit: candidateCommit,
    submission_base_head: event.baseSha,
    candidate_reachable_from_submission_base: reachable,
    review_commit: reviewCommit,
    review_commit_parent_sha: reviewCommitInfo.parents[0],
    review_commit_changed_files: reviewCommitInfo.files,
    current_branch_head: branchHead,
    required_check_names: REQUIRED_CHECK_NAMES[repoKey],
    required_checks: filterMatchingChecks(allCheckRuns, candidateCommit),
    review,
    readback: verifiedReadback,
    repair_round: repairRound,
  });
}
```

## 六、review-only 提交判断收口

### 6.1 问题

编排器（MCP + ChatGPT）会在业务仓库 dev 分支上创建一个新 commit，内容只包含 `review.json`。这个 commit 必须被独立验证：它真的只修改了 review.json，没有夹带其他文件。

### 6.2 收口方案

不依赖 ChatGPT 的自述（"我只改了 review.json"），由证据收集器从 GitHub API 获取客观数据：

```js
export async function verifyReviewOnlyCommit(octokit, { owner, repo, sha }) {
  const { data: commit } = await octokit.rest.repos.getCommit({
    owner, repo, ref: sha,
  });

  const files = commit.files ?? [];

  // 规则 1：恰好修改 1 个文件
  if (files.length !== 1) {
    throw new FatalError(`Expected exactly 1 file in review commit, got ${files.length}`);
  }

  // 规则 2：该文件必须是 review.json
  if (files[0].filename !== "review.json") {
    throw new FatalError(`Expected review.json, got ${files[0].filename}`);
  }

  // 规则 3：状态必须是 added 或 modified，不能是 removed
  if (files[0].status === "removed") {
    throw new FatalError("review.json was removed, not added or modified");
  }

  // 规则 4（增强）：父提交该文件内容不等于当前内容
  // （防止"改了等于没改"的空提交绕过）
  // 由 readback integrity 间接验证

  return {
    sha,
    parentSha: commit.parents[0]?.sha,
    files: [files[0].filename],
  };
}
```

### 6.3 收口位置

此验证在 `assembleEvidence()` 内部调用，生成 `review_commit_changed_files` 字段时伴随校验。如果验证失败，`assembleEvidence()` 抛出 `FatalError`，check run 标记 `failure`。

## 七、逐步淘汰手写 GitHub REST URL

### 7.1 现状

Phase 1 中的 `scripts/install-policy-tools.sh` 使用 `curl` 拼接 GitHub Release 下载 URL：

```bash
"https://github.com/open-policy-agent/opa/releases/download/v${OPA_VERSION}/${opa_asset}"
```

### 7.2 淘汰路径

| 阶段 | 脚本 | 改动 |
|------|------|------|
| Phase 2 | `install-policy-tools.sh` | 不改为 Octokit（下载二进制是 CI 环境初始化，不是治理逻辑；curl 加 `--fail --location --retry 3` 已足够健壮） |
| Phase 2 | `validate-gate-input.mjs` | 不改为 Octokit（纯本地文件校验，无外部 API 调用） |
| Phase 2 | Java/C# 脚本（如有） | 不新增，全部治理逻辑用 Node.js/Octokit |
| Phase 3+ | 编排器内部 | Codex Adapter 输出 review.json 后，通过 Octokit 创建 review commit（不是 curl 拼接 API URL） |

### 7.3 结论

Phase 2 不淘汰 `install-policy-tools.sh` 中的 `curl`（它是 CI 初始化脚本，不是治理逻辑）。治理链路（收集证据、创建 check run、验证 readback）全部通过 Octokit，不存在手写 REST URL。

## 八、Shadow Final-Gate 接入边界

### 8.1 什么是 Shadow

Shadow = 治理结果可见（Check Run 显示 allow/deny），但不阻止合并。

### 8.2 边界定义

```
┌────────────────────────────────────────────────────────────┐
│ 业务仓库 PR (shunhang776/xinbaijin or xinbaijin-mcp)       │
│                                                            │
│ Developer pushes to dev                                    │
│       │                                                    │
│       ▼                                                    │
│ CI 流水线 (Build/Test/Lint/CodeQL/Semgrep/Gitleaks/OSV)   │
│       │ 全部通过                                           │
│       ▼                                                    │
│ 编排器生成 review.json + review commit                     │
│       │                                                    │
│       ▼                                                    │
│ ┌────────────────── 影子边界 ───────────────────┐          │
│ │                                                │          │
│ │ reusable-final-gate.yml                        │          │
│ │   ├─ 收集证据                                  │          │
│ │   ├─ 生成 gate-input.json                      │          │
│ │   ├─ Ajv 验证 schema                           │          │
│ │   ├─ Conftest 执行 final-gate.rego             │          │
│ │   └─ 输出 Check Run (neutral, NOT failure)     │          │
│ │                                                │          │
│ └────────────────────────────────────────────────┘          │
│       │                                                    │
│       ▼                                                    │
│ Check Run 显示在 PR 底部（信息性，不阻止合并）              │
│                                                            │
│ 影子模式下 Required Checks 不包含 final-gate               │
│ 人工审查者可参考 Check Run 结果决定是否批准                  │
└────────────────────────────────────────────────────────────┘
```

### 8.3 接入条件

影子模式启用条件：

1. GitHub CI（governance-ci）全绿
2. OPA 1.17.1 + Conftest 0.68.2 政策测试通过
3. 独立代码审查完成
4. 业务仓库调用 `reusable-final-gate.yml` 时固定治理仓库 40 位 SHA
5. Check Run 创建权限（checks: write）已授予
6. 人工批准

### 8.4 不接入的部分

- 不将 final-gate 加入 Required Checks（影子期间）
- 不阻止 PR 合并（影子期间）
- 不修改业务仓库 Rulesets
- 不替换现有 CI 步骤
- 不拦截 ChatGPT 生成的 review.json（只评估，不拒绝）

### 8.5 升级到生产门禁

影子模式稳定（≥ 2 周无意外 deny 误判）且人工确认后，升级路径：

1. 将 `reusable-final-gate.yml` 的 Check Run conclusion 从 `neutral` 改为 `failure`（被 deny 时）
2. 在业务仓库 Branch Protection 中将 final-gate check 加入 Required Checks
3. 人工批准后生效

## 九、暂不实施

以下内容明确排除在 Phase 2 之外：

| 项目 | 原因 |
|------|------|
| 实时 Webhook 服务器 | Phase 2 只在 GitHub Actions 中同步运行，不做常驻 Webhook 监听 |
| 编排器内部 Octokit 集成 | 编排器（XState / SQLite / Codex Adapter）在 Phase 3 落地，不在 Phase 2 范围 |
| Grafana / Prometheus / 监控 | 治理核心不做全栈可观测，Phase 1 ADR 明确排除 |
| 多仓库批量接入 | 先在 1-2 个仓库验证，再推广 |
| GitHub AI Code Review API | BUILD-STATUS.md 已标记 `DEFERRED` |
| 自动创建 review commit | 由编排器负责，不在此适配层 |
| 变更日志 / 通知 | 影子阶段的 Check Run 已提供可见性，无需额外通知系统 |
| 速率限制自适应 | Octokit 自带 throttle 处理常规情况，复杂自适应留待 Phase 3 |
| 第三方 GitHub App 发布 | App 私有不公开，不上架 Marketplace |

## 十、文件清单（Phase 2 新增）

```
src/
  github/
    client.mjs            # Octokit 工厂 + 鉴权
    collector.mjs         # 证据收集器（所有 REST API 调用）
    transform.mjs         # 证据 → gate-input.json 转换
    event-bridge.mjs      # Webhook → 内部事件标准化
    check-run.mjs         # Check Run 创建/更新
    errors.mjs            # RetryableError / FatalError
test/
  github/
    collector.test.js     # collector 单元测试（mock Octokit）
    transform.test.js     # transform 单元测试
    event-bridge.test.js  # 事件标准化测试
    check-run.test.js     # Check Run 测试
docs/
  PHASE2-GITHUB-ADAPTER-PLAN.md  # 本文档
```

## 十一、测试策略

### 单元测试

- `collector.mjs`：使用 `nock` 或 `vitest` mock Octokit，验证每个方法对成功/404/403/500/超时的处理
- `transform.mjs`：验证完整证据 → gate-input.json 转换，覆盖正常/缺失/异常三类输入
- `event-bridge.mjs`：验证 `pull_request.opened` / `synchronize` 两个事件类型
- `check-run.mjs`：验证 `neutral` vs `failure` conclusion 的正确性

### 集成测试

- 在 `governance-ci.yml` 中新增 `test:github` 脚本
- 使用 GitHub 个人访问 token 对 `shunhang776/xinbaijin-governance` 自身执行端到端验证

### 不测试的部分

- 不测试真实 GitHub App 安装过程（手动验证）
- 不测试编排器 → 适配层的桥接（Phase 3 范围）

## 十二、新增依赖

| 包 | 版本 | 用途 | 许可证 |
|---|------|------|-------|
| `octokit` | `^5.0.0` | GitHub REST API 客户端 | MIT |
| `@octokit/webhooks` | `^13.0.0` | Webhook 事件解析 + 签名验证 | MIT |
| `nock` | `^14.0.0` | HTTP mock（仅 devDependencies） | MIT |

依赖审计：
- 全部 MIT 许可证，无 GPL 污染
- Octokit 是 GitHub 官方维护的 SDK，不是第三方封装
- 不引入数据库、HTTP 框架、状态机

## 十三、与第一阶段关系

Phase 1（已完成）：
- Schema、Rego、Conftest、fixtures、CI → `c262123`

Phase 2（本文档）：
- 在 Phase 1 之上新增 GitHub 适配层
- 不修改 Phase 1 的任何文件（Schema、Rego、CI）
- `buildGateInput()` 和 `verifyReadbackIntegrity()` 保持为 Phase 1 的公共 API
- 适配层通过 `import` 调用 Phase 1 模块，不拷贝、不复刻

Phase 3（未来）：
- 编排器内部集成（XState / SQLite / Codex Adapter）
- ChatGPT + MCP 结合实时代码上下文
- 真实影子运行 ≥ 2 周
- 评估后决定是否升级为生产门禁
