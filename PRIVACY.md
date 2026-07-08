# Privacy Policy / 隐私政策

**Immersive Vocab（沉浸式背单词）**

Last updated: 2026-07-07 · 最后更新：2026 年 7 月 7 日

---

## 中文

### 概述

沉浸式背单词是一款开源浏览器扩展。**开发者不运营任何服务器，不收集、不存储、不出售你的任何数据。**

### 我们处理哪些数据

| 数据                                  | 去向                                     | 说明                                                            |
| ------------------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| 你选中或页面上待翻译的文本            | 仅发送给**你自己配置的** AI / 翻译服务商 | 用于生成翻译结果。使用本地模型（如 Ollama）时数据不离开你的设备 |
| 生词本（单词、释义、例句、复习进度）  | 仅保存在你浏览器本地（IndexedDB）        | 可随时在侧边栏导出或删除                                        |
| 扩展设置（语言、服务商配置、API Key） | 仅保存在你浏览器本地                     | API Key 不会发送给开发者                                        |

### 我们不做什么

- ❌ 不收集浏览历史、不追踪你访问的网站
- ❌ 不运营也不连接任何开发者控制的服务器
- ❌ 无账号体系、无分析埋点、无广告
- ❌ 不向任何第三方出售或共享数据

### 第三方服务

翻译和生词卡片内容由**你自行选择并配置**的服务商处理（如 OpenAI、DeepSeek、微软翻译，或你本地部署的模型）。这些请求直接从你的浏览器发往对应服务商，受其各自隐私政策约束。

### 权限说明

- `storage`：本地保存设置与生词本
- `tabs` / `scripting` / `webNavigation`：在网页中注入翻译与生词高亮功能
- `contextMenus`：右键菜单翻译
- `alarms`：定期清理本地翻译缓存
- `identity`：仅用于可选的 Google Drive 配置同步（使用你自己的 Google 账号）
- `sidePanel` / `offscreen`：侧边栏生词本与语音朗读

### 联系方式

问题或建议请在 GitHub 提 Issue：<https://github.com/zhao-lei007/Immersive-Vocab/issues>

---

## English

### Overview

Immersive Vocab is an open-source browser extension. **The developer operates no servers and does not collect, store, or sell any of your data.**

### What data is processed

| Data                                                      | Where it goes                                                | Notes                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Text you select or pages you translate                    | Sent only to the AI / translation provider **you configure** | Used to produce translations. With a local model (e.g. Ollama), data never leaves your device |
| Vocabulary book (words, definitions, review progress)     | Stored locally in your browser (IndexedDB)                   | Export or delete anytime from the side panel                                                  |
| Extension settings (languages, provider config, API keys) | Stored locally in your browser                               | API keys are never sent to the developer                                                      |

### What we do NOT do

- ❌ No browsing-history collection or tracking
- ❌ No developer-operated servers
- ❌ No accounts, no analytics, no ads
- ❌ No selling or sharing data with third parties

### Third-party services

Translations and vocabulary cards are processed by providers **you choose and configure** (e.g. OpenAI, DeepSeek, Microsoft Translate, or a locally hosted model). Requests go directly from your browser to that provider and are subject to its privacy policy.

### Permissions

- `storage`: save settings and the vocabulary book locally
- `tabs` / `scripting` / `webNavigation`: inject translation and word-highlighting features into pages
- `contextMenus`: right-click translation
- `alarms`: periodically clean up the local translation cache
- `identity`: optional Google Drive config sync only (uses your own Google account)
- `sidePanel` / `offscreen`: vocabulary side panel and text-to-speech

### Contact

Please open an issue on GitHub: <https://github.com/zhao-lei007/Immersive-Vocab/issues>
