# 测试结果

构建日期：2026-06-24

## 已执行

- JSON Schema 夹具验证：通过
- Vitest：4 个测试文件、60 项测试全部通过
- fast-check：包含未知仓库、哈希篡改、内容篡改等属性测试，全部通过
- Stryker：82 个非字符串变异全部被杀死，Mutation Score 100%
- npm audit（moderate 及以上）：0 个已知漏洞
- GitHub Actions YAML 语法解析：通过

## 尚未在当前容器执行

OPA/Rego 与 Conftest 测试未在当前容器执行。当前容器无法解析 GitHub Release 下载域名，因此无法取得固定版本的 OPA 和 Conftest 二进制。

仓库已经包含：

- `scripts/install-policy-tools.sh`：下载固定版本并校验发布方 SHA-256；
- `scripts/test-policy.sh`：执行 `opa fmt`、`opa test` 和 Conftest 正反夹具；
- `.github/workflows/governance-ci.yml`：在 GitHub Hosted Runner 上执行完整政策测试。

因此本包仍是候选实现，不得在 GitHub CI 完整通过和独立审查前加入 Required Checks。
