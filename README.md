<div align="center">

<img src="public/icon/128.png" alt="沉浸式背单词" width="96" height="96" />

# 沉浸式背单词 · Immersive Vocab

**一边沉浸式翻译，一边把生词背下来的浏览器扩展**

An open-source browser extension that translates any website and helps you
memorize new words with spaced repetition.

[English](#english) · [隐私政策](./PRIVACY.md) · [GPL-3.0 License](./LICENSE)

</div>

---

## 这是什么

沉浸式背单词把「翻译工具」和「背单词工具」合成一件事：你在网页上划词翻译时，看到生词随手收藏；之后无论是再次翻译、浏览网页，还是打开侧边栏，到期的生词都会自动出现，用间隔重复帮你记牢。

## 核心功能

### 📖 沉浸式翻译

- 整页双语对照 / 划词翻译 / 输入框翻译 / 视频字幕翻译
- 支持 20+ AI 服务商（OpenAI、DeepSeek、Claude、Gemini……）和传统翻译引擎
- **支持本地模型**：通过 Ollama 或任意 OpenAI 兼容 API（vLLM、LM Studio 等）接入你自己部署的模型，数据不出设备

### 📚 生词本

- 划词翻译后一键收藏生词，自动记录上下文句子和来源页面
- 用你配置的 AI（含本地模型）自动补充音标、词性、例句
- **三种复习方式，随时随地触达：**
  1. 每次划词翻译时，弹窗底部自动出现 1~2 个到期生词
  2. 开启页面高亮后，网页中的生词会被标出，悬停显示释义
  3. 侧边栏闪卡复习，简化间隔重复调度（记得→间隔翻倍，忘了→重新来）
- 生词本支持 JSON 导出 / 导入，数据完全存储在本地

## 安装

### 开发版（当前）

```bash
git clone https://github.com/zhao-lei007/Immersive-Vocab.git
cd Immersive-Vocab
pnpm install
pnpm build        # 产物在 .output/chrome-mv3
```

然后在 Chrome 打开 `chrome://extensions` → 开启开发者模式 → 「加载已解压的扩展程序」→ 选择 `.output/chrome-mv3` 目录。

### 应用商店

Chrome Web Store 上架准备中。

## 接入本地模型（以 Ollama 为例）

1. 本地启动 Ollama：`ollama serve`
2. 扩展设置 → API Providers → 选择 `Ollama` 或 `OpenAI Compatible`
3. 填入 baseURL（如 `http://localhost:11434`）和模型名
4. 在翻译和划词功能里选用该 Provider 即可——翻译和生词卡片生成都会走本地模型

## 开发

```bash
pnpm dev          # 开发模式（热重载）
pnpm test         # 单元测试
pnpm type-check   # 类型检查
pnpm zip:all      # 打包 Chrome / Edge / Firefox 三个版本
```

技术栈：WXT + React 19 + Dexie (IndexedDB) + Vercel AI SDK + Tailwind CSS。

发版流程见 [RELEASING.md](./RELEASING.md)（推 `v*` 标签自动测试、打包并生成 GitHub Release）。

## 隐私

开发者不运营任何服务器：翻译文本只发给你自己配置的服务商，生词本和设置只存在浏览器本地。详见[隐私政策](./PRIVACY.md)。

## 致谢与许可

本项目基于开源项目 [Read Frog（陪读蛙）](https://github.com/mengxi-ream/read-frog) 二次开发，遵循 **GPL-3.0** 许可证发布，感谢原作者出色的工作。本 fork 的主要改动：

- 新增完整的生词本与间隔重复复习系统（翻译弹窗复习卡 / 页面生词高亮 / 侧边栏闪卡 / 导入导出）
- 移除官方云服务依赖（账号体系、托管 AI、数据上报），改为纯本地 + 自配服务商
- 面向本地模型用户优化默认配置

---

## English

**Immersive Vocab** merges translation and vocabulary learning into one flow: save unfamiliar words while translating web pages, then review them everywhere — inside the translation popover, highlighted on pages you browse, or as flashcards in the side panel, scheduled by spaced repetition.

**Features**: full-page bilingual translation, selection translation, 20+ AI providers plus **local models** (Ollama / any OpenAI-compatible API), one-click word saving with AI-enriched cards (phonetics, part of speech, examples), three review surfaces, and local-only storage with JSON export/import.

**Privacy**: no developer-operated servers. Text goes only to the provider _you_ configure; your vocabulary stays in your browser. See [PRIVACY.md](./PRIVACY.md).

**License & attribution**: forked from [Read Frog](https://github.com/mengxi-ream/read-frog), released under **GPL-3.0**. Many thanks to the original authors.
