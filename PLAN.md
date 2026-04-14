## 工作

完整翻譯這個 repo https://github.com/alejandrobalderas/claude-code-from-source

先閱讀過完整內容，再決定翻譯方式，每一份文件都需要分配獨立的 agent 做出完整的翻譯，包含每段文字，mermaid 圖形等等，內容要翻譯確實完整。

- 上游 `alejandrobalderas/claude-code-from-source` 目前主體包含：
  - `README.md`
  - `CLAUDE.md`
  - `book/` 18 章 markdown
  - `prompts/` 1 份 prompt 文件
  - `web/` Astro 網站，含 `book.config.ts`、2 個 pages、2 個 layouts、44 個 components、5 個 scripts
- 以「有實際英文內容需要翻譯」來算，**預估 75 個獨立翻譯單位**

## 完整執行規劃

### Phase 0 — 建立翻譯基線
- [x] 鎖定上游來源 commit（`a6d5e452...`）
- [x] 把上游檔案結構完整同步到 zhTW repo
- [x] 先做一份術語與風格規範，作為所有 agent 共用基準
- [x] 定義哪些內容要翻、哪些內容必須保留原文

### Phase 1 — 翻譯規範定稿
- [x] 定義專有名詞表（例如 Agent Loop、Prompt Cache、Hooks、MCP、Bootstrap、Apply This）
- [x] 定義語氣：繁中技術書風格、直譯優先、必要時兼顧可讀性
- [x] 定義不翻譯項目：檔名、slug、import path、程式識別字、CSS class、API 名稱、套件名
- [x] 定義必翻譯項目：段落、標題、列表、表格、Mermaid 節點/邊標籤、圖說、UI 字串、alt/title/aria-label、tooltip 文案

### Phase 2 — 每個檔案派獨立 agent 執行翻譯
- [x] 1 agent / 1 file，不共用輸出
- [x] 先翻文件類：`README.md`、`CLAUDE.md`、`book/*.md`、`prompts/*.md`
- [x] 再翻網站內容類：`web/src/book.config.ts`、`pages`、`layouts`、`components`、`scripts`
- [x] 每個 agent 都必須保留原始結構，只改文字內容
- [x] Mermaid、表格、程式碼註解、互動圖節點文案全部翻完整

### Phase 3 — 整合與一致性校對
- [x] 做跨章節術語一致性檢查（修正 18 處不一致）
- [x] 做網站 UI 字串一致性檢查
- [x] 檢查章節標題、Part 名稱、epigraph、Apply This 是否統一
- [x] 檢查所有內部連結、slug、anchor、import 是否未被誤改

### Phase 4 — 驗證
- [x] Markdown 結構檢查（18/18 通過）
- [x] Mermaid fence 與語法檢查（40 區塊全部正確）
- [x] Astro/TSX 編譯驗證（修正 1 處遺失的 `</div>`）
- [x] 網站 build 驗證（19 頁成功建置）
- [x] 抽樣人工審稿，確認不是只翻部分段落

## 建議的翻譯切分

### A. 文件組
- [x] `README.md`
- [x] `CLAUDE.md`
- [x] `prompts/analyze-codebase-to-book.md`

### B. 書籍章節組（18 agents）
- [x] `book/ch01-architecture.md`
- [x] `book/ch02-bootstrap.md`
- [x] `book/ch03-state.md`
- [x] `book/ch04-api-layer.md`
- [x] `book/ch05-agent-loop.md`
- [x] `book/ch06-tools.md`
- [x] `book/ch07-concurrency.md`
- [x] `book/ch08-sub-agents.md`
- [x] `book/ch09-fork-agents.md`
- [x] `book/ch10-coordination.md`
- [x] `book/ch11-memory.md`
- [x] `book/ch12-extensibility.md`
- [x] `book/ch13-terminal-ui.md`
- [x] `book/ch14-input-interaction.md`
- [x] 翻譯 book/ch15-mcp.md
- [x] 翻譯 book/ch16-remote.md
- [x] 翻譯 book/ch17-performance.md
- [x] 翻譯 book/ch18-epilogue.md
- [x] 翻譯 web/src/book.config.ts
- [x] 翻譯 web/src/pages/*
- [x] 翻譯 web/src/layouts/*
- [x] 翻譯 web/src/components/*
- [x] 翻譯 web/src/scripts/*
- [x] 全 repo 術語一致性校對
- [x] Mermaid / Markdown / 路由完整性檢查
- [x] Astro build 驗證
- [x] 最終人工抽查與修訂
