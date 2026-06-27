# L4 GitHub Actions Dry-run 收口说明

## 1. 定位

本阶段属于 Phase5 前置的 L4 dry-run 工程化收口。

目标不是启用生产门禁，也不是自动审查或自动返工，而是在 GitHub Actions 中验证 L4 pipeline 的只读 dry-run 能力。

本阶段不调用 ChatGPT，不调用 Claude，不写 review.json，不自动评论 PR，不合并 PR，不审批 PR。

## 2. 当前能力

当前 L4 dry-run 已具备以下能力：

1. 通过 GitHub Actions 在 pull_request 和 workflow_dispatch 下触发。
2. 执行 npm ci 和 npm test。
3. 生成 L4 pipeline input。
4. 执行 L4 pipeline CLI。
5. 输出 l4-run-result.json。
6. 输出 l4-pipeline-output.json。
7. 输出 l4-dry-run-artifact.json。
8. 校验 dry-run artifact manifest。
9. 写入 GitHub Step Summary。
10. 生成 l4-pr-comment.md 草稿。
11. 上传 artifacts/l4/ 目录作为 GitHub Actions artifact。

## 3. 产物结构

dry-run 产物目录为：

- artifacts/l4/l4-pipeline-input.json
- artifacts/l4/l4-pipeline-output.json
- artifacts/l4/l4-run-result.json
- artifacts/l4/l4-dry-run-artifact.json
- artifacts/l4/l4-pr-comment.md

## 4. 权限边界

当前 workflow 使用只读权限：contents: read。

当前 workflow 不申请 pull-requests: write、issues: write、contents: write。

当前 workflow 不使用 pull_request_target、gh pr comment、gh pr merge、git push、submit_review。

## 5. 安全原则

dry-run workflow 会运行 PR 分支中的代码，因此不能直接持有写权限。

当前设计是：pull_request workflow 使用只读权限，生成 dry-run artifact，生成 PR comment 草稿，并上传 artifact。

长期如果需要自动评论，应另建 trusted comment publisher，由受信 workflow 读取并校验 artifact 后再发布评论。

## 6. 已覆盖的测试

当前测试覆盖包括：

1. L4 pipeline CLI。
2. L4 run result schema。
3. L4 dry-run artifact schema。
4. dry-run artifact manifest 生成。
5. dry-run artifact manifest 校验。
6. GitHub Actions workflow 静态检查。
7. GitHub Step Summary 脚本。
8. PR comment draft 脚本。
9. workflow 不使用高风险写权限。
10. workflow 不自动评论。

## 7. 验收结论

当前 L4 dry-run 已满足进入下一阶段的前置条件：CLI 可执行，artifact 可生成，artifact 可校验，summary 可输出，PR comment draft 可生成，workflow 权限边界清晰，npm test 全绿。

因此第 7 步 GitHub Actions dry-run 可以收口。

下一阶段进入第 8 步：真实 ChatGPT 审查接入。

第 8 步将开始接入白槿审查器、MCP、review.json、submit_review、readback verify，但仍应保持 Codex 只作为桥接器，不作为审查者或门禁裁决者。
