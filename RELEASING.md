# 发版流程

面向本仓库维护者的发布说明。CI 定义见 [`.github/workflows/release-submit.yml`](./.github/workflows/release-submit.yml)。

## 日常发版（三步）

```bash
# 0. 确保本地环境可用（见文末"本地环境"）

# 1. 升版本号：修改 package.json 的 "version"（manifest 版本会在构建时自动跟随），提交推送
git add package.json && git commit -m "chore: bump version to 1.38.0" && git push

# 2. 打标签并推送（标签必须是 v + package.json 里的版本号，CI 会校验一致性）
git tag v1.38.0
git push origin v1.38.0
```

推送标签后 CI 自动执行：

1. **跑全量测试**（失败则终止，不会产出任何东西）
2. **校验** 标签与 package.json 版本一致
3. **打包**（`pnpm zip`，产物为 `*-chrome.zip`）
4. **创建 GitHub Release**，把 zip 附在 Release 资产里

## 3. 上传商店（手动，约 1 分钟）

1. 打开仓库 [Releases 页](https://github.com/zhao-lei007/Immersive-Vocab/releases)，下载最新 Release 的 `*-chrome.zip`
2. 打开 [Chrome Web Store 开发者控制台](https://chrome.google.com/webstore/devconsole) → 选择扩展 → 左侧「程序包」→ 上传新程序包
3. 点「提交审核」

审核说明：**权限集没变化的更新通常几小时~2 天通过**；新增 permissions/host_permissions 会触发深度审核且用户端需重新确认权限，迭代时尽量避免。改动较大的版本可在提交时启用「分阶段发布」控制放量。

## 可选：全自动提审

给仓库配置 4 个 Actions secret 后，上面第 3 步也会由 CI 自动完成（工作流自动检测，无需改代码）：

| Secret                                                               | 来源                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `CHROME_EXTENSION_ID`                                                | 商店后台扩展详情页 URL 里的 32 位 ID                                                        |
| `CHROME_CLIENT_ID` / `CHROME_CLIENT_SECRET` / `CHROME_REFRESH_TOKEN` | 在仓库目录运行 `./node_modules/.bin/wxt-publish-extension init`，按向导在 Google Cloud 生成 |

配置后建议先在 Actions 页手动触发一次工作流并勾选 **dryRun** 验证凭据。

## 本地环境

本机（Mac mini）的 shell 默认没有 pnpm，且系统 node 版本过旧。在仓库目录执行任何 pnpm 命令前先：

```bash
export PATH="$HOME/.nvm/versions/node/v22.17.1/bin:$PATH"
```

（若提示 pnpm 不存在，执行一次 `COREPACK_INTEGRITY_KEYS=0 corepack enable --install-directory "$HOME/.nvm/versions/node/v22.17.1/bin"`）

常用命令：

```bash
pnpm dev          # 开发模式（dev 浏览器 profile 在 ~/.immersive-vocab-dev，勿放 iCloud 目录）
SKIP_FREE_API=true pnpm test        # 全量测试
pnpm type-check                     # 类型检查
WXT_SKIP_ENV_VALIDATION=true pnpm zip   # 本地打包
```
